/**
 * Motor do visualizador 3D (Three.js). Recebe a cena já calculada no servidor (cena-3d.ts) e cuida só de desenhar:
 * carrega os modelos da biblioteca, monta pilhas, montes, kits e equipes, toca as animações gravadas no Blender
 * e anima as mudanças de quantidade.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { CenaItem, Peca, Visual } from "@/servicos/cena-3d";

export const CAMINHO_MODELOS = "/biblioteca-3d/modelos";

type Opcoes = {
  escuro: boolean;
  animacoes: boolean;
  onSelecionar?: (itemId: string) => void;
};

export type ModoCena = "canteiro" | "item";

type Estacao = {
  itemId: string;
  grupo: THREE.Group;
  pecas: { peca: Peca; grupo: THREE.Group; chave: string }[];
  rotulo?: CSS2DObject;
};

type Tarefa = { inicio: number; duracao: number; passo: (t: number) => void; fim?: () => void };

const suave = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// ---------------------------------------------------------------------------
// Carregamento com cache
// ---------------------------------------------------------------------------
let carregador: GLTFLoader | null = null;
const cache = new Map<string, Promise<GLTF>>();

function loader() {
  if (!carregador) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/biblioteca-3d/draco/");
    carregador = new GLTFLoader();
    carregador.setDRACOLoader(draco);
  }
  return carregador;
}

function carregar(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    p = loader().loadAsync(url);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

const urlModelo = (codigo: string, leve: boolean) => `${CAMINHO_MODELOS}/${codigo}${leve ? "_lod1" : ""}.glb`;
const urlAnimacao = (codigo: string) => `${CAMINHO_MODELOS}/${codigo}_anim.glb`;
const urlVideo = (codigo: string) => `${CAMINHO_MODELOS}/${codigo}_anim.webm`;

function prepararSombras(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
}

function caixa(o: THREE.Object3D) {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o, true);
}

// ---------------------------------------------------------------------------
// Almoxarifado: suportes desenhados aqui mesmo (palete, cavalete, estante, baia, vaga)
// ---------------------------------------------------------------------------
const MAT_MADEIRA = new THREE.MeshStandardMaterial({ color: 0xc8a064, roughness: 0.85 });
const MAT_CONCRETO = new THREE.MeshStandardMaterial({ color: 0xb4b8ba, roughness: 0.95 });
const MAT_ACO = new THREE.MeshStandardMaterial({ color: 0x1f5d6b, roughness: 0.5, metalness: 0.35 });
const MAT_FAIXA = new THREE.MeshStandardMaterial({ color: 0xf2b428, roughness: 0.9 });
const MAT_FAIXA_EQUIPE = new THREE.MeshStandardMaterial({ color: 0x2f8ea1, roughness: 0.9 });
const CUBO = new THREE.BoxGeometry(1, 1, 1);
const G = 9.81;

/** Número pseudoaleatório estável por índice: a mesma peça cai sempre do mesmo jeito. */
const corDoGranel = (nome: string) => /brita|pedra|cascalho|p[oó] de pedra/i.test(nome) ? 0x8f9194 : /terra|solo|argila|saibro/i.test(nome) ? 0x8a6a4a : 0xd8c08e;

function acaso(k: number, s: number) { const x = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }

/** Textura de ruído granulado (terra batida, brita, concreto), desenhada em canvas. */
function texturaGranulada(base: [number, number, number], variacao: number, manchas: number, repetir: number): THREE.CanvasTexture {
  const n = 512, c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d")!;
  const img = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const r = (Math.random() - 0.5) * variacao;
    img.data[i * 4] = base[0] + r; img.data[i * 4 + 1] = base[1] + r; img.data[i * 4 + 2] = base[2] + r * 0.9; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < manchas; i++) {
    const px = Math.random() * n, py = Math.random() * n, raio = 10 + Math.random() * Math.random() * 110, escuro = Math.random() < 0.6;
    const g = x.createRadialGradient(px, py, 0, px, py, raio);
    g.addColorStop(0, escuro ? "rgba(40,28,14,0.05)" : "rgba(255,246,228,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { x.beginPath(); x.arc(px + dx, py + dy, raio, 0, Math.PI * 2); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repetir, repetir);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Veios de madeira para paletes e prateleiras. */
function texturaMadeira(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#c9a066"; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 25},30,${0.10 + Math.random() * 0.22})`;
    x.lineWidth = 0.6 + Math.random() * 1.6;
    const y = Math.random() * 64;
    x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(80, y + (Math.random() - 0.5) * 7, 170, y + (Math.random() - 0.5) * 7, 256, y); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grao(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function bloco(g: THREE.Group, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, sombra = true) {
  const m = new THREE.Mesh(CUBO, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.castShadow = sombra; m.receiveShadow = true;
  g.add(m);
}

type TipoSuporte = "palete" | "cavalete" | "estante" | "baia" | "vaga" | "equipe";

function tipoSuporte(p: Peca, t: THREE.Vector3): TipoSuporte {
  if (p.papel === "mao_de_obra") return "equipe";
  if (p.papel === "equipamento" || p.visual.tipo === "maquina") return "vaga";
  if (p.visual.tipo === "monte") return "baia";
  if (p.visual.tipo === "pilha" && p.visual.arranjo === "feixe" && Math.max(t.x, t.z) > 1.5) return "cavalete";
  if (Math.max(t.x, t.z) < 0.9 && t.y < 1) return "estante";
  return "palete";
}

/** Suporte sob uma peça de tamanho `t`, centrado na origem. Devolve também quanto a peça sobe. */
function criarSuporte(tipo: TipoSuporte, t: THREE.Vector3): { grupo: THREE.Group; elevacao: number } {
  const g = new THREE.Group();
  if (tipo === "palete") {
    const w = t.x + 0.16, d = t.z + 0.16;
    for (const z of [-d / 2 + 0.05, 0, d / 2 - 0.05]) bloco(g, MAT_MADEIRA, w, 0.09, 0.09, 0, 0, z);
    const n = Math.max(3, Math.min(12, Math.round(w / 0.17)));
    for (let i = 0; i < n; i++) bloco(g, MAT_MADEIRA, (w / n) * 0.72, 0.03, d, -w / 2 + (w / n) * (i + 0.5), 0.09, 0);
    return { grupo: g, elevacao: 0.12 };
  }
  if (tipo === "cavalete") {
    const longoX = t.x >= t.z;
    const L = longoX ? t.x : t.z, S = (longoX ? t.z : t.x) + 0.3;
    const n = L > 6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = -L / 2 + L * (n === 2 ? [0.2, 0.8][i] : [0.12, 0.5, 0.88][i]);
      const c = new THREE.Group();
      bloco(c, MAT_ACO, 0.08, 0.08, S, 0, 0.32, 0);
      for (const z of [-S / 2 + 0.05, S / 2 - 0.05]) { bloco(c, MAT_ACO, 0.06, 0.32, 0.06, 0, 0, z); bloco(c, MAT_ACO, 0.4, 0.04, 0.06, 0, 0, z); bloco(c, MAT_ACO, 0.05, 0.22, 0.05, 0, 0.4, z); }
      if (longoX) c.position.x = a; else { c.rotation.y = Math.PI / 2; c.position.z = a; }
      g.add(c);
    }
    return { grupo: g, elevacao: 0.4 };
  }
  if (tipo === "estante") {
    const w = Math.max(t.x + 0.3, 0.9), d = Math.max(t.z + 0.2, 0.5), base = 0.45, alto = base + t.y + 0.3;
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) bloco(g, MAT_ACO, 0.04, alto, 0.04, x, 0, z);
    for (const y of [0.1, base - 0.03, alto - 0.03]) bloco(g, MAT_MADEIRA, w, 0.03, d, 0, y, 0);
    return { grupo: g, elevacao: base };
  }
  if (tipo === "baia") {
    const w = t.x + 0.5, d = t.z + 0.4, h = Math.max(0.5, Math.min(1.4, t.y * 0.75)), e = 0.14;
    bloco(g, MAT_CONCRETO, w + e * 2, h, e, 0, 0, -d / 2 - e / 2);
    for (const x of [-w / 2 - e / 2, w / 2 + e / 2]) bloco(g, MAT_CONCRETO, e, h, d * 0.85, x, 0, -d / 2 + (d * 0.85) / 2);
    return { grupo: g, elevacao: 0 };
  }
  // Vaga pintada no chão: máquinas (amarelo) e equipe (azul).
  const mat = tipo === "vaga" ? MAT_FAIXA : MAT_FAIXA_EQUIPE;
  const w = t.x + 0.5, d = t.z + 0.5, f = 0.07;
  for (const z of [-d / 2, d / 2]) bloco(g, mat, w + f, 0.012, f, 0, 0.004, z, false);
  for (const x of [-w / 2, w / 2]) bloco(g, mat, f, 0.012, d, x, 0.004, 0, false);
  return { grupo: g, elevacao: 0 };
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Montagem das peças
// ---------------------------------------------------------------------------
function posicoesPilha(n: number, tam: THREE.Vector3, arranjo: string): THREE.Matrix4[] {
  const r: THREE.Matrix4[] = [];
  const folga = 1.03;
  if (arranjo === "chapas") {
    for (let i = 0; i < n; i++) r.push(new THREE.Matrix4().makeTranslation(0, i * tam.y * 1.01, 0));
    return r;
  }
  if (arranjo === "feixe") {
    // Barras deitadas lado a lado, em camadas que diminuem para cima.
    const longoEmZ = tam.z > tam.x;
    const largura = (longoEmZ ? tam.x : tam.z) * folga;
    const altura = Math.max(tam.y, largura * 0.9);
    const porCamada = Math.max(1, Math.ceil(Math.sqrt(n) * 1.6));
    let i = 0;
    for (let c = 0; i < n; c++) {
      const naCamada = Math.max(1, porCamada - c);
      for (let j = 0; j < naCamada && i < n; j++, i++) {
        const lateral = (j - (naCamada - 1) / 2) * largura;
        const m = new THREE.Matrix4().makeTranslation(longoEmZ ? lateral : 0, c * altura, longoEmZ ? 0 : lateral);
        r.push(m);
      }
    }
    return r;
  }
  const porCamada = Math.max(1, Math.min(arranjo === "rolos" ? 16 : 49, Math.ceil(Math.pow(n, 2 / 3))));
  const colunas = Math.ceil(Math.sqrt(porCamada));
  const linhas = Math.ceil(porCamada / colunas);
  for (let i = 0; i < n; i++) {
    const camada = Math.floor(i / porCamada);
    const k = i % porCamada;
    const x = ((k % colunas) - (colunas - 1) / 2) * tam.x * folga;
    const z = (Math.floor(k / colunas) - (linhas - 1) / 2) * tam.z * folga;
    const m = new THREE.Matrix4().makeTranslation(x, camada * tam.y, z);
    // Camadas alternadas giram meia volta, como numa pilha de verdade.
    if (camada % 2 === 1) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    r.push(m);
  }
  return r;
}

/** Peça repetida n vezes. Usa InstancedMesh: centenas de blocos custam como um só. */
/**
 * Pilha de peças. `cair(desde)` devolve o quadro da animação em que as peças a partir de `desde`
 * caem uma a uma, na ordem da pilha: 1 saco cai 1; ao passar para 2, cai só o segundo.
 */
type Queda = (desde: number, aoBater?: (mundo: THREE.Vector3, velocidade: number) => void) => { quadro: (t: number) => void; segundos: number } | null;

function montarPilha(modelo: THREE.Object3D, n: number, arranjo: string, mat: { e: number; macio: boolean }): { grupo: THREE.Group; cair: Queda } {
  const grupo = new THREE.Group();
  const tam = caixa(modelo).getSize(new THREE.Vector3());
  const posicoes = posicoesPilha(n, tam, arranjo);
  let temInstancias = false;
  modelo.updateMatrixWorld(true);
  modelo.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) temInstancias = true; });

  // Cada peça é posta por uma função que recebe a matriz final (ou null para esconder).
  let por: (i: number, m: THREE.Matrix4 | null) => void;
  let fechar = () => {};
  if (temInstancias) {
    // Modelos com instâncias próprias (brita, pregos) são clonados inteiros.
    const clones = posicoes.map((p) => {
      const c = modelo.clone(true);
      c.matrixAutoUpdate = false;
      c.matrix.copy(p);
      grupo.add(c);
      return c;
    });
    por = (i, m) => { const c = clones[i]; c.visible = !!m; if (m) c.matrix.copy(m); c.matrixWorldNeedsUpdate = true; };
  } else {
    const malhas: { malha: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
    modelo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const inst = new THREE.InstancedMesh(m.geometry, m.material, posicoes.length);
      inst.castShadow = true; inst.receiveShadow = true;
      const local = m.matrixWorld.clone();
      posicoes.forEach((p, k) => inst.setMatrixAt(k, p.clone().multiply(local)));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.computeBoundingBox();
      grupo.add(inst);
      malhas.push({ malha: inst, local });
    });
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    por = (i, m) => { for (const { malha, local } of malhas) malha.setMatrixAt(i, m ? m.clone().multiply(local) : zero); };
    fechar = () => { for (const { malha } of malhas) malha.instanceMatrix.needsUpdate = true; };
  }

  // Queda com gravidade real: tempo de queda, velocidade de impacto e quiques saem de g = 9,81 m/s².
  const h0 = Math.max(1.4, Math.min(3, tam.y * 5));
  const cair = (desde: number, aoBater?: (mundo: THREE.Vector3, velocidade: number) => void) => {
    const novas = posicoes.length - desde;
    if (novas <= 0) return null;
    const intervalo = Math.min(0.32, 2 / novas);
    const dados = posicoes.map((_, k) => {
      const h = h0 * (0.85 + 0.35 * acaso(k, 1));
      const tq = Math.sqrt((2 * h) / G), v = G * tq;
      return {
        h, tq, v, b1: (2 * v * mat.e) / G, b2: (2 * v * mat.e * mat.e) / G,
        rot: new THREE.Euler((acaso(k, 2) - 0.5) * 0.7, (acaso(k, 3) - 0.5) * 1.0, (acaso(k, 4) - 0.5) * 0.7),
        dx: (acaso(k, 5) - 0.5) * 0.22, dz: (acaso(k, 6) - 0.5) * 0.22,
      };
    });
    const total = intervalo * (novas - 1) + Math.max(...dados.slice(desde).map((d) => d.tq + d.b1 + d.b2)) + 0.3;
    const bateu = new Set<number>();
    const T = new THREE.Matrix4(), R = new THREE.Matrix4(), S = new THREE.Matrix4(), e = new THREE.Euler();
    const quadro = (t: number) => {
      const agora = t * total;
      if (t === 0) bateu.clear();
      for (let k = desde; k < posicoes.length; k++) {
        const d = dados[k];
        const tau = agora - (k - desde) * intervalo;
        if (t >= 1) { por(k, posicoes[k]); continue; }
        if (tau <= 0) { por(k, null); continue; }
        let y = 0, solto = 0, amassa = 1;
        if (tau < d.tq) {
          y = d.h - (G * tau * tau) / 2;
          solto = 1 - (tau / d.tq) ** 2;
        } else {
          const u = tau - d.tq;
          if (!bateu.has(k)) {
            bateu.add(k);
            if (aoBater) aoBater(grupo.localToWorld(new THREE.Vector3().setFromMatrixPosition(posicoes[k])), d.v);
          }
          if (u < d.b1) y = d.v * mat.e * u - (G * u * u) / 2;
          else if (u < d.b1 + d.b2) { const w = u - d.b1; y = d.v * mat.e * mat.e * w - (G * w * w) / 2; }
          // Saco e rolo amassam no impacto e voltam; peça rígida só quica.
          if (mat.macio) amassa = 1 - 0.22 * Math.exp(-u * 9) * Math.cos(u * 22);
        }
        e.set(d.rot.x * solto, d.rot.y * solto, d.rot.z * solto);
        R.makeRotationFromEuler(e);
        const lado = 1 / Math.sqrt(amassa);
        S.makeScale(lado, amassa, lado);
        por(k, T.makeTranslation(d.dx * solto, Math.max(0, y), d.dz * solto).multiply(posicoes[k]).multiply(R).multiply(S));
      }
      fechar();
    };
    return { quadro, segundos: total };
  };
  return { grupo, cair };
}

/** Etapas de montagem de um kit: cada nó traz etapa_ordem e, às vezes, remover_na_etapa. */
function aplicarEtapa(kit: THREE.Object3D, etapa: number, progresso = 1) {
  kit.traverse((o) => {
    const d = o.userData as { etapa_ordem?: number; remover_na_etapa?: number; _y?: number };
    if (d.etapa_ordem == null) return;
    if (d._y == null) d._y = o.position.y;
    const removida = d.remover_na_etapa != null && etapa >= d.remover_na_etapa;
    o.visible = d.etapa_ordem <= etapa && !removida;
    o.position.y = d._y + (d.etapa_ordem === etapa ? (1 - suave(progresso)) * 0.35 : 0);
  });
}
function etapasDoKit(kit: THREE.Object3D) {
  let max = 0;
  kit.traverse((o) => { const e = (o.userData as { etapa_ordem?: number }).etapa_ordem; if (e != null && e > max) max = e; });
  return max;
}

const corpo = (g: THREE.Object3D) => (g.userData.corpo as THREE.Group | undefined) ?? (g as THREE.Group);

function acenderAnel(figura: THREE.Object3D, segmentos: number) {
  figura.traverse((o) => {
    const m = o.name.match(/_anel_h(\d{2})$/);
    if (m) o.visible = Number(m[1]) < segmentos;
  });
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------
export class Motor {
  private renderer: THREE.WebGLRenderer;
  private rotulos: CSS2DRenderer;
  private ultimaArrumacao = 0;
  private areas = new THREE.Group();
  private patio: { x0: number; x1: number; z0: number; z1: number } | null = null;
  private cena = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controles: OrbitControls;
  private relogio = new THREE.Timer();
  private mixers = new Set<THREE.AnimationMixer>();
  private tarefas = new Set<Tarefa>();
  private estacoes = new Map<string, Estacao>();
  private raiz = new THREE.Group();
  private chao: THREE.Mesh;
  private ceu = new Sky();
  private pmrem: THREE.PMREMGenerator;
  private hemisferio = new THREE.HemisphereLight(0xdff3f6, 0x6b5a45, 0.35);
  private direcaoSol = new THREE.Vector3(0.4, 0.75, 0.5);
  private grao: THREE.CanvasTexture;
  private texTerra: THREE.CanvasTexture;
  private texConcreto: THREE.CanvasTexture;
  private texPatio: THREE.CanvasTexture;
  private compositor: EffectComposer | null = null;
  private sol: THREE.DirectionalLight;
  private quadro = 0;
  private visivel = true;
  private observador: ResizeObserver;
  private versao = 0;
  private opcoes: Opcoes;
  private ultimoModo: ModoCena = "canteiro";
  private visuais = new Map<string, Visual>();

  constructor(private container: HTMLElement, opcoes: Opcoes) {
    this.opcoes = opcoes;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "v3d-canvas";

    this.rotulos = new CSS2DRenderer();
    this.rotulos.domElement.className = "v3d-rotulos";
    container.appendChild(this.rotulos.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 2000);
    this.camera.position.set(4, 3, 6);
    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.maxPolarAngle = Math.PI * 0.49;
    this.controles.minDistance = 0.4;
    this.controles.maxDistance = 400;

    this.grao = grao();
    this.texTerra = texturaGranulada([124, 108, 88], 20, 320, 70);
    this.texConcreto = texturaGranulada([196, 196, 192], 14, 120, 1);
    this.texPatio = texturaGranulada([172, 160, 140], 30, 200, 1);
    if (!MAT_MADEIRA.map) { MAT_MADEIRA.map = texturaMadeira(); MAT_MADEIRA.color.set(0xffffff); MAT_MADEIRA.needsUpdate = true; }

    // Céu físico (espalhamento atmosférico); a luz ambiente da cena vem dele.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.ceu.scale.setScalar(1500);
    this.cena.add(this.ceu, this.hemisferio);
    this.sol = new THREE.DirectionalLight(0xfff3dc, 3);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.02;
    this.sol.shadow.radius = 3;
    this.cena.add(this.sol, this.sol.target);

    // Terreno de terra batida até o horizonte, com névoa ao longe.
    this.chao = new THREE.Mesh(new THREE.CircleGeometry(700, 64), new THREE.MeshStandardMaterial({ map: this.texTerra, roughness: 1, metalness: 0 }));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.receiveShadow = true;
    this.cena.add(this.chao);
    this.cena.fog = new THREE.Fog(0xcfdde6, 90, 650);
    this.aplicarTema(opcoes.escuro);

    // Oclusão de ambiente: escurece cantos e contatos, o que assenta as peças no chão.
    try {
      const alvo = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
      const comp = new EffectComposer(this.renderer, alvo);
      comp.addPass(new RenderPass(this.cena, this.camera));
      const ao = new GTAOPass(this.cena, this.camera, 1, 1);
      ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.2, thickness: 1, scale: 1.15, samples: 12, screenSpaceRadius: false });
      ao.blendIntensity = 0.85;
      comp.addPass(ao);
      comp.addPass(new OutputPass());
      this.compositor = comp;
    } catch { this.compositor = null; }
    this.cena.add(this.raiz);

    this.renderer.domElement.addEventListener("pointerdown", this.aoApertar);
    this.renderer.domElement.addEventListener("pointerup", this.aoSoltar);
    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    this.redimensionar();
    this.laco();
  }

  /** Claro: sol alto de manhã. Escuro: fim de tarde, sol baixo e luz quente. */
  aplicarTema(escuro: boolean) {
    this.opcoes.escuro = escuro;
    const elev = THREE.MathUtils.degToRad(escuro ? 9 : 38), azim = THREE.MathUtils.degToRad(35);
    this.direcaoSol.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));
    const u = this.ceu.material.uniforms;
    u.turbidity.value = escuro ? 8 : 5;
    u.rayleigh.value = escuro ? 2.6 : 1.4;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(this.direcaoSol);
    this.sol.color.set(escuro ? 0xffa25e : 0xfff3dc);
    this.sol.intensity = escuro ? 3.4 : 5.5;
    this.hemisferio.intensity = escuro ? 0.12 : 0.2;
    this.renderer.toneMappingExposure = escuro ? 0.55 : 0.5;
    (this.cena.fog as THREE.Fog).color.set(escuro ? 0x8a7f86 : 0xcfdde6);
    // Ambiente a partir do próprio céu.
    const temp = new THREE.Scene();
    temp.add(this.ceu);
    const antigo = this.cena.environment;
    this.cena.environment = this.pmrem.fromScene(temp, 0.02).texture;
    this.cena.environmentIntensity = escuro ? 0.3 : 0.22;
    antigo?.dispose();
    this.cena.add(this.ceu);
    this.posicionarSol();
  }

  private alcanceSol = 12;
  private posicionarSol() {
    this.sol.position.copy(this.direcaoSol).multiplyScalar(this.alcanceSol * 2.5);
    this.sol.target.position.set(0, 0, 0);
  }

  definirAnimacoes(ligadas: boolean) { this.opcoes.animacoes = ligadas; }

  private aoApertar = (e: PointerEvent) => { (this as unknown as { _xy: [number, number] })._xy = [e.clientX, e.clientY]; };
  private aoSoltar = (e: PointerEvent) => {
    const xy = (this as unknown as { _xy?: [number, number] })._xy;
    if (!xy || Math.hypot(e.clientX - xy[0], e.clientY - xy[1]) > 5 || !this.opcoes.onSelecionar) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(p, this.camera);
    const hit = ray.intersectObject(this.raiz, true).find((h) => h.object.visible);
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.itemId) o = o.parent;
    if (o?.userData.itemId) this.opcoes.onSelecionar(o.userData.itemId as string);
  };

  private redimensionar() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.compositor?.setPixelRatio(this.renderer.getPixelRatio());
    this.compositor?.setSize(w, h);
    this.rotulos.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private laco = () => {
    this.quadro = requestAnimationFrame(this.laco);
    if (!this.visivel) return;
    this.relogio.update();
    const dt = Math.min(0.05, this.relogio.getDelta());
    const agora = performance.now();
    for (const m of this.mixers) m.update(dt);
    for (const t of this.tarefas) {
      const f = Math.min(1, (agora - t.inicio) / t.duracao);
      t.passo(f);
      if (f >= 1) { this.tarefas.delete(t); t.fim?.(); }
    }
    this.controles.update();
    if (this.compositor) this.compositor.render(); else this.renderer.render(this.cena, this.camera);
    this.rotulos.render(this.cena, this.camera);
    if (agora - this.ultimaArrumacao > 160) { this.ultimaArrumacao = agora; this.arrumarRotulos(); }
  };

  /** Esconde rótulos que cairiam em cima de outro já visível; o item escolhido tem prioridade. */
  private arrumarRotulos() {
    const els = [...this.rotulos.domElement.querySelectorAll<HTMLElement>(".v3d-marcador, .v3d-rotulo, .v3d-area-titulo")];
    if (els.length < 2) return;
    const peso = (el: HTMLElement) => el.classList.contains("v3d-area-titulo") ? 0 : el.classList.contains("v3d-marcador-ativo") ? 1 : 2;
    els.sort((x, y) => peso(x) - peso(y));
    const ocupados: DOMRect[] = [];
    for (const el of els) {
      if (el.style.display === "none") continue;
      el.classList.remove("v3d-oculto");
      const r = el.getBoundingClientRect();
      const bate = ocupados.some((o) => r.left < o.right + 2 && r.right > o.left - 2 && r.top < o.bottom + 2 && r.bottom > o.top - 2);
      if (bate) el.classList.add("v3d-oculto"); else ocupados.push(r);
    }
  }

  definirVisivel(v: boolean) { this.visivel = v; if (v) this.relogio.reset(); }

  private tarefa(duracao: number, passo: (t: number) => void, fim?: () => void) {
    const t: Tarefa = { inicio: performance.now(), duracao, passo, fim };
    this.tarefas.add(t);
    passo(0);
    return t;
  }

  // -------------------------------------------------------------------------
  // Cena
  // -------------------------------------------------------------------------
  /**
   * Monta (ou atualiza) a cena. Itens que já estavam na tela e não mudaram ficam como estão;
   * os que mudaram de quantidade crescem ou encolhem; os de `animar` tocam a animação de entrada.
   */
  async definirCena(itens: CenaItem[], modo: ModoCena, o: { foco?: string | null; animar?: Set<string>; montado?: boolean } = {}) {
    const versao = ++this.versao;
    const leve = modo === "canteiro" && itens.length > 1;
    const recomecar = modo !== this.ultimoModo;
    this.ultimoModo = modo;
    if (recomecar) this.limpar();

    const ids = new Set(itens.map((i) => i.itemId));
    for (const [id, e] of this.estacoes) if (!ids.has(id)) { this.descartar(e); this.estacoes.delete(id); }

    // Só o que acabou de entrar toca a entrada inteira; o que já estava só acrescenta as peças novas.
    const novas = new Set<string>();
    const montadas = await Promise.all(itens.map(async (item) => {
      const pecas = this.pecasVisiveis(item, !!o.montado);
      const anterior = this.estacoes.get(item.itemId);
      const assinatura = pecas.map((p) => this.chave(p, leve)).join(";");
      if (anterior && anterior.grupo.userData.assinatura === assinatura) return anterior;
      if (!anterior) novas.add(item.itemId);
      const est = await this.montarEstacao(item, pecas, leve, modo, anterior);
      est.grupo.userData.assinatura = assinatura;
      return est;
    }));
    if (versao !== this.versao) { montadas.forEach((e) => { if (!this.estacoes.has(e.itemId) || this.estacoes.get(e.itemId) !== e) this.descartar(e); }); return; }

    for (const e of montadas) {
      const ant = this.estacoes.get(e.itemId);
      if (ant && ant !== e) this.descartar(ant);
      this.estacoes.set(e.itemId, e);
      if (!e.grupo.parent) this.raiz.add(e.grupo);
    }
    this.dispor(itens, modo);
    await this.montarEntorno(versao);
    if (versao !== this.versao) return;
    this.centralizarRaiz();
    this.ajustarChao();
    // Enquadra antes de animar: a animação de entrada encolhe ou esconde as peças.
    const foco = o.foco && this.estacoes.has(o.foco) ? o.foco : null;
    if (foco && modo === "canteiro") this.focar(foco, recomecar);
    else this.enquadrar(this.raiz, recomecar || this.estacoes.size <= 1);
    for (const e of montadas) {
      if (o.animar?.has(e.itemId) && novas.has(e.itemId) && this.opcoes.animacoes && !reduzirMovimento()) this.tocarEstacao(e);
    }
  }

  /** Materiais, equipamentos e equipe; o serviço montado (kit) só quando pedido. */
  private pecasVisiveis(item: CenaItem, montado: boolean): Peca[] {
    return montado ? item.pecas : item.pecas.filter((p) => p.papel !== "kit");
  }

  private chave(p: Peca, leve: boolean) {
    return `${p.codigo}${leve ? "~" : ""}:${JSON.stringify(p.visual)}`;
  }

  private async montarEstacao(item: CenaItem, pecas: Peca[], leve: boolean, modo: ModoCena, anterior?: Estacao): Promise<Estacao> {
    const grupo = new THREE.Group();
    grupo.userData.itemId = item.itemId;
    const lista: Estacao["pecas"] = [];
    await Promise.all(pecas.map(async (peca) => {
      try {
        const gltf = await carregar(urlModelo(peca.codigo, leve));
        const g = this.montarPeca(gltf.scene, peca, anterior);
        g.userData.codigo = peca.codigo;
        lista.push({ peca, grupo: g, chave: this.chave(peca, leve) });
      } catch { /* modelo ausente: segue sem ele */ }
    }));
    // Mantém a ordem da cena: kit, materiais, equipamentos, equipe.
    lista.sort((a, b) => pecas.indexOf(a.peca) - pecas.indexOf(b.peca));

    let x = 0;
    const atras: typeof lista = [], frente: typeof lista = [];
    for (const l of lista) (l.peca.papel === "mao_de_obra" ? frente : atras).push(l);
    const fila = (ls: typeof lista, z: number, vao: number) => {
      x = 0;
      const larguras = ls.map((l) => caixa(l.grupo).getSize(new THREE.Vector3()));
      const total = larguras.reduce((s, t) => s + t.x, 0) + Math.max(0, ls.length - 1) * vao;
      x = -total / 2;
      ls.forEach((l, i) => {
        const bb = caixa(l.grupo);
        l.grupo.position.x = x - bb.min.x;
        l.grupo.position.z = z;
        x += larguras[i].x + vao;
        grupo.add(l.grupo);
      });
    };
    fila(atras, 0, 0.5);
    if (frente.length) {
      const prof = atras.length ? caixa(grupo).max.z : 0;
      // Equipe com mais folga: cada figura leva o próprio rótulo.
      // No item, a equipe se espalha pela largura do serviço para os rótulos não se sobreporem.
      let vao = 0.6;
      if (modo === "item") {
        const larguraAtras = atras.length ? caixa(grupo).getSize(new THREE.Vector3()).x : 0;
        const ocupado = frente.reduce((t, l) => t + caixa(l.grupo).getSize(new THREE.Vector3()).x, 0);
        vao = frente.length > 1 ? Math.min(4, Math.max(1.3, (larguraAtras * 0.8 - ocupado) / (frente.length - 1))) : 1.3;
      }
      fila(frente, prof + 0.9, vao);
    }
    for (const l of lista) {
      if (modo === "item") this.rotular(l.grupo, l.peca);
      l.grupo.userData.itemId = item.itemId;
    }
    return { itemId: item.itemId, grupo, pecas: lista };
  }

  private montarPeca(original: THREE.Object3D, peca: Peca, anterior?: Estacao): THREE.Group {
    const externo = new THREE.Group();
    const g = new THREE.Group();
    externo.add(g);
    externo.userData.corpo = g;
    const v = peca.visual;
    const antes = anterior?.pecas.find((p) => p.peca.codigo === peca.codigo)?.peca.visual;
    const modelo = original.clone(true);
    prepararSombras(modelo);

    if (v.tipo === "monte") {
      g.add(modelo);
      const de = antes?.tipo === "monte" ? antes.escala : v.escala;
      modelo.scale.setScalar(de);
      if (de !== v.escala && this.opcoes.animacoes && !reduzirMovimento()) {
        const b = caixa(modelo).getSize(new THREE.Vector3());
        if (v.escala > de) this.despejar(g, (b.y / de) * v.escala, (Math.max(b.x, b.z) / de) * v.escala / 2, 1500, corDoGranel(peca.origem));
        this.tarefa(1500, (t) => modelo.scale.setScalar(de + (v.escala - de) * suave(t)));
      }
      else modelo.scale.setScalar(v.escala);
    } else if (v.tipo === "pilha") {
      // Restituição do quique pelo material: saco e rolo quase não quicam; aço e madeira quicam mais.
      const macio = /saco|rolo|manta|lona|bobina/i.test(`${peca.rotulo} ${peca.nome}`);
      const { grupo, cair } = montarPilha(modelo, v.visiveis, v.arranjo, { e: macio ? 0.05 : v.arranjo === "feixe" ? 0.3 : 0.2, macio });
      g.add(grupo);
      externo.userData.cair = cair;
      // Quantidade aumentou: só as peças novas caem.
      const desde = antes?.tipo === "pilha" ? Math.min(antes.visiveis, v.visiveis) : v.visiveis;
      this.tocarQueda(externo, desde);
    } else if (v.tipo === "kit") {
      const largura = caixa(modelo).getSize(new THREE.Vector3()).x;
      for (let i = 0; i < v.visiveis; i++) {
        const c = i === 0 ? modelo : modelo.clone(true);
        c.position.x = i * largura;
        g.add(c);
      }
      g.children.forEach((c) => aplicarEtapa(c, Infinity));
    } else if (v.tipo === "figura") {
      for (let i = 0; i < v.figuras; i++) {
        const c = i === 0 ? modelo : modelo.clone(true);
        c.position.x = i * 0.9;
        acenderAnel(c, i === v.figuras - 1 ? v.segmentos : 24);
        g.add(c);
      }
    } else {
      g.add(modelo);
    }
    return externo;
  }

  private rotular(g: THREE.Group, p: Peca) {
    const el = document.createElement("div");
    el.className = `v3d-rotulo v3d-${p.papel}`;
    const nome = document.createElement("b");
    nome.textContent = p.papel === "mao_de_obra" ? p.nome.split(":")[0] : p.rotulo;
    el.appendChild(nome);
    if (p.papel === "mao_de_obra") {
      const s = document.createElement("span");
      s.textContent = p.rotulo;
      el.appendChild(s);
    }
    const obj = new CSS2DObject(el);
    const bb = caixa(g);
    // Equipe: rótulo aos pés, junto do anel de horas; demais peças: acima.
    const equipe = p.papel === "mao_de_obra";
    obj.position.set((bb.min.x + bb.max.x) / 2 - g.position.x, equipe ? bb.min.y : bb.max.y + 0.08, (bb.min.z + bb.max.z) / 2 - g.position.z);
    obj.center.set(0.5, equipe ? -0.25 : 1);
    g.add(obj);
  }

  /** Canteiro: estações em filas, um bloco de filas por etapa. */
  /**
   * Canteiro arrumado como almoxarifado: áreas demarcadas (granel, materiais, equipamentos, equipe;
   * ou etapas, no serviço montado), vagas iguais em grade, cada peça no seu suporte e uma placa
   * no chão com nome, quantidade e valor.
   */
  private dispor(itens: CenaItem[], modo: ModoCena) {
    this.raiz.position.set(0, 0, 0);
    this.raiz.updateMatrixWorld(true); // as medidas abaixo são em coordenadas do mundo
    this.limparAreas();
    this.patio = null;
    for (const e of this.estacoes.values()) this.tirarSuporte(e);
    if (modo === "item") {
      for (const e of this.estacoes.values()) e.grupo.position.set(0, 0, 0);
      this.centralizarRaiz();
      return;
    }
    const porId = new Map(itens.map((i) => [i.itemId, i]));
    const deposito = itens.length > 0 && itens.every((i) => i.itemId.startsWith("dep:"));
    const grupos = new Map<string, { nome: string; ests: Estacao[] }>();
    for (const i of itens) {
      const e = this.estacoes.get(i.itemId);
      if (!e) continue;
      (grupos.get(i.etapaId) ?? grupos.set(i.etapaId, { nome: i.etapa, ests: [] }).get(i.etapaId)!).ests.push(e);
    }
    const corredor = 1.6, margem = 0.7, titulo = 0.6, folga = 0.5, entreFilas = 1.1;
    const medidas = new Map<string, THREE.Box3>();
    let area = 0;
    for (const e of this.estacoes.values()) {
      e.grupo.position.set(0, 0, 0);
      if (deposito) this.porSuporte(e);
      const bb = caixa(e.grupo);
      medidas.set(e.itemId, bb);
      const t = bb.getSize(new THREE.Vector3());
      area += (Math.max(t.x, 1.4) + folga) * (Math.max(t.z, 1) + entreFilas);
    }
    // Curva ABC pelo custo: a cor da placa mostra o peso de cada entrada no orçamento.
    const custos = itens.map((i) => ({ id: i.itemId, c: i.pecas.reduce((t, p) => t + (p.custo ?? 0), 0) })).sort((a, b) => b.c - a.c);
    const total = custos.reduce((t, c) => t + c.c, 0);
    const classe = new Map<string, "a" | "b" | "c">();
    let acumulado = 0;
    for (const c of custos) { classe.set(c.id, total <= 0 || c.c <= 0 ? "c" : acumulado < total * 0.8 ? "a" : acumulado < total * 0.95 ? "b" : "c"); acumulado += c.c; }

    const limite = Math.max(deposito ? 13.2 : 9, Math.sqrt(area) * 1.7);
    let z = 0, largura = deposito ? 13.2 : 0;
    const blocos: { z0: number; z1: number; nome: string }[] = [];
    for (const { nome, ests } of grupos.values()) {
      const z0 = z;
      const tams = ests.map((e) => medidas.get(e.itemId)!.getSize(new THREE.Vector3()));
      const ordenadas = tams.map((t) => t.x).sort((a, b) => a - b);
      const U = Math.max(2, Math.min(3.2, ordenadas[Math.floor(ordenadas.length / 2)] + folga));
      const colunas = Math.max(3, Math.floor((limite - margem * 2) / U));
      let col = 0, zf = z + margem + titulo, prof = 0, maxX = 0;
      let fila: { e: Estacao; cx: number; frente: number }[] = [];
      const fechar = () => {
        for (const { e, cx, frente } of fila) this.placa(e, porId.get(e.itemId)!, cx, zf + frente + 0.12, deposito, classe.get(e.itemId) ?? "c");
        fila = [];
      };
      ests.forEach((e, k) => {
        const bb = medidas.get(e.itemId)!, t = tams[k];
        const n = Math.max(1, Math.ceil((t.x + folga * 0.5) / U));
        if (col > 0 && col + n > colunas) { fechar(); zf += prof + entreFilas; col = 0; prof = 0; }
        const cx = margem + (col + n / 2) * U;
        e.grupo.position.set(cx - (bb.min.x + bb.max.x) / 2, 0, zf - bb.min.z);
        col += n;
        maxX = Math.max(maxX, col * U);
        prof = Math.max(prof, t.z);
        fila.push({ e, cx, frente: t.z });
      });
      fechar();
      const z1 = zf + prof + 0.75 + margem * 0.4;
      blocos.push({ z0, z1, nome });
      largura = Math.max(largura, maxX + margem * 2);
      z = z1 + corredor;
    }
    const fim = z - corredor;
    if (deposito && blocos.length) {
      // Pátio: piso próprio, com faixa de contêineres ao fundo e folga na entrada.
      const p = { x0: -1.4, x1: largura + 1.4, z0: -5.2, z1: fim + 3.2 };
      this.patio = p;
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), new THREE.MeshStandardMaterial({ map: this.texturaEscalada(this.texPatio, (p.x1 - p.x0) / 3, (p.z1 - p.z0) / 3), roughness: 1 }));
      piso.rotation.x = -Math.PI / 2;
      piso.position.set((p.x0 + p.x1) / 2, 0.002, (p.z0 + p.z1) / 2);
      piso.receiveShadow = true;
      this.areas.add(piso);
    }
    for (const b of blocos) {
      const w = largura, d = b.z1 - b.z0;
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: this.texturaEscalada(this.texConcreto, w / 3, d / 3), roughness: 0.95 }));
      piso.rotation.x = -Math.PI / 2;
      piso.position.set(w / 2, 0.005, b.z0 + d / 2);
      piso.receiveShadow = true;
      const borda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)), new THREE.LineBasicMaterial({ color: 0xf28c28 }));
      borda.rotation.x = -Math.PI / 2;
      borda.position.set(w / 2, 0.009, b.z0 + d / 2);
      const el = document.createElement("div");
      el.className = "v3d-area-titulo";
      el.textContent = b.nome;
      const t = new CSS2DObject(el);
      t.position.set(0.15, 0.01, b.z0 + 0.15);
      t.center.set(0, 0);
      this.areas.add(piso, borda, t);
    }
    if (!this.areas.parent) this.raiz.add(this.areas);
    this.centralizarRaiz();
  }

  /** Põe a peça da entrada do depósito no suporte certo (palete, cavalete, estante, baia ou vaga). */
  private porSuporte(e: Estacao) {
    const l = e.pecas[0];
    if (!l) return;
    l.grupo.position.y = 0;
    const bb = caixa(l.grupo);
    if (bb.isEmpty()) return;
    const t = bb.getSize(new THREE.Vector3());
    const { grupo, elevacao } = criarSuporte(tipoSuporte(l.peca, t), t);
    grupo.position.set((bb.min.x + bb.max.x) / 2, 0, (bb.min.z + bb.max.z) / 2);
    e.grupo.add(grupo);
    e.grupo.userData.suporte = grupo;
    l.grupo.position.y = elevacao;
  }

  private tirarSuporte(e: Estacao) {
    const sup = e.grupo.userData.suporte as THREE.Group | undefined;
    if (sup) { e.grupo.remove(sup); e.grupo.userData.suporte = undefined; }
    for (const l of e.pecas) l.grupo.position.y = 0;
    if (e.rotulo) { e.rotulo.removeFromParent(); e.rotulo.element.remove(); e.rotulo = undefined; }
  }

  /** Placa da vaga: no depósito, nome, quantidade e valor; no serviço montado, o número do item. */
  private placa(e: Estacao, item: CenaItem, x: number, z: number, deposito: boolean, classe: "a" | "b" | "c") {
    const el = document.createElement("button");
    el.type = "button";
    el.title = item.descricao;
    if (deposito) {
      const p = item.pecas[0];
      const custo = item.pecas.reduce((t, c) => t + (c.custo ?? 0), 0);
      el.className = `v3d-marcador v3d-placa v3d-placa-${classe}`;
      const nome = document.createElement("b");
      const curto = p?.papel === "mao_de_obra" ? p.nome.split(":")[0] : item.descricao.toLowerCase();
      nome.textContent = curto.charAt(0).toUpperCase() + curto.slice(1);
      const qtd = document.createElement("span");
      qtd.textContent = item.numero;
      const valor = document.createElement("i");
      valor.textContent = custo > 0 ? reais(custo) : "";
      el.append(qtd, nome, valor);
    } else {
      el.className = "v3d-marcador";
      el.textContent = item.numero;
    }
    el.addEventListener("click", () => this.opcoes.onSelecionar?.(item.itemId));
    const obj = new CSS2DObject(el);
    obj.position.set(x, 0.02, z);
    obj.center.set(0.5, 0);
    this.areas.add(obj);
    e.rotulo = obj;
  }

  /** Tapume em volta do pátio, entrada na frente e contêineres de almoxarifado e escritório ao fundo. */
  private async montarEntorno(versao: number) {
    const p = this.patio;
    if (!p) return;
    let modelos: GLTF[];
    try { modelos = await Promise.all(["SER-TAP-001", "SER-CNT-002", "SER-CNT-001"].map((c) => carregar(urlModelo(c, true)))); } catch { return; }
    if (versao !== this.versao || this.patio !== p) return;
    const [tapume, almox, escritorio] = modelos.map((m) => m.scene);
    const g = new THREE.Group();
    const modulo = Math.max(1, caixa(tapume).getSize(new THREE.Vector3()).x);
    const cerca = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / modulo));
      for (let i = 0; i < n; i++) {
        const c = tapume.clone(true);
        prepararSombras(c);
        const f = (i + 0.5) / n;
        c.position.set(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f);
        c.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
        c.scale.x = len / (n * modulo);
        g.add(c);
      }
    };
    const w = p.x1 - p.x0;
    cerca(p.x0, p.z0, p.x1, p.z0);
    cerca(p.x0, p.z0, p.x0, p.z1);
    cerca(p.x1, p.z0, p.x1, p.z1);
    // Frente aberta no meio: a entrada do canteiro, com dois pilares.
    const aba = Math.max(modulo, w * 0.2);
    cerca(p.x0, p.z1, p.x0 + aba, p.z1);
    cerca(p.x1 - aba, p.z1, p.x1, p.z1);
    for (const x of [p.x0 + aba, p.x1 - aba]) bloco(g, MAT_ACO, 0.16, 2.7, 0.16, x, 0, p.z1);
    const por = (m: THREE.Object3D, x: number) => {
      const c = m.clone(true);
      prepararSombras(c);
      const t = caixa(m).getSize(new THREE.Vector3());
      c.position.set(x + (x < (p.x0 + p.x1) / 2 ? t.x / 2 : -t.x / 2), 0, p.z0 + 0.9 + t.z / 2);
      g.add(c);
    };
    por(almox, p.x0 + 1);
    if (w > 15) por(escritorio, p.x1 - 1);
    this.areas.add(g);
  }

  private texturaEscalada(t: THREE.Texture, u: number, v: number) {
    const c = t.clone();
    c.repeat.set(u, v);
    c.needsUpdate = true;
    return c;
  }

  private limparAreas() {
    for (const o of [...this.areas.children]) {
      this.areas.remove(o);
      const m = o as THREE.Mesh;
      if (m.geometry !== CUBO) m.geometry?.dispose();
      const mm = m.material as THREE.MeshStandardMaterial | undefined;
      if (mm?.map && mm.map !== this.texPatio && mm.map !== this.texConcreto) mm.map.dispose();
      mm?.dispose?.();
      if (o instanceof CSS2DObject) o.element.remove();
    }
  }

  private centralizarRaiz() {
    const bb = caixa(this.raiz);
    if (!bb.isEmpty()) {
      const c = bb.getCenter(new THREE.Vector3());
      this.raiz.position.x -= c.x; this.raiz.position.z -= c.z;
    }
  }


  private ajustarChao() {
    const bb = caixa(this.raiz);
    const tam = bb.isEmpty() ? new THREE.Vector3(4, 1, 4) : bb.getSize(new THREE.Vector3());
    const s = this.sol.shadow.camera;
    const m = Math.max(tam.x, tam.z, tam.y) * 0.75 + 2;
    s.left = -m; s.right = m; s.top = m; s.bottom = -m; s.near = 0.1; s.far = m * 7;
    this.alcanceSol = m;
    this.posicionarSol();
    s.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  // Câmera
  // -------------------------------------------------------------------------
  private enquadrar(o: THREE.Object3D, imediato: boolean) {
    const bb = caixa(o);
    if (bb.isEmpty()) return;
    const centro = bb.getCenter(new THREE.Vector3());
    const tam = bb.getSize(new THREE.Vector3());
    // Distância para caber na tela: largura e profundidade pesam mais que a altura.
    const raio = Math.max(0.35, Math.hypot(tam.x, tam.z, tam.y * 0.6) / 2);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hfov = Math.atan(Math.tan(vfov) * this.camera.aspect);
    const geral = o === this.raiz && this.estacoes.size > 1;
    const dist = (raio / Math.sin(Math.min(vfov, hfov))) * (geral ? 0.76 : 1.05);
    // Visão geral do canteiro mais de cima, como a planta de um depósito.
    const dir = (geral ? new THREE.Vector3(0.25, 0.95, 1) : new THREE.Vector3(0.55, 0.5, 1)).normalize();
    const destinoCam = centro.clone().add(dir.multiplyScalar(dist));
    centro.y = Math.max(centro.y * 0.8, 0.1);
    if (imediato || reduzirMovimento()) {
      this.camera.position.copy(destinoCam);
      this.controles.target.copy(centro);
      return;
    }
    const c0 = this.camera.position.clone(), t0 = this.controles.target.clone();
    this.tarefa(800, (t) => {
      const k = suave(t);
      this.camera.position.lerpVectors(c0, destinoCam, k);
      this.controles.target.lerpVectors(t0, centro, k);
    });
  }

  focar(itemId: string, imediato = false) {
    const e = this.estacoes.get(itemId);
    if (e) this.enquadrar(e.grupo, imediato);
    for (const [id, est] of this.estacoes) est.rotulo?.element.classList.toggle("v3d-marcador-ativo", id === itemId);
  }

  centralizar() { this.enquadrar(this.raiz, false); }

  // -------------------------------------------------------------------------
  // Animações de entrada
  // -------------------------------------------------------------------------
  tocar(itemId?: string) {
    const lista = itemId ? [this.estacoes.get(itemId)].filter((e): e is Estacao => !!e) : [...this.estacoes.values()];
    lista.forEach((e) => this.tocarEstacao(e));
  }

  private tocarEstacao(e: Estacao) {
    for (const { peca, grupo } of e.pecas) {
      if (peca.video) this.tocarVideo(peca, grupo);
      else if (peca.visual.tipo === "kit") this.tocarMontagem(grupo);
      else if (peca.visual.tipo === "pilha") this.tocarQueda(grupo, 0);
      else if (peca.animado) void this.tocarGravada(peca, grupo);
      else if (peca.visual.tipo === "monte") this.surgirMonte(peca, grupo);
      else this.surgir(grupo);
    }
  }

  /** Kit montado etapa por etapa (tipo G). */
  private tocarMontagem(grupo: THREE.Group) {
    const kits = corpo(grupo).children;
    const total = Math.max(1, Math.max(...kits.map(etapasDoKit)));
    const porEtapa = 650;
    this.tarefa(porEtapa * total, (t) => {
      const pos = t * total;
      const etapa = Math.min(total, Math.floor(pos) + 1);
      kits.forEach((k) => aplicarEtapa(k, t >= 1 ? Infinity : etapa, pos - (etapa - 1)));
    }, () => kits.forEach((k) => aplicarEtapa(k, Infinity)));
  }

  /** Peças da pilha caem uma a uma a partir da posição `desde`. */
  private tocarQueda(grupo: THREE.Group, desde: number) {
    const cair = grupo.userData.cair as Queda | undefined;
    if (!cair) return;
    const animar = this.opcoes.animacoes && !reduzirMovimento();
    const q = cair(desde, animar ? (p, v) => this.poeira(p, v) : undefined);
    if (!q) return;
    if (!animar) { q.quadro(1); return; }
    this.tarefa(q.segundos * 1000, q.quadro, () => q.quadro(1));
  }

  /** Poeira levantada no impacto: sobe, espalha e some. */
  private poeira(p: THREE.Vector3, velocidade: number, cor = 0xcdbb9c) {
    const n = Math.round(8 + Math.min(14, velocidade * 2));
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, r = 0.05 + Math.random() * 0.2, f = 0.4 + Math.random() * 0.9;
      pos.set([p.x + Math.cos(ang) * r, p.y + 0.03, p.z + Math.sin(ang) * r], i * 3);
      vel.set([Math.cos(ang) * f, 0.25 + Math.random() * 0.6, Math.sin(ang) * f], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: this.grao, color: cor, size: 0.3, transparent: true, opacity: 0.45, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.cena.add(pts);
    let antes = 0;
    this.tarefa(950, (t) => {
      const dt = (t - antes) * 0.95; antes = t;
      for (let i = 0; i < n * 3; i += 3) {
        pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt;
        const freio = 1 - Math.min(1, 3 * dt);
        vel[i] *= freio; vel[i + 1] = vel[i + 1] * freio - 0.3 * dt; vel[i + 2] *= freio;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.45 * (1 - t);
      mat.size = 0.3 + 0.6 * t;
    }, () => { this.cena.remove(pts); geo.dispose(); mat.dispose(); });
  }

  /** Grãos escorrendo sobre o monte (areia, brita, terra) enquanto ele cresce. */
  private despejar(g: THREE.Object3D, topo: number, raio: number, ms: number, cor: number) {
    const n = 220, hq = 1.3, tq = Math.sqrt((2 * hq) / G), dur = ms / 1000;
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: this.grao, color: cor, size: Math.max(0.035, raio * 0.07), transparent: true, alphaTest: 0.3 });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    g.add(pts);
    this.tarefa(ms, (t) => {
      const tau = t * dur;
      for (let i = 0; i < n; i++) {
        const idade = ((tau / tq + acaso(i, 7)) % 1) * tq;
        const ativo = tau - idade >= 0 && tau - idade < dur - tq;
        const ang = acaso(i, 8) * Math.PI * 2, abre = (0.03 + acaso(i, 9) * 0.1) * raio;
        const esp = abre * (1 + (idade / tq) * 2.2);
        pos.set(ativo ? [Math.cos(ang) * esp, topo + hq - (G * idade * idade) / 2, Math.sin(ang) * esp] : [0, -50, 0], i * 3);
      }
      geo.attributes.position.needsUpdate = true;
    }, () => { g.remove(pts); geo.dispose(); mat.dispose(); });
  }

  /** Monte sem animação gravada: cresce enquanto os grãos escorrem. */
  private surgirMonte(peca: Peca, grupo: THREE.Group) {
    const c = corpo(grupo);
    c.scale.setScalar(1);
    const t = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());
    this.despejar(grupo, t.y, Math.max(t.x, t.z) / 2, 1700, corDoGranel(peca.origem));
    this.tarefa(1700, (f) => c.scale.setScalar(Math.max(1e-3, Math.cbrt(suave(f)))), () => c.scale.setScalar(1));
  }


  private surgir(grupo: THREE.Group) {
    const c = corpo(grupo);
    this.tarefa(700, (t) => c.scale.setScalar(Math.max(1e-3, suave(t))), () => c.scale.setScalar(1));
  }

  /** Animação gravada no Blender (_anim.glb): toca uma vez e devolve a peça montada. */
  private async tocarGravada(peca: Peca, grupo: THREE.Group) {
    let gltf: GLTF;
    try { gltf = await carregar(urlAnimacao(peca.codigo)); } catch { this.surgir(grupo); return; }
    if (!gltf.animations.length) { this.surgir(grupo); return; }
    const cena = gltf.scene.clone(true);
    prepararSombras(cena);
    const ancora = new THREE.Group();
    const bb = caixa(grupo);
    const pai = grupo.parent!;
    ancora.position.set((bb.min.x + bb.max.x) / 2 - pai.getWorldPosition(new THREE.Vector3()).x, grupo.position.y, (bb.min.z + bb.max.z) / 2 - pai.getWorldPosition(new THREE.Vector3()).z);
    if (peca.visual.tipo === "monte") cena.scale.setScalar(peca.visual.escala);
    ancora.add(cena);
    pai.add(ancora);
    const c = corpo(grupo);
    c.visible = false;
    const mixer = new THREE.AnimationMixer(cena);
    let dur = 0;
    for (const clip of gltf.animations) {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      dur = Math.max(dur, clip.duration);
    }
    this.mixers.add(mixer);
    window.setTimeout(() => {
      this.mixers.delete(mixer);
      mixer.stopAllAction();
      pai.remove(ancora);
      c.visible = true;
    }, Math.min(6000, dur * 1000 + 150));
  }

  /** Líquidos (concreto, tinta, emulsão): vídeo com fundo transparente gravado no Blender. */
  private tocarVideo(peca: Peca, grupo: THREE.Group) {
    const video = document.createElement("video");
    video.src = urlVideo(peca.codigo);
    video.muted = true; video.playsInline = true; video.crossOrigin = "anonymous";
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bb = caixa(grupo);
    const alt = Math.max(1, (bb.max.y - bb.min.y) * 2.2);
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(alt * 16 / 9, alt), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    const pai = grupo.parent!;
    plano.position.set((bb.min.x + bb.max.x) / 2 - pai.getWorldPosition(new THREE.Vector3()).x, alt / 2, (bb.min.z + bb.max.z) / 2 - pai.getWorldPosition(new THREE.Vector3()).z);
    const c = corpo(grupo);
    c.visible = false;
    pai.add(plano);
    const olhar = () => plano.quaternion.copy(this.camera.quaternion);
    const t = this.tarefa(8000, olhar);
    const fim = () => {
      this.tarefas.delete(t);
      pai.remove(plano); plano.geometry.dispose(); (plano.material as THREE.Material).dispose(); tex.dispose();
      video.removeAttribute("src"); video.load();
      c.visible = true;
      this.surgir(grupo);
    };
    video.addEventListener("ended", fim, { once: true });
    video.addEventListener("error", fim, { once: true });
    video.play().catch(fim);
  }

  // -------------------------------------------------------------------------
  // Limpeza
  // -------------------------------------------------------------------------
  private descartar(e: Estacao) {
    e.grupo.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
    e.grupo.removeFromParent();
    // Geometrias e materiais são compartilhados com o cache dos modelos: só as instâncias são liberadas.
    e.grupo.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
  }

  private limpar() {
    for (const e of this.estacoes.values()) this.descartar(e);
    this.estacoes.clear();
    this.visuais.clear();
  }

  destruir() {
    cancelAnimationFrame(this.quadro);
    this.observador.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.aoApertar);
    this.renderer.domElement.removeEventListener("pointerup", this.aoSoltar);
    this.limpar();
    this.controles.dispose();
    this.compositor?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.rotulos.domElement.remove();
  }
}

export function reduzirMovimento() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function suporteWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

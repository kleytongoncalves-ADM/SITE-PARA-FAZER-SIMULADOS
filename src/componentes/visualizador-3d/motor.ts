/**
 * Motor do visualizador 3D (Three.js). Recebe a cena já calculada no servidor (cena-3d.ts) e cuida só de desenhar:
 * carrega os modelos da biblioteca, monta pilhas, montes, kits e equipes, toca as animações gravadas no Blender
 * e anima as mudanças de quantidade.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
function montarPilha(modelo: THREE.Object3D, n: number, arranjo: string, aparecerDesde = n): { grupo: THREE.Group; aparecer: (t: number) => void } {
  const grupo = new THREE.Group();
  const tam = caixa(modelo).getSize(new THREE.Vector3());
  const posicoes = posicoesPilha(n, tam, arranjo);
  const malhas: { malha: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  let temInstancias = false;
  modelo.updateMatrixWorld(true);
  modelo.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) temInstancias = true; });

  if (temInstancias) {
    // Modelos com instâncias próprias (brita, pregos) são clonados inteiros.
    posicoes.forEach((p) => { const c = modelo.clone(true); c.applyMatrix4(p); grupo.add(c); });
    return { grupo, aparecer: () => {} };
  }
  modelo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const inst = new THREE.InstancedMesh(m.geometry, m.material, posicoes.length);
    inst.castShadow = true; inst.receiveShadow = true;
    const local = m.matrixWorld.clone();
    posicoes.forEach((p, i) => inst.setMatrixAt(i, p.clone().multiply(local)));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    grupo.add(inst);
    malhas.push({ malha: inst, local });
  });

  const aparecer = (t: number) => {
    // Peças novas descem de 40 cm acima, uma camada depois da outra.
    const novas = posicoes.length - aparecerDesde;
    if (novas <= 0) return;
    const tmp = new THREE.Matrix4();
    for (let i = aparecerDesde; i < posicoes.length; i++) {
      const fase = suave((t * (novas + 4) - (i - aparecerDesde)) / 4);
      tmp.makeTranslation(0, (1 - fase) * 0.4, 0).multiply(posicoes[i]).multiply(new THREE.Matrix4().makeScale(fase || 1e-4, fase || 1e-4, fase || 1e-4));
      for (const { malha, local } of malhas) malha.setMatrixAt(i, tmp.clone().multiply(local));
    }
    for (const { malha } of malhas) malha.instanceMatrix.needsUpdate = true;
  };
  return { grupo, aparecer };
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
  private cena = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controles: OrbitControls;
  private relogio = new THREE.Timer();
  private mixers = new Set<THREE.AnimationMixer>();
  private tarefas = new Set<Tarefa>();
  private estacoes = new Map<string, Estacao>();
  private raiz = new THREE.Group();
  private chao: THREE.Mesh;
  private grade: THREE.GridHelper;
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

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.cena.environmentIntensity = 0.75;
    pmrem.dispose();
    this.cena.add(new THREE.HemisphereLight(0xdff3f6, 0x40362c, 0.5));
    this.sol = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sol.position.set(6, 10, 5);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.02;
    this.cena.add(this.sol, this.sol.target);

    this.chao = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.receiveShadow = true;
    this.cena.add(this.chao);
    this.grade = new THREE.GridHelper(1, 1);
    this.cena.add(this.grade);
    this.aplicarTema(opcoes.escuro);
    this.cena.add(this.raiz);

    this.renderer.domElement.addEventListener("pointerdown", this.aoApertar);
    this.renderer.domElement.addEventListener("pointerup", this.aoSoltar);
    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    this.redimensionar();
    this.laco();
  }

  aplicarTema(escuro: boolean) {
    this.opcoes.escuro = escuro;
    (this.chao.material as THREE.MeshStandardMaterial).color.set(escuro ? 0x1b2a30 : 0xc7d2d2);
    const mats = (Array.isArray(this.grade.material) ? this.grade.material : [this.grade.material]) as THREE.LineBasicMaterial[];
    mats.forEach((m) => { m.color.set(escuro ? 0x3c6670 : 0x8fb3ba); m.transparent = true; m.opacity = escuro ? 0.35 : 0.45; m.depthWrite = false; });
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
    this.renderer.render(this.cena, this.camera);
    this.rotulos.render(this.cena, this.camera);
  };

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
  async definirCena(itens: CenaItem[], modo: ModoCena, o: { foco?: string | null; animar?: Set<string>; materiais?: boolean } = {}) {
    const versao = ++this.versao;
    const leve = modo === "canteiro" && itens.length > 1;
    const recomecar = modo !== this.ultimoModo;
    this.ultimoModo = modo;
    if (recomecar) this.limpar();

    const ids = new Set(itens.map((i) => i.itemId));
    for (const [id, e] of this.estacoes) if (!ids.has(id)) { this.descartar(e); this.estacoes.delete(id); }

    const montadas = await Promise.all(itens.map(async (item) => {
      const pecas = this.pecasVisiveis(item, modo, o.materiais);
      const anterior = this.estacoes.get(item.itemId);
      const assinatura = pecas.map((p) => this.chave(p, leve)).join(";");
      if (anterior && anterior.grupo.userData.assinatura === assinatura) return anterior;
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
    this.ajustarChao();
    // Enquadra antes de animar: a animação de entrada encolhe ou esconde as peças.
    const foco = o.foco && this.estacoes.has(o.foco) ? o.foco : null;
    if (foco && modo === "canteiro") this.focar(foco, recomecar);
    else this.enquadrar(this.raiz, recomecar || this.estacoes.size <= 1);
    for (const e of montadas) {
      if (o.animar?.has(e.itemId) && this.opcoes.animacoes && !reduzirMovimento()) this.tocarEstacao(e);
    }
  }

  private pecasVisiveis(item: CenaItem, modo: ModoCena, materiais?: boolean): Peca[] {
    const kit = item.pecas.find((p) => p.papel === "kit");
    const outras = item.pecas.filter((p) => p.papel !== "kit");
    if (!kit) return outras;
    const mostrarMateriais = modo === "item" ? !!materiais : false;
    return mostrarMateriais ? outras : [kit, ...outras.filter((p) => p.papel !== "material")];
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
      if (de !== v.escala) this.tarefa(600, (t) => modelo.scale.setScalar(de + (v.escala - de) * suave(t)));
      else modelo.scale.setScalar(v.escala);
    } else if (v.tipo === "pilha") {
      const desde = antes?.tipo === "pilha" ? Math.min(antes.visiveis, v.visiveis) : v.visiveis;
      const { grupo, aparecer } = montarPilha(modelo, v.visiveis, v.arranjo, desde);
      g.add(grupo);
      if (desde < v.visiveis) this.tarefa(600, aparecer); else aparecer(1);
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
  private dispor(itens: CenaItem[], modo: ModoCena) {
    this.raiz.position.set(0, 0, 0);
    const porEtapa = new Map<string, CenaItem[]>();
    for (const i of itens) (porEtapa.get(i.etapaId) ?? porEtapa.set(i.etapaId, []).get(i.etapaId)!).push(i);
    const vao = modo === "canteiro" ? 1.4 : 0;
    const medidas = new Map<string, THREE.Box3>();
    let area = 0;
    for (const e of this.estacoes.values()) {
      e.grupo.position.set(0, 0, 0);
      const bb = caixa(e.grupo);
      medidas.set(e.itemId, bb);
      const t = bb.getSize(new THREE.Vector3());
      area += (Math.max(t.x, 1) + vao) * (Math.max(t.z, 1) + vao);
    }
    // Largura máxima de uma fila: o canteiro fica perto de um quadrado.
    const limite = Math.max(8, Math.sqrt(area) * 1.4);
    const filas: Estacao[][] = [];
    let z = 0;
    for (const lista of porEtapa.values()) {
      const ests = lista.map((i) => this.estacoes.get(i.itemId)).filter((e): e is Estacao => !!e);
      let fila: Estacao[] = [], x = 0, prof = 0;
      const fechar = () => {
        if (!fila.length) return;
        const largura = x - vao;
        fila.forEach((e) => { e.grupo.position.x -= largura / 2; e.grupo.position.z += z; });
        filas.push(fila);
        z += Math.max(prof, 1) + vao + 0.6;
        fila = []; x = 0; prof = 0;
      };
      for (const e of ests) {
        const bb = medidas.get(e.itemId)!;
        const t = bb.getSize(new THREE.Vector3());
        if (fila.length && x + t.x > limite) fechar();
        e.grupo.position.set(x - bb.min.x, 0, -bb.min.z);
        x += Math.max(t.x, 0.8) + vao;
        prof = Math.max(prof, t.z);
        fila.push(e);
        if (modo === "canteiro") this.rotuloEstacao(e, itens.find((i) => i.itemId === e.itemId)!, bb);
      }
      fechar();
      z += 1;
    }
    const bb = caixa(this.raiz);
    if (!bb.isEmpty()) {
      const c = bb.getCenter(new THREE.Vector3());
      this.raiz.position.set(-c.x, 0, -c.z);
    }
  }

  private rotuloEstacao(e: Estacao, item: CenaItem, bb: THREE.Box3) {
    if (e.rotulo) { e.grupo.remove(e.rotulo); e.rotulo.element.remove(); }
    const el = document.createElement("button");
    el.type = "button";
    el.className = "v3d-marcador";
    el.textContent = item.numero;
    el.title = item.descricao;
    el.addEventListener("click", () => this.opcoes.onSelecionar?.(item.itemId));
    const obj = new CSS2DObject(el);
    obj.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + 0.15, (bb.min.z + bb.max.z) / 2);
    obj.center.set(0.5, 1);
    e.grupo.add(obj);
    e.rotulo = obj;
  }

  private ajustarChao() {
    const bb = caixa(this.raiz);
    const tam = bb.isEmpty() ? new THREE.Vector3(4, 1, 4) : bb.getSize(new THREE.Vector3());
    const r = Math.max(4, Math.hypot(tam.x, tam.z) * 0.75 + 2);
    this.chao.scale.setScalar(r);
    this.cena.remove(this.grade);
    this.grade.geometry.dispose();
    const passo = r > 40 ? 5 : 1;
    this.grade = new THREE.GridHelper(Math.ceil((r * 2) / passo) * passo, Math.ceil((r * 2) / passo));
    this.grade.position.y = 0.001;
    this.cena.add(this.grade);
    this.aplicarTema(this.opcoes.escuro);
    const s = this.sol.shadow.camera;
    const m = Math.max(tam.x, tam.z, tam.y) * 0.75 + 2;
    s.left = -m; s.right = m; s.top = m; s.bottom = -m; s.near = 0.1; s.far = m * 6;
    this.sol.position.set(m * 0.6, m * 1.6, m * 0.9);
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
    const dist = (raio / Math.sin(Math.min(vfov, hfov))) * (o === this.raiz && this.estacoes.size > 1 ? 0.8 : 1.05);
    const dir = new THREE.Vector3(0.55, 0.5, 1).normalize();
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
      else if (peca.animado) void this.tocarGravada(peca, grupo);
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
    ancora.position.set((bb.min.x + bb.max.x) / 2 - pai.getWorldPosition(new THREE.Vector3()).x, 0, (bb.min.z + bb.max.z) / 2 - pai.getWorldPosition(new THREE.Vector3()).z);
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

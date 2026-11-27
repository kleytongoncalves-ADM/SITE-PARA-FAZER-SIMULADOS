/**
 * Modelo 3D leve de um arquivo IFC, para a vista 3D do orçamento.
 *
 * A geometria é reunida por grupo de quantitativo (classe, tipo e material), que é a mesma
 * unidade que se lança no orçamento. Assim cada item lançado sabe quais elementos do projeto
 * representa. As posições são guardadas em 16 bits dentro da caixa do modelo e o conjunto é
 * compactado; o arquivo IFC em si não é guardado.
 */
import type { IfcAPI } from "web-ifc";

export type GrupoModelo = {
  /** Ordem do quantitativo na leitura (ifc_quantitativo.ordem). */
  ordem: number;
  /** Cor do arquivo, de 0 a 1, com opacidade. */
  cor: [number, number, number, number];
  /** x, y, z em metros, com Y para cima, a partir do canto mínimo do modelo. */
  posicoes: Float32Array;
  indices: Uint32Array;
};
export type Modelo = { tamanho: [number, number, number]; grupos: GrupoModelo[] };

export const LIMITE_VERTICES = 4_000_000;
/** Cada parte cabe em uma chamada ao servidor e no limite por arquivo do armazenamento. */
export const TAMANHO_DA_PARTE = 3_500_000;
export const LIMITE_DE_PARTES = 8;
const MARCA = 0x33564943; // "CIV3"

/** Lê a geometria dos elementos e reúne por grupo. `grupoDoElemento` vem da leitura de quantitativos. */
export function extrairModelo(api: IfcAPI, m: number, grupoDoElemento: Map<number, number>): { modelo: Modelo | null; aviso: string | null } {
  type Acumulado = { cor: [number, number, number, number] | null; pos: number[]; ind: number[] };
  const porGrupo = new Map<number, Acumulado>();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0, cortado = false;

  for (const [id, ordem] of grupoDoElemento) {
    if (vertices > LIMITE_VERTICES) { cortado = true; break; }
    let malha: ReturnType<IfcAPI["GetFlatMesh"]>;
    try { malha = api.GetFlatMesh(m, id); } catch { continue; }
    if (!malha) continue;
    let g = porGrupo.get(ordem);
    if (!g) { g = { cor: null, pos: [], ind: [] }; porGrupo.set(ordem, g); }
    for (let i = 0; i < malha.geometries.size(); i++) {
      const pg = malha.geometries.get(i);
      const geo = api.GetGeometry(m, pg.geometryExpressID);
      const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
      const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
      const t = pg.flatTransformation;
      const base = g.pos.length / 3;
      for (let k = 0; k + 5 < v.length; k += 6) {
        const x = v[k], y = v[k + 1], z = v[k + 2];
        const p = [t[0] * x + t[4] * y + t[8] * z + t[12], t[1] * x + t[5] * y + t[9] * z + t[13], t[2] * x + t[6] * y + t[10] * z + t[14]];
        if (!Number.isFinite(p[0] + p[1] + p[2])) { p[0] = p[1] = p[2] = 0; }
        for (let d = 0; d < 3; d++) { if (p[d] < min[d]) min[d] = p[d]; if (p[d] > max[d]) max[d] = p[d]; }
        g.pos.push(p[0], p[1], p[2]);
      }
      for (let k = 0; k < ix.length; k++) g.ind.push(base + ix[k]);
      vertices += v.length / 6;
      const c = pg.color;
      if (c && (!g.cor || (g.cor[3] < 0.99 && c.w >= 0.99))) g.cor = [c.x, c.y, c.z, c.w];
      geo.delete();
    }
    malha.delete?.();
  }

  const grupos: GrupoModelo[] = [];
  for (const [ordem, g] of [...porGrupo].sort((a, b) => a[0] - b[0])) {
    if (!g.ind.length) continue;
    const posicoes = new Float32Array(g.pos.length);
    for (let k = 0; k < g.pos.length; k++) posicoes[k] = g.pos[k] - min[k % 3];
    grupos.push({ ordem, cor: g.cor ?? [0.8, 0.8, 0.8, 1], posicoes, indices: Uint32Array.from(g.ind) });
  }
  if (!grupos.length) return { modelo: null, aviso: "O arquivo não traz geometria para a vista 3D." };
  return {
    modelo: { tamanho: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], grupos },
    aviso: cortado ? "Modelo muito detalhado: a vista 3D mostra só parte dos elementos." : null,
  };
}

/** Empacota o modelo: cabeçalho em JSON e, por grupo, posições em 16 bits e índices em 32 bits. */
export function empacotarModelo(modelo: Modelo): Uint8Array {
  const cab = new TextEncoder().encode(JSON.stringify({
    v: 1, tamanho: modelo.tamanho,
    grupos: modelo.grupos.map((g) => ({ ordem: g.ordem, cor: g.cor.map((x) => Math.round(x * 1000) / 1000), vertices: g.posicoes.length / 3, indices: g.indices.length })),
  }));
  const alinhar = (n: number) => (n + 3) & ~3;
  let total = 8 + alinhar(cab.length);
  for (const g of modelo.grupos) total += alinhar(g.posicoes.length * 2) + g.indices.length * 4;
  const saida = new Uint8Array(total);
  const dv = new DataView(saida.buffer);
  dv.setUint32(0, MARCA, true); dv.setUint32(4, cab.length, true);
  saida.set(cab, 8);
  let p = 8 + alinhar(cab.length);
  const escala = modelo.tamanho.map((t) => (t > 1e-9 ? 65535 / t : 0));
  for (const g of modelo.grupos) {
    for (let k = 0; k < g.posicoes.length; k++) dv.setUint16(p + k * 2, Math.max(0, Math.min(65535, Math.round(g.posicoes[k] * escala[k % 3]))), true);
    p += alinhar(g.posicoes.length * 2);
    for (let k = 0; k < g.indices.length; k++) dv.setUint32(p + k * 4, g.indices[k], true);
    p += g.indices.length * 4;
  }
  return saida;
}

export function desempacotarModelo(bytes: Uint8Array): Modelo {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 8 || dv.getUint32(0, true) !== MARCA) throw new Error("Modelo 3D inválido.");
  const n = dv.getUint32(4, true);
  const cab = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + n))) as {
    v: number; tamanho: [number, number, number]; grupos: { ordem: number; cor: [number, number, number, number]; vertices: number; indices: number }[];
  };
  const alinhar = (x: number) => (x + 3) & ~3;
  let p = 8 + alinhar(n);
  const passo = cab.tamanho.map((t) => t / 65535);
  const grupos: GrupoModelo[] = [];
  for (const g of cab.grupos) {
    const posicoes = new Float32Array(g.vertices * 3);
    for (let k = 0; k < posicoes.length; k++) posicoes[k] = dv.getUint16(p + k * 2, true) * passo[k % 3];
    p += alinhar(posicoes.length * 2);
    const indices = new Uint32Array(g.indices);
    for (let k = 0; k < g.indices; k++) {
      const i = dv.getUint32(p + k * 4, true);
      if (i >= g.vertices) throw new Error("Modelo 3D inválido.");
      indices[k] = i;
    }
    p += g.indices * 4;
    grupos.push({ ordem: g.ordem, cor: g.cor, posicoes, indices });
  }
  return { tamanho: cab.tamanho, grupos };
}

async function passar(bytes: Uint8Array, fluxo: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const saida = new Blob([bytes as BlobPart]).stream().pipeThrough(fluxo);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}
export const compactar = (bytes: Uint8Array) => passar(bytes, new CompressionStream("gzip"));
export const descompactar = (bytes: Uint8Array) => passar(bytes, new DecompressionStream("gzip"));

export function emPartes(bytes: Uint8Array, tamanho = TAMANHO_DA_PARTE): Uint8Array[] {
  const partes: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += tamanho) partes.push(bytes.subarray(i, Math.min(bytes.length, i + tamanho)));
  return partes;
}

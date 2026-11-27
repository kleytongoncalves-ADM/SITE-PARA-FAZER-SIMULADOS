/**
 * Gera o catálogo da biblioteca 3D (src/dados/biblioteca-3d.json) a partir das fichas JSON
 * exportadas do Blender. Uso: npm run catalogo-3d -- <pasta-das-fichas>
 *
 * Cada modelo recebe o "conteúdo de uma peça" (quanto uma peça visível representa: 0,1 m³ de areia,
 * um saco de 50 kg, uma caixa de 2,16 m², um rolo de 100 m...) e, nos kits, o tamanho do módulo.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Ficha = {
  codigo: string; nome: string; classe: string; animacao: string; unidade?: string;
  dimensoes_m: [number, number, number]; etapas?: string[]; funcao?: string;
  volume_m3?: number; volume_l?: number; massa_kg?: number; metros_rolo?: number; rendimento_m2?: number;
  area_m2?: number; largura_m?: number; altura_m?: number; comprimento_m?: number; diametro_mm?: number;
};

export type ModeloCatalogo = {
  codigo: string; nome: string; classe: string; animacao: string; unidade: string;
  dimensoes: [number, number, number];
  /** Quanto uma peça visível representa, na unidade indicada. */
  conteudo: { valor: number; unidade: string };
  etapas?: string[]; funcao?: string;
  animado: boolean; video: boolean;
};

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Nomes do lote 0 vieram como identificador ("areia-media"). */
const NOMES_LOTE0: Record<string, string> = {
  "ALV-AGR-002": "Areia média (monte 0,1 m³)",
  "ALV-AGR-005": "Brita 1 (monte 0,1 m³)",
  "EST-ACO-002": "Vergalhão CA-50 8 mm (segmento 1 m)",
  "EST-ACO-003": "Vergalhão CA-50 10 mm (segmento 1 m)",
  "EST-ACO-009": "Fio CA-60 5 mm (segmento 1 m)",
  "EST-ARA-001": "Arame recozido 18 BWG (rolo 1 kg)",
  "EST-ARM-001": "Estribo CA-60 5 mm 10 x 10 cm",
  "EST-CIM-001": "Cimento Portland CP II (saco 50 kg)",
  "EST-FOR-003": "Tábua de pinus 2,5 x 30 cm (peça 3 m)",
  "EST-FOR-004": "Sarrafo de pinus 2,5 x 7 cm (peça 3 m)",
  "EST-PRG-002": "Prego 17x27 (12 un)",
};
const UNIDADES_LOTE0: Record<string, string> = {
  "ALV-AGR-002": "m³", "ALV-AGR-005": "m³", "EST-ACO-002": "kg", "EST-ACO-003": "kg", "EST-ACO-009": "kg",
  "EST-ARA-001": "kg", "EST-ARM-001": "un", "EST-CIM-001": "kg", "EST-FOR-003": "m", "EST-FOR-004": "m", "EST-PRG-002": "kg",
};

/** Massa linear do aço (kg/m), NBR 7480. Cada barra vista no feixe representa uma barra de 12 m. */
const MASSA_LINEAR: [RegExp, number][] = [
  [/12,5 mm/, 0.963], [/4,2 mm/, 0.109], [/6,3 mm/, 0.245], [/(?<![\d,])5 mm/, 0.154], [/(?<![\d,])8 mm/, 0.395],
  [/(?<![\d,])10 mm/, 0.617], [/(?<![\d,])16 mm/, 1.578], [/(?<![\d,])20 mm/, 2.466], [/(?<![\d,])25 mm/, 3.853],
];

/** Conferidos à mão: peças em que o nome não diz quanto uma peça representa. */
const CONTEUDO_FIXO: Record<string, [number, string]> = {
  "EST-ARM-004": [9.3, "kg"], "EST-ARM-005": [13.3, "kg"],
  "EST-MET-001": [79.8, "kg"], "EST-MET-002": [18, "kg"], "EST-MET-003": [14.3, "kg"], "EST-MET-004": [9, "kg"],
  "EST-MET-005": [99.7, "kg"], "COB-MET-001": [120, "kg"], "COB-MET-002": [20.4, "kg"],
  "REV-CER-004": [0.09, "m²"], "PAV-GUI-001": [1, "m"], "PAV-GUI-002": [0.8, "m"],
  "ELE-FIO-006": [250, "m"], "ELE-FIO-007": [250, "m"], "ELE-FIO-009": [250, "m"], "ELE-ATR-002": [50, "m"], "ELE-SPD-003": [50, "m"],
  "ALV-DRY-002": [2.16, "m²"], "ALV-DRY-003": [2.16, "m²"], "COB-FIB-004": [2.7, "m²"], "FUN-LAS-003": [100, "m²"],
  "FUN-LAS-002": [0.05, "m³"], "FUN-GAB-001": [2, "m³"], "FUN-GAB-002": [0.46, "m³"],
  "FUN-SAP-001": [0.45, "m³"], "FUN-SAP-002": [0.3, "m³"], "FUN-BLC-001": [0.5, "m³"], "FUN-BLC-002": [1, "m³"], "FUN-BLC-003": [1.6, "m³"],
  "KIT-EST-01": [0.112, "m³"], "KIT-EST-02": [0.18, "m³"], "KIT-FUN-01": [0.45, "m³"], "KIT-FUN-02": [1, "m³"],
};

export function conteudoDaPeca(f: Ficha, nome: string, unidade: string): { valor: number; unidade: string } {
  const n = nome;
  if (f.classe === "granel" || unidade === "m³") {
    if (f.volume_m3) return { valor: f.volume_m3, unidade: "m³" };
    const m = n.match(/(\d+(?:,\d+)?) m³/);
    if (m) return { valor: num(m[1]), unidade: "m³" };
  }
  if (/^EST-ACO|^EST-ARM-00[45]/.test(f.codigo) && unidade === "kg") {
    const ml = MASSA_LINEAR.find(([r]) => r.test(n));
    if (ml) return { valor: Math.round(ml[1] * 12 * 100) / 100, unidade: "kg" };
  }
  if (f.metros_rolo) return { valor: f.metros_rolo, unidade: "m" };
  if (f.rendimento_m2) return { valor: f.rendimento_m2, unidade: "m²" };
  if (f.volume_l && unidade === "L") return { valor: f.volume_l, unidade: "L" };
  if (f.massa_kg) return { valor: f.massa_kg, unidade: "kg" };
  let m = n.match(/caixa (?:de )?(\d+(?:,\d+)?) m²/);
  if (m) return { valor: num(m[1]), unidade: "m²" };
  m = n.match(/caixa com (\d+(?:\.\d+)?) m\b/);
  if (m) return { valor: num(m[1]), unidade: "m" };
  m = n.match(/(?:saco|balde|caixa|bombona|lata|galão|tambor|rolo)\s*(?:de\s*)?(\d+(?:,\d+)?)\s*(kg|L)\b/i);
  if (m) return { valor: num(m[1]), unidade: m[2] === "l" ? "L" : m[2] };
  m = n.match(/(\d+(?:,\d+)?)\s*(kg|L)\)/);
  if (m && (unidade === "kg" || unidade === "L" || unidade === "saco")) return { valor: num(m[1]), unidade: m[2] };
  m = n.match(/rolo (\d+(?:,\d+)?) x (\d+(?:,\d+)?) m/);
  if (m) return { valor: num(m[1]) * num(m[2]), unidade: "m²" };
  m = n.match(/rolo (\d+(?:,\d+)?) m\b|\(rolo (\d+(?:,\d+)?) m\)/);
  if (m) return { valor: num(m[1] ?? m[2]), unidade: "m" };
  if (unidade === "m²") {
    if (f.area_m2) return { valor: f.area_m2, unidade: "m²" };
    if (f.largura_m && f.altura_m) return { valor: Math.round(f.largura_m * f.altura_m * 100) / 100, unidade: "m²" };
    m = n.match(/(\d+(?:,\d+)?) x (\d+(?:,\d+)?) m\b/);
    if (m) return { valor: Math.round(num(m[1]) * num(m[2]) * 100) / 100, unidade: "m²" };
    m = n.match(/(\d+(?:,\d+)?) m²/);
    if (m) return { valor: num(m[1]), unidade: "m²" };
    m = n.match(/(\d+(?:,\d+)?) x (\d+(?:,\d+)?)(?: x [\d,]+)? cm/);
    if (m && f.classe !== "kit") return { valor: (num(m[1]) * num(m[2])) / 10000, unidade: "m²" };
  }
  if (unidade === "m") {
    if (f.comprimento_m) return { valor: f.comprimento_m, unidade: "m" };
    if (f.largura_m) return { valor: f.largura_m, unidade: "m" };
    m = n.match(/(?:barra|peça|segmento|trecho|módulo|trecho de|vão)\s*(?:de\s*)?(\d+(?:,\d+)?)\s*m\b/);
    if (m) return { valor: num(m[1]), unidade: "m" };
    m = n.match(/\((\d+(?:,\d+)?) m\)/);
    if (m) return { valor: num(m[1]), unidade: "m" };
    m = n.match(/(\d+(?:,\d+)?) x (\d+(?:,\d+)?) m\b/);
    if (m) return { valor: num(m[1]), unidade: "m" };
    m = n.match(/(\d+(?:,\d+)?) m\b/);
    if (m) return { valor: num(m[1]), unidade: "m" };
    m = n.match(/(\d+) cm\)?$/);
    if (m) return { valor: Number(m[1]) / 100, unidade: "m" };
  }
  if (unidade === "saco") return { valor: 1, unidade: "saco" };
  return { valor: 1, unidade };
}

/** Tamanho do módulo de um kit ou serviço montado (G), na unidade do serviço. */
function conteudoDoKit(f: Ficha, nome: string, unidade: string): { valor: number; unidade: string } {
  if (unidade === "m²") {
    if (f.area_m2) return { valor: f.area_m2, unidade };
    const m = nome.match(/(\d+(?:,\d+)?) x (\d+(?:,\d+)?)(?: x [\d,]+)? m\b/);
    if (m) return { valor: Math.round(num(m[1]) * num(m[2]) * 100) / 100, unidade };
    if (/\b1 m²|1 x 1 m/.test(nome)) return { valor: 1, unidade };
    return { valor: Math.round(f.dimensoes_m[0] * Math.max(f.dimensoes_m[1], f.dimensoes_m[2]) * 100) / 100, unidade };
  }
  if (unidade === "m³") {
    if (f.volume_m3) return { valor: f.volume_m3, unidade };
    return { valor: 1, unidade };
  }
  if (unidade === "m") return conteudoDaPeca(f, nome, unidade);
  return { valor: 1, unidade };
}

export function gerarCatalogo(pasta: string): ModeloCatalogo[] {
  const fichas = readdirSync(pasta).filter((a) => a.endsWith(".json")).sort();
  return fichas.map((a) => {
    const f = JSON.parse(readFileSync(join(pasta, a), "utf8")) as Ficha;
    const nome = NOMES_LOTE0[f.codigo] ?? f.nome;
    const unidade = f.unidade ?? UNIDADES_LOTE0[f.codigo] ?? "un";
    const montado = f.classe === "kit" || f.animacao === "G";
    const base = "public/biblioteca-3d/modelos";
    return {
      codigo: f.codigo, nome, classe: f.classe, animacao: f.animacao, unidade,
      dimensoes: f.dimensoes_m.map((d) => Math.round(d * 1000) / 1000) as [number, number, number],
      conteudo: CONTEUDO_FIXO[f.codigo] ? { valor: CONTEUDO_FIXO[f.codigo][0], unidade: CONTEUDO_FIXO[f.codigo][1] } : montado ? conteudoDoKit(f, nome, unidade) : conteudoDaPeca(f, nome, unidade),
      ...(f.etapas ? { etapas: f.etapas } : {}),
      ...(f.funcao ? { funcao: f.funcao } : {}),
      animado: existsSync(join(base, `${f.codigo}_anim.glb`)),
      video: existsSync(join(base, `${f.codigo}_anim.webm`)),
    };
  });
}

if (process.argv[1]?.endsWith("gerar-catalogo-3d.ts")) {
  const pasta = process.argv[2];
  if (!pasta) throw new Error("Informe a pasta com as fichas JSON.");
  const catalogo = gerarCatalogo(pasta);
  writeFileSync("src/dados/biblioteca-3d.json", JSON.stringify(catalogo) + "\n");
  console.log(`${catalogo.length} modelos no catálogo.`);
}

/**
 * Regras de cálculo do orçamento, sem acesso ao banco: BDI (Acórdão TCU 2.622/2013),
 * custo unitário, arredondar ou truncar, curva ABC e cronograma físico-financeiro.
 */
import { ajustar, arred, dec, div, mul, soma, UM, ZERO, type Dec, type Regra } from "../lib/decimal";

// ---------------------------------------------------------------------------
// BDI
// ---------------------------------------------------------------------------
export const PARCELAS_BDI = ["ac", "sg", "r", "df", "l", "pis", "cofins", "iss", "cprb"] as const;
export type ParcelaBdi = (typeof PARCELAS_BDI)[number];
/** Percentuais de cada parcela, em texto com ponto ("4.00"). */
export type Bdi = Record<ParcelaBdi, string>;

export const ROTULO_PARCELA: Record<ParcelaBdi, string> = {
  ac: "Administração central",
  sg: "Seguro e garantia",
  r: "Risco",
  df: "Despesas financeiras",
  l: "Lucro",
  pis: "PIS",
  cofins: "COFINS",
  iss: "ISS",
  cprb: "CPRB (desoneração)",
};

export const TIPOS_OBRA_BDI = ["edificacoes", "rodovias", "saneamento", "portuarias", "linhas", "fornecimento"] as const;
export type TipoObraBdi = (typeof TIPOS_OBRA_BDI)[number];
export const ROTULO_TIPO_BDI: Record<TipoObraBdi, string> = {
  edificacoes: "Construção de edifícios",
  rodovias: "Rodovias e ferrovias",
  saneamento: "Redes de água, esgoto e similares",
  portuarias: "Obras portuárias, marítimas e fluviais",
  linhas: "Linhas de transmissão e subestações",
  fornecimento: "Fornecimento de materiais e equipamentos",
};

type Faixa = [string, string, string]; // 1º quartil, médio, 3º quartil
/** Faixas de referência do Acórdão TCU 2.622/2013, em %. */
export const FAIXAS_TCU: Record<TipoObraBdi, Partial<Record<"ac" | "sg" | "r" | "df" | "l" | "bdi", Faixa>>> = {
  edificacoes: { ac: ["3.00", "4.00", "5.50"], sg: ["0.80", "0.80", "1.00"], r: ["0.97", "1.27", "1.27"], df: ["0.59", "1.23", "1.39"], l: ["6.16", "7.40", "8.96"], bdi: ["20.34", "22.12", "25.00"] },
  rodovias: { ac: ["3.80", "4.01", "4.67"], sg: ["0.32", "0.40", "0.74"], r: ["0.50", "0.56", "0.97"], df: ["1.02", "1.11", "1.21"], l: ["6.64", "7.30", "8.69"], bdi: ["19.60", "20.97", "24.23"] },
  saneamento: { ac: ["3.43", "4.93", "6.71"], sg: ["0.28", "0.49", "0.75"], r: ["1.00", "1.39", "1.74"], df: ["0.94", "0.99", "1.17"], l: ["6.74", "8.04", "9.40"], bdi: ["20.76", "24.18", "26.44"] },
  portuarias: { ac: ["5.29", "5.92", "7.93"], sg: ["0.25", "0.51", "0.56"], r: ["1.00", "1.48", "1.97"], df: ["1.01", "1.07", "1.11"], l: ["6.22", "8.31", "9.03"], bdi: ["22.80", "25.52", "30.95"] },
  linhas: { ac: ["5.37", "5.37", "6.00"], sg: ["0.32", "0.32", "0.51"], r: ["1.00", "1.00", "1.82"], df: ["1.02", "1.02", "1.20"], l: ["6.85", "6.85", "8.89"], bdi: ["24.00", "24.00", "27.86"] },
  fornecimento: { ac: ["1.50", "3.45", "4.49"], sg: ["0.30", "0.48", "0.82"], r: ["0.56", "0.85", "0.89"], df: ["0.85", "0.85", "1.11"], l: ["3.50", "5.11", "6.22"], bdi: ["11.10", "14.02", "16.80"] },
};

/** CPRB da construção civil na reoneração gradual (Lei 14.973/2024). */
export function cprbDoAno(ano: number): string {
  if (ano <= 2024) return "4.50";
  if (ano === 2025) return "3.60";
  if (ano === 2026) return "2.70";
  if (ano === 2027) return "1.80";
  return "0.00";
}

/** BDI padrão: valores médios do TCU para o tipo de obra. Tributos: PIS, COFINS, ISS de 3% e CPRB se desonerado. */
export function bdiPadrao(tipo: TipoObraBdi, desonerado: boolean, ano: number): Bdi {
  const f = FAIXAS_TCU[tipo];
  return {
    ac: f.ac![1], sg: f.sg![1], r: f.r![1], df: f.df![1], l: f.l![1],
    pis: "0.65", cofins: "3.00", iss: "3.00", cprb: desonerado ? cprbDoAno(ano) : "0.00",
  };
}

const pct = (v: string) => div(dec(v), dec(100));

/** BDI em %, com duas casas: [(1+AC+S+R+G)(1+DF)(1+L)/(1−I)] − 1. */
export function calcularBdi(b: Bdi): Dec {
  const i = soma(pct(b.pis), pct(b.cofins), pct(b.iss), pct(b.cprb));
  if (i >= UM) throw new Error("Tributos não podem somar 100% ou mais.");
  const numerador = mul(mul(soma(UM, pct(b.ac), pct(b.sg), pct(b.r)), soma(UM, pct(b.df))), soma(UM, pct(b.l)));
  const fator = div(numerador, UM - i) - UM;
  return arred(mul(fator, dec(100)), 2);
}

export type AvisoBdi = { parcela: ParcelaBdi | "bdi"; valor: Dec; faixa: Faixa };

/** Parcelas e BDI fora da faixa de referência do TCU (entre o 1º e o 3º quartil). */
export function conferirBdi(b: Bdi, tipo: TipoObraBdi): AvisoBdi[] {
  const f = FAIXAS_TCU[tipo];
  const avisos: AvisoBdi[] = [];
  const conferir = (parcela: ParcelaBdi | "bdi", valor: Dec) => {
    const faixa = f[parcela as keyof typeof f];
    if (!faixa) return;
    if (valor < dec(faixa[0]) || valor > dec(faixa[2])) avisos.push({ parcela, valor, faixa });
  };
  for (const p of ["ac", "sg", "r", "df", "l"] as const) conferir(p, dec(b[p]));
  conferir("bdi", calcularBdi(b));
  return avisos;
}

export function validarBdi(b: Bdi): string | null {
  for (const p of PARCELAS_BDI) {
    const v = Number(b[p]);
    if (b[p] === "" || Number.isNaN(v)) return `Informe ${ROTULO_PARCELA[p].toLowerCase()}.`;
    if (v < 0 || v > 50) return `${ROTULO_PARCELA[p]} deve ficar entre 0% e 50%.`;
  }
  if (Number(b.pis) + Number(b.cofins) + Number(b.iss) + Number(b.cprb) >= 100) return "Os tributos não podem somar 100% ou mais.";
  return null;
}

// ---------------------------------------------------------------------------
// Custo unitário a partir dos insumos
// ---------------------------------------------------------------------------
export type TipoInsumo = "material" | "mao_de_obra" | "equipamento" | "servico" | "taxa";
export type LinhaInsumo = { coeficiente: Dec; preco: Dec | null; tipo: TipoInsumo };
export type CustoUnitario = { total: Dec; material: Dec; maoDeObra: Dec; equipamento: Dec; semPreco: boolean };

/**
 * Custo unitário = soma de coeficiente x preço, ajustado em duas casas pela regra do orçamento.
 * Material inclui serviços e taxas. A diferença do ajuste fica na maior parcela, para as três somarem o total.
 */
export function custoUnitario(linhas: LinhaInsumo[], regra: Regra): CustoUnitario {
  let material = ZERO, maoDeObra = ZERO, equipamento = ZERO;
  let semPreco = linhas.length === 0;
  for (const l of linhas) {
    if (l.preco == null) { semPreco = true; continue; }
    const v = mul(l.coeficiente, l.preco);
    if (l.tipo === "mao_de_obra") maoDeObra += v;
    else if (l.tipo === "equipamento") equipamento += v;
    else material += v;
  }
  const total = ajustar(material + maoDeObra + equipamento, 2, regra);
  return { total, ...repartir(total, material, maoDeObra, equipamento), semPreco };
}

function repartir(total: Dec, material: Dec, maoDeObra: Dec, equipamento: Dec) {
  const m = arred(material), o = arred(maoDeObra), e = arred(equipamento);
  const resto = total - m - o - e;
  if (resto === 0n) return { material: m, maoDeObra: o, equipamento: e };
  if (m >= o && m >= e) return { material: m + resto, maoDeObra: o, equipamento: e };
  if (o >= e) return { material: m, maoDeObra: o + resto, equipamento: e };
  return { material: m, maoDeObra: o, equipamento: e + resto };
}

/** Preço adotado a partir das cotações (mínimo de três). */
export function precoDasCotacoes(valores: Dec[], criterio: "media" | "mediana" | "menor", regra: Regra): Dec | null {
  if (valores.length < 3) return null;
  const v = [...valores].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (criterio === "menor") return v[0];
  if (criterio === "media") return ajustar(div(soma(...v), dec(v.length)), 2, regra);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : ajustar(div(v[meio - 1] + v[meio], dec(2)), 2, regra);
}

// ---------------------------------------------------------------------------
// Item e totais
// ---------------------------------------------------------------------------
export type ItemParaCalculo = {
  quantidade: Dec;
  custoUnitario: Dec | null;
  material: Dec;
  maoDeObra: Dec;
  equipamento: Dec;
  tipoBdi: "obra" | "fornecimento";
};

export type ItemCalculado = {
  custoTotal: Dec;
  precoUnitario: Dec;
  total: Dec;
  materialTotal: Dec;
  maoDeObraTotal: Dec;
  equipamentoTotal: Dec;
  semPreco: boolean;
};

/**
 * Custo total = quantidade x custo unitário. Preço unitário = custo unitário x (1 + BDI).
 * Total = quantidade x preço unitário. Todos ajustados em duas casas pela regra do orçamento.
 */
export function calcularItem(i: ItemParaCalculo, bdi: { obra: Dec; fornecimento: Dec }, regra: Regra): ItemCalculado {
  if (i.custoUnitario == null) {
    return { custoTotal: ZERO, precoUnitario: ZERO, total: ZERO, materialTotal: ZERO, maoDeObraTotal: ZERO, equipamentoTotal: ZERO, semPreco: true };
  }
  const taxa = soma(UM, div(i.tipoBdi === "fornecimento" ? bdi.fornecimento : bdi.obra, dec(100)));
  const custoTotal = ajustar(mul(i.quantidade, i.custoUnitario), 2, regra);
  const precoUnitario = ajustar(mul(i.custoUnitario, taxa), 2, regra);
  const total = ajustar(mul(i.quantidade, precoUnitario), 2, regra);
  let materialTotal = ajustar(mul(i.quantidade, i.material), 2, regra);
  let maoDeObraTotal = ajustar(mul(i.quantidade, i.maoDeObra), 2, regra);
  // O arredondamento das parcelas pode passar um centavo do custo: a diferença sai da maior parcela.
  let equipamentoTotal = custoTotal - materialTotal - maoDeObraTotal;
  if (equipamentoTotal < ZERO) {
    if (materialTotal >= maoDeObraTotal) materialTotal += equipamentoTotal; else maoDeObraTotal += equipamentoTotal;
    equipamentoTotal = ZERO;
  }
  return {
    custoTotal, precoUnitario, total, materialTotal, maoDeObraTotal,
    equipamentoTotal,
    semPreco: false,
  };
}

// ---------------------------------------------------------------------------
// Curva ABC
// ---------------------------------------------------------------------------
export type LinhaAbc<T> = T & { valor: Dec; percentual: Dec; acumulado: Dec; classe: "A" | "B" | "C" };

/** Ordena do maior para o menor. Classe A até 80% do valor acumulado, B até 95%, C o restante. */
export function curvaAbc<T>(linhas: (T & { valor: Dec })[]): LinhaAbc<T>[] {
  const total = soma(...linhas.map((l) => l.valor));
  const ordenadas = [...linhas].sort((a, b) => (a.valor > b.valor ? -1 : a.valor < b.valor ? 1 : 0));
  let acumulado = ZERO;
  let anterior = ZERO;
  return ordenadas.map((l) => {
    const percentual = total === 0n ? ZERO : mul(div(l.valor, total), dec(100));
    acumulado += percentual;
    // A classe vem do acumulado antes da linha: o item que cruza os 80% ainda é A.
    const classe = anterior < dec(80) ? "A" : anterior < dec(95) ? "B" : "C";
    anterior = acumulado;
    return { ...l, percentual, acumulado, classe };
  });
}

// ---------------------------------------------------------------------------
// Cronograma físico-financeiro
// ---------------------------------------------------------------------------
export type EtapaCronograma = { id: string; total: Dec; percentuais: Record<number, Dec> };

export function calcularCronograma(etapas: EtapaCronograma[], periodos: number, regra: Regra) {
  const porPeriodo: Dec[] = Array.from({ length: periodos }, () => ZERO);
  const linhas = etapas.map((e) => {
    let somaPct = ZERO;
    let distribuido = ZERO;
    const valores: Dec[] = [];
    for (let p = 1; p <= periodos; p++) {
      const pc = e.percentuais[p] ?? ZERO;
      somaPct += pc;
      // O último período com percentual recebe a diferença, para a etapa fechar no total exato.
      let v = ajustar(mul(e.total, div(pc, dec(100))), 2, regra);
      const restante = Object.entries(e.percentuais).some(([k, x]) => Number(k) > p && x > 0n);
      if (!restante && pc > 0n && somaPct === dec(100)) v = e.total - distribuido;
      distribuido += v;
      valores.push(v);
      porPeriodo[p - 1] += v;
    }
    return { id: e.id, valores, somaPct, fechada: somaPct === dec(100) };
  });
  const totalGeral = soma(...etapas.map((e) => e.total));
  let acum = ZERO;
  const acumulado = porPeriodo.map((v) => (acum += v));
  const pctPeriodo = porPeriodo.map((v) => (totalGeral === 0n ? ZERO : mul(div(v, totalGeral), dec(100))));
  const pctAcumulado = acumulado.map((v) => (totalGeral === 0n ? ZERO : mul(div(v, totalGeral), dec(100))));
  return { linhas, porPeriodo, acumulado, pctPeriodo, pctAcumulado, totalGeral };
}

/** Distribui 100% igualmente entre os períodos, com a sobra de arredondamento no último. */
export function distribuirIgual(periodos: number, inicio = 1, fim = periodos): Record<number, Dec> {
  const n = fim - inicio + 1;
  const parte = ajustar(div(dec(100), dec(n)), 4, "truncar");
  const r: Record<number, Dec> = {};
  for (let p = inicio; p < fim; p++) r[p] = parte;
  r[fim] = dec(100) - parte * BigInt(n - 1);
  return r;
}

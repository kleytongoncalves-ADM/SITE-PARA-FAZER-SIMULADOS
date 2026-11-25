/**
 * Caminho crítico (CPM), calendário da obra e curva S.
 * Funções puras: recebem os dados e devolvem o cálculo, sem banco.
 *
 * Convenção: o tempo é contado em dias de trabalho a partir do início do
 * cronograma (dia 0). Uma atividade de duração d começa no dia ES e ocupa os
 * dias ES até ES + d − 1. Marco tem duração 0 e acontece no dia ES.
 */

export type TipoDependencia = "TI" | "II" | "TT" | "IT";

export const ROTULO_DEPENDENCIA: Record<TipoDependencia, string> = {
  TI: "Término para início", II: "Início para início", TT: "Término para término", IT: "Início para término",
};

export type AtividadeCpm = { id: string; duracao: number };
export type DependenciaCpm = { atividadeId: string; predecessoraId: string; tipo: TipoDependencia; defasagem: number };
export type ResultadoCpm = { es: number; ef: number; ls: number; lf: number; folga: number; critica: boolean };

export class CicloNoCronograma extends Error {
  constructor(public readonly ids: string[]) {
    super("As dependências formam um ciclo. Revise as predecessoras.");
    this.name = "CicloNoCronograma";
  }
}

/** Ordem topológica das atividades (predecessoras antes). Ciclo gera erro. */
function ordenar(atividades: AtividadeCpm[], deps: DependenciaCpm[]): string[] {
  const grau = new Map(atividades.map((a) => [a.id, 0]));
  const saidas = new Map<string, string[]>(atividades.map((a) => [a.id, []]));
  for (const d of deps) {
    if (!grau.has(d.atividadeId) || !grau.has(d.predecessoraId)) continue;
    grau.set(d.atividadeId, grau.get(d.atividadeId)! + 1);
    saidas.get(d.predecessoraId)!.push(d.atividadeId);
  }
  const fila = atividades.filter((a) => grau.get(a.id) === 0).map((a) => a.id);
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const s of saidas.get(id)!) {
      grau.set(s, grau.get(s)! - 1);
      if (grau.get(s) === 0) fila.push(s);
    }
  }
  if (ordem.length < atividades.length) throw new CicloNoCronograma(atividades.filter((a) => !ordem.includes(a.id)).map((a) => a.id));
  return ordem;
}

/** Ida e volta do método do caminho crítico. Devolve também a duração total do projeto. */
export function calcularCpm(atividades: AtividadeCpm[], deps: DependenciaCpm[]) {
  const dur = new Map(atividades.map((a) => [a.id, Math.max(0, Math.trunc(a.duracao))]));
  const validas = deps.filter((d) => dur.has(d.atividadeId) && dur.has(d.predecessoraId));
  const ordem = ordenar(atividades, validas);
  const entradas = new Map<string, DependenciaCpm[]>(atividades.map((a) => [a.id, []]));
  const saidas = new Map<string, DependenciaCpm[]>(atividades.map((a) => [a.id, []]));
  for (const d of validas) { entradas.get(d.atividadeId)!.push(d); saidas.get(d.predecessoraId)!.push(d); }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of ordem) {
    const d = dur.get(id)!;
    let inicio = 0;
    for (const p of entradas.get(id)!) {
      const pes = es.get(p.predecessoraId)!, pef = ef.get(p.predecessoraId)!;
      const lim = p.tipo === "TI" ? pef + p.defasagem
        : p.tipo === "II" ? pes + p.defasagem
        : p.tipo === "TT" ? pef + p.defasagem - d
        : pes + p.defasagem - d;
      inicio = Math.max(inicio, lim);
    }
    es.set(id, inicio);
    ef.set(id, inicio + d);
  }
  const prazo = Math.max(0, ...ef.values());

  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...ordem].reverse()) {
    const d = dur.get(id)!;
    let fim = prazo;
    for (const s of saidas.get(id)!) {
      const sls = ls.get(s.atividadeId)!, slf = lf.get(s.atividadeId)!;
      const lim = s.tipo === "TI" ? sls - s.defasagem
        : s.tipo === "II" ? sls - s.defasagem + d
        : s.tipo === "TT" ? slf - s.defasagem
        : slf - s.defasagem + d;
      fim = Math.min(fim, lim);
    }
    lf.set(id, fim);
    ls.set(id, fim - d);
  }

  const resultado = new Map<string, ResultadoCpm>();
  for (const a of atividades) {
    const folga = ls.get(a.id)! - es.get(a.id)!;
    resultado.set(a.id, { es: es.get(a.id)!, ef: ef.get(a.id)!, ls: ls.get(a.id)!, lf: lf.get(a.id)!, folga, critica: folga <= 0 });
  }
  return { prazo, atividades: resultado };
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------
const DIA = 86_400_000;
export const isoParaData = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const dataParaIso = (d: Date) => d.toISOString().slice(0, 10);
export const somarDias = (iso: string, n: number) => dataParaIso(new Date(isoParaData(iso).getTime() + n * DIA));
export const diasEntre = (de: string, ate: string) => Math.round((isoParaData(ate).getTime() - isoParaData(de).getTime()) / DIA);

export type Calendario = { tipo: "corridos" | "uteis"; feriados: Set<string> };

export function diaDeTrabalho(iso: string, cal: Calendario) {
  if (cal.tipo === "corridos") return true;
  const dow = isoParaData(iso).getUTCDay();
  return dow !== 0 && dow !== 6 && !cal.feriados.has(iso);
}

/**
 * Converte o índice do dia de trabalho em data. Em dias corridos é o início
 * somado ao índice; em dias úteis, pula fins de semana e feriados.
 */
export function criarRelogio(inicio: string, cal: Calendario) {
  const dias: string[] = [];
  let atual = inicio;
  while (!diaDeTrabalho(atual, cal)) atual = somarDias(atual, 1);
  const garantir = (n: number) => {
    if (dias.length === 0) dias.push(atual);
    while (dias.length <= n) {
      let prox = somarDias(dias[dias.length - 1], 1);
      while (!diaDeTrabalho(prox, cal)) prox = somarDias(prox, 1);
      dias.push(prox);
    }
  };
  return {
    data(n: number) { garantir(Math.max(0, n)); return dias[Math.max(0, n)]; },
    /** Quantos dias de trabalho, do início até a data (inclusive). */
    indice(iso: string) {
      if (iso < (garantir(0), dias[0])) return -1;
      let n = 0;
      while ((garantir(n + 1), dias[n + 1]) <= iso) n += 1;
      return n;
    },
  };
}

/** Datas de início e fim de cada atividade a partir do CPM. Marco tem início igual ao fim. */
export function datasDasAtividades(r: ReturnType<typeof calcularCpm>, inicio: string, cal: Calendario) {
  const relogio = criarRelogio(inicio, cal);
  const m = new Map<string, { inicio: string; fim: string; folga: number; critica: boolean }>();
  for (const [id, a] of r.atividades) {
    const ini = relogio.data(a.es);
    const fim = a.ef > a.es ? relogio.data(a.ef - 1) : ini;
    m.set(id, { inicio: ini, fim, folga: a.folga, critica: a.critica });
  }
  const termino = r.prazo > 0 ? relogio.data(r.prazo - 1) : relogio.data(0);
  return { atividades: m, termino, relogio };
}

// ---------------------------------------------------------------------------
// Períodos e curva S
// ---------------------------------------------------------------------------
export type Periodo = { indice: number; inicio: string; fim: string; rotulo: string };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Semanas de 7 dias a partir do início, ou meses do calendário, até cobrir o término. */
export function periodos(inicio: string, termino: string, unidade: "semana" | "mes"): Periodo[] {
  const lista: Periodo[] = [];
  if (unidade === "semana") {
    let ini = inicio;
    for (let i = 0; ini <= termino || i === 0; i++) {
      const fim = somarDias(ini, 6);
      lista.push({ indice: i, inicio: ini, fim, rotulo: `Sem. ${i + 1}` });
      ini = somarDias(fim, 1);
    }
    return lista;
  }
  let [ano, mes] = inicio.slice(0, 7).split("-").map(Number);
  for (let i = 0; ; i++) {
    const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
    lista.push({ indice: i, inicio: i === 0 ? inicio : ini, fim, rotulo: `${MESES[mes - 1]}/${String(ano).slice(2)}` });
    if (fim >= termino) break;
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return lista;
}

export type AtividadeCurva = { id: string; inicio: string; fim: string; duracao: number; valor: number; avancos: { data: string; percentual: number }[] };

/** Valor planejado da atividade até a data: distribuído igualmente pelos dias de trabalho. */
export function planejadoAte(a: AtividadeCurva, iso: string, cal: Calendario) {
  if (a.valor === 0 || iso < a.inicio) return 0;
  if (a.duracao === 0 || iso >= a.fim) return a.valor;
  let feitos = 0;
  for (let d = a.inicio; d <= iso; d = somarDias(d, 1)) if (diaDeTrabalho(d, cal)) feitos += 1;
  return (a.valor * Math.min(feitos, a.duracao)) / a.duracao;
}

/** Percentual físico acumulado da atividade até a data, pelo último avanço registrado. */
export function avancoAte(a: AtividadeCurva, iso: string) {
  let p = 0;
  for (const v of a.avancos) if (v.data <= iso && v.percentual >= p) p = v.percentual;
  return p;
}

/**
 * Curva S física e financeira: valor previsto (linha de base) e realizado
 * (avanço físico × valor) por período, em valor e em percentual acumulado.
 * O realizado só aparece até a data de referência.
 */
export function curvaS(atividades: AtividadeCurva[], lista: Periodo[], cal: Calendario, hoje: string) {
  const total = atividades.reduce((s, a) => s + a.valor, 0);
  let antesPrev = 0, antesReal = 0;
  return lista.map((p) => {
    const prevAcum = atividades.reduce((s, a) => s + planejadoAte(a, p.fim, cal), 0);
    const ref = p.fim <= hoje ? p.fim : hoje;
    const temReal = p.inicio <= hoje;
    const realAcum = temReal ? atividades.reduce((s, a) => s + (a.valor * avancoAte(a, ref)) / 100, 0) : null;
    const linha = {
      ...p,
      previsto: prevAcum - antesPrev,
      previstoAcumulado: prevAcum,
      previstoPct: total ? (prevAcum / total) * 100 : 0,
      realizado: realAcum == null ? null : realAcum - antesReal,
      realizadoAcumulado: realAcum,
      realizadoPct: realAcum == null ? null : total ? (realAcum / total) * 100 : 0,
    };
    antesPrev = prevAcum;
    if (realAcum != null) antesReal = realAcum;
    return linha;
  });
}

/** Indicadores de prazo na data: avanço previsto, realizado e índice de desempenho de prazo (IDP = VA / VP). */
export function indicadoresPrazo(atividades: AtividadeCurva[], cal: Calendario, hoje: string) {
  const total = atividades.reduce((s, a) => s + a.valor, 0);
  const vp = atividades.reduce((s, a) => s + planejadoAte(a, hoje, cal), 0);
  const va = atividades.reduce((s, a) => s + (a.valor * avancoAte(a, hoje)) / 100, 0);
  return {
    total, vp, va,
    previstoPct: total ? (vp / total) * 100 : 0,
    realizadoPct: total ? (va / total) * 100 : 0,
    idp: vp > 0 ? va / vp : null,
  };
}

// ---------------------------------------------------------------------------
// Predecessoras em texto: "1.2", "1.3TI+2", "1.4II-1; 1.5TT"
// ---------------------------------------------------------------------------
export type PredecessoraTexto = { codigo: string; tipo: TipoDependencia; defasagem: number };

export function lerPredecessoras(t: string): { ok: true; lista: PredecessoraTexto[] } | { ok: false; erro: string } {
  const partes = t.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  const lista: PredecessoraTexto[] = [];
  for (const p of partes) {
    const m = /^(.+?)\s*(TI|II|TT|IT)?\s*(?:([+-])\s*(\d+)\s*d?)?$/i.exec(p);
    if (!m || !m[1].trim()) return { ok: false, erro: `Predecessora inválida: "${p}". Use, por exemplo, 1.2 ou 1.2TI+2.` };
    const codigo = m[1].trim();
    if (/\s/.test(codigo)) return { ok: false, erro: `Predecessora inválida: "${p}". Use, por exemplo, 1.2 ou 1.2TI+2.` };
    lista.push({ codigo, tipo: (m[2]?.toUpperCase() ?? "TI") as TipoDependencia, defasagem: m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0 });
  }
  return { ok: true, lista };
}

export function escreverPredecessoras(lista: PredecessoraTexto[]) {
  return lista.map((p) => `${p.codigo}${p.tipo === "TI" && p.defasagem === 0 ? "" : p.tipo}${p.defasagem ? (p.defasagem > 0 ? `+${p.defasagem}` : p.defasagem) : ""}`).join("; ");
}

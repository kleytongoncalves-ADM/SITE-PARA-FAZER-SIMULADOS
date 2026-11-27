/**
 * Carga do SICRO (DNIT). O DNIT publica, por UF e a cada trimestre (janeiro, abril, julho e
 * outubro), um arquivo .7z com relatórios em .xlsx. São usados:
 *  - Relatório Analítico de Composições de Custos: estrutura, FIC e produção da equipe;
 *  - Relatório Sintético de Composições de Custos: custo publicado (sem desoneração);
 *  - Relatório Sintético de Materiais: preço dos materiais (igual nos dois regimes);
 *  - Relatório Sintético de Equipamentos e de Mão de Obra, com e sem desoneração.
 *
 * O custo do SICRO é calculado por hora de equipe e dividido pela produção. Para caber no mesmo
 * modelo do SINAPI (insumo x coeficiente por unidade do serviço), cada linha vira coeficiente:
 *  - mão de obra: quantidade x (1 + FIC) / produção;
 *  - equipamento, hora produtiva (código Exxxx): quantidade x utilização operativa / produção;
 *  - equipamento, hora improdutiva (código Exxxx-I): quantidade x (utilização improdutiva + FIC) / produção.
 *    Na chuva o equipamento fica parado, por isso o FIC incide sobre o custo improdutivo;
 *  - material, atividade auxiliar e tempo fixo: a quantidade publicada.
 * O momento de transporte não entra: a distância (DMT) é definida no projeto, e o custo
 * publicado pelo DNIT também não inclui o transporte.
 */
import { dec, div, mul, texto, UM, type Dec } from "../lib/decimal";
import { normalizar, type CargaSinapi, type Celula, type Planilha } from "./importador-sinapi";
import type { Regime, TipoInsumo } from "./precos";

export const SUFIXO_IMPRODUTIVO = "-I";

const UFS: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF", "espirito santo": "ES",
  goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA", paraiba: "PB",
  parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS",
  rondonia: "RO", roraima: "RR", "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type Relatorio = "analitico" | "composicoes" | "materiais" | "equipamentos" | "mao_de_obra" | null;

/** Qual relatório do SICRO é o arquivo; nulo para os que a carga não usa. */
export function relatorioDe(arquivo: string): Relatorio {
  const n = normalizar(arquivo);
  if (/analitico de composic/.test(n)) return "analitico";
  if (/sintetico de composic/.test(n)) return "composicoes";
  if (/sintetico de materia/.test(n)) return "materiais";
  if (/sintetico de equipamento/.test(n)) return "equipamentos";
  if (/sintetico de mao de obra/.test(n)) return "mao_de_obra";
  return null;
}
const regimeDoArquivo = (arquivo: string): Regime => (/com desonera/.test(normalizar(arquivo)) ? "desonerado" : "nao_desonerado");

/** Mês e UF pelo nome do arquivo ("RJ 07-2026 Relatório ...") ou pelo cabeçalho do analítico. */
export function referenciaDoSicro(nome: string, linhas: Celula[][] = []): { uf: string | null; mes: string | null } {
  const n = /(?:^|[\\/\s_-])([A-Z]{2})[\s_-]+(0[1-9]|1[0-2])[\s_-](20\d{2})(?!\d)/.exec(nome) ?? /^()(0[1-9]|1[0-2])[\s_-](20\d{2})/.exec(nome);
  let uf = n?.[1] || null, mes = n ? `${n[3]}-${n[2]}-01` : null;
  for (const l of linhas.slice(0, 3)) {
    for (const v of l) {
      const t = normalizar(v);
      if (!uf && UFS[t]) uf = UFS[t];
      const m = /^([a-z]+)\/(20\d{2})$/.exec(t);
      if (!mes && m && MESES.includes(m[1])) mes = `${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, "0")}-01`;
    }
  }
  return { uf, mes };
}

/** Códigos do SICRO: composições com 7 dígitos (zeros à esquerda contam), insumos com letra e número. */
export function codigoSicro(v: Celula): string {
  const t = String(v ?? "").trim().toUpperCase().replace(/\.0+$/, "");
  return /^\d{1,7}$/.test(t) ? t.padStart(7, "0") : t;
}
const ehCodigoSicro = (v: Celula) => /^(\d{5,7}|[A-Z]\d{3,5})$/.test(String(v ?? "").trim().toUpperCase().replace(/\.0+$/, ""));

function numero(v: Celula): Dec | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? dec(v) : null;
  const t = String(v).replace(/R\$/g, "").trim();
  if (!t || /^[-–]$/.test(t)) return null;
  const s = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d*(\.\d*)?$/.test(s) ? dec(s) : null;
}

const tipoPeloCodigo = (codigo: string): TipoInsumo =>
  codigo.startsWith("P") ? "mao_de_obra" : codigo.startsWith("E") ? "equipamento" : "material";

type Cab = { linha: number; nomes: string[] };
function cabecalho(linhas: Celula[][]): Cab | null {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const nomes = (linhas[i] ?? []).map(normalizar);
    if (nomes[0]?.startsWith("codigo") && nomes.some((n) => n.startsWith("descricao"))) return { linha: i, nomes };
  }
  return null;
}
const col = (c: Cab, ...p: RegExp[]) => { for (const r of p) { const j = c.nomes.findIndex((n) => r.test(n)); if (j >= 0) return j; } return -1; };

type ItemAnalitico = { tipo: "insumo" | "composicao"; item: string; coef: Dec; secao: string };

export function interpretarSicro(planilhas: Planilha[], opcoes: { uf?: string | null; mes?: string | null } = {}): CargaSinapi {
  const carga: CargaSinapi = {
    uf: (opcoes.uf ?? "").toUpperCase(), mes: opcoes.mes ?? "", arquivos: [],
    insumos: new Map(), composicoes: new Map(),
    precos: { desonerado: new Map(), nao_desonerado: new Map() },
    custos: { desonerado: new Map(), nao_desonerado: new Map() },
    analitico: [], avisos: [],
  };
  const usadas = planilhas.filter((p) => relatorioDe(p.arquivo));
  carga.arquivos = [...new Set(usadas.map((p) => p.arquivo))];
  const precoDos = (r: Regime[], codigo: string, v: Dec | null) => {
    if (v == null || v < 0n) return;
    for (const g of r) carga.precos[g].set(codigo, { preco: texto(v, 4), origem: null });
  };
  const custoAnalitico = new Map<string, string>();
  const precoAnalitico = new Map<string, Dec>();
  const estrutura: { composicao: string; itens: ItemAnalitico[] }[] = [];

  for (const p of usadas) {
    const rel = relatorioDe(p.arquivo)!;
    const ref = referenciaDoSicro(p.arquivo, p.linhas);
    if (!carga.uf && ref.uf) carga.uf = ref.uf;
    if (!carga.mes && ref.mes) carga.mes = ref.mes;
    if (rel === "analitico") { lerAnalitico(p.linhas, carga, estrutura, custoAnalitico, precoAnalitico); continue; }

    const cab = cabecalho(p.linhas);
    if (!cab) { carga.avisos.push(`${p.arquivo}: títulos das colunas não encontrados.`); continue; }
    const cDesc = col(cab, /^descricao/), cUn = col(cab, /^unidade/);
    for (let i = cab.linha + 1; i < p.linhas.length; i++) {
      const l = p.linhas[i] ?? [];
      if (!ehCodigoSicro(l[0])) continue;
      const codigo = codigoSicro(l[0]);
      const descricao = String(l[cDesc] ?? "").replace(/\s+/g, " ").trim();
      if (!descricao) continue;
      const unidade = cUn >= 0 ? String(l[cUn] ?? "").trim() : "h";
      if (rel === "composicoes") {
        carga.composicoes.set(codigo, { descricao, unidade, grupo: null });
        const v = numero(l[col(cab, /^custo/)]);
        if (v != null) carga.custos.nao_desonerado.set(codigo, texto(v));
      } else if (rel === "materiais") {
        carga.insumos.set(codigo, { descricao, unidade, tipo: tipoPeloCodigo(codigo), grupo: null });
        precoDos(["desonerado", "nao_desonerado"], codigo, numero(l[col(cab, /^preco/)]));
      } else if (rel === "mao_de_obra") {
        carga.insumos.set(codigo, { descricao, unidade, tipo: "mao_de_obra", grupo: null });
        precoDos([regimeDoArquivo(p.arquivo)], codigo, numero(l[col(cab, /^custo/)]));
      } else {
        carga.insumos.set(codigo, { descricao: `${descricao} - hora produtiva`, unidade: "h", tipo: "equipamento", grupo: null });
        carga.insumos.set(codigo + SUFIXO_IMPRODUTIVO, { descricao: `${descricao} - hora improdutiva`, unidade: "h", tipo: "equipamento", grupo: null });
        const r = regimeDoArquivo(p.arquivo);
        precoDos([r], codigo, numero(l[col(cab, /^custo produtivo/)]));
        precoDos([r], codigo + SUFIXO_IMPRODUTIVO, numero(l[col(cab, /^custo improdutivo/)]));
      }
    }
  }

  // Material sem preço no sintético (o DNIT publica alguns como "zerado") fica com o preço do analítico.
  for (const [k, v] of precoAnalitico) {
    for (const r of ["nao_desonerado", "desonerado"] as Regime[]) if (!carga.precos[r].has(k)) precoDos([r], k, v);
  }
  // Composições que só aparecem no analítico usam o custo de lá.
  for (const [k, v] of custoAnalitico) if (!carga.custos.nao_desonerado.has(k)) carga.custos.nao_desonerado.set(k, v);

  // Estrutura: soma linhas repetidas do mesmo item (por exemplo, o mesmo material em duas seções).
  for (const e of estrutura) {
    const soma = new Map<string, ItemAnalitico>();
    for (const it of e.itens) {
      if (it.item === e.composicao) continue;
      const k = `${it.tipo}|${it.item}`;
      const ja = soma.get(k);
      if (ja) ja.coef += it.coef; else soma.set(k, { ...it });
    }
    for (const it of soma.values()) {
      const coef = texto(it.coef, 7);
      if (dec(coef) <= 0n) continue;
      carga.analitico.push({ composicao: e.composicao, tipo: it.tipo, item: it.item, coeficiente: coef });
    }
  }

  if (!/^[A-Z]{2}$/.test(carga.uf)) throw new Error("Não foi possível identificar a UF. Informe com --uf.");
  if (!/^\d{4}-\d{2}-01$/.test(carga.mes)) throw new Error("Não foi possível identificar o mês de referência. Informe com --mes AAAA-MM.");
  if (!carga.analitico.length) throw new Error("Relatório Analítico de Composições de Custos não encontrado ou vazio.");
  for (const r of ["nao_desonerado", "desonerado"] as Regime[]) {
    const mo = [...carga.precos[r].keys()].some((k) => k.startsWith("P"));
    const eq = [...carga.precos[r].keys()].some((k) => k.startsWith("E"));
    if (!mo || !eq) carga.avisos.push(`Sem preços de ${!mo ? "mão de obra" : "equipamentos"} no regime ${r === "desonerado" ? "com desoneração" : "sem desoneração"}.`);
  }
  if (!carga.precos.nao_desonerado.size) throw new Error("Nenhum preço encontrado. Confira se os relatórios sintéticos estão no arquivo.");
  return carga;
}

/** Percorre o relatório analítico, uma composição por vez. */
function lerAnalitico(
  linhas: Celula[][], carga: CargaSinapi, estrutura: { composicao: string; itens: ItemAnalitico[] }[],
  custos: Map<string, string>, precos: Map<string, Dec>,
) {
  let atual: { composicao: string; itens: ItemAnalitico[]; fic: Dec; producao: Dec } | null = null;
  let secao = "";
  const fechar = () => {
    if (!atual) return;
    estrutura.push({ composicao: atual.composicao, itens: atual.itens });
    atual = null;
  };
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    const a = normalizar(l[0]);
    if (a.startsWith("sistema de custos referenciais")) {
      fechar();
      const fic = numero(l[7]) ?? 0n;
      const prox = linhas[i + 1] ?? [], ident = linhas[i + 2] ?? [];
      const producao = numero(prox[7]);
      if (!ehCodigoSicro(ident[0]) || producao == null || producao <= 0n) continue;
      const composicao = codigoSicro(ident[0]);
      const descricao = String(ident[1] ?? "").replace(/\s+/g, " ").trim();
      const unidade = String(prox[8] ?? "").trim();
      if (!carga.composicoes.has(composicao)) carga.composicoes.set(composicao, { descricao, unidade, grupo: null });
      atual = { composicao, itens: [], fic, producao };
      secao = "";
      i += 2;
      continue;
    }
    if (!atual) continue;
    const at = atual as { composicao: string; itens: ItemAnalitico[]; fic: Dec; producao: Dec };
    const sec = /^([a-f]) - /.exec(a);
    if (sec) { secao = sec[1].toUpperCase(); continue; }
    if (normalizar(l[4]) === "custo unitario direto total") {
      const v = numero(l[8]);
      if (v != null) custos.set(at.composicao, texto(v));
      continue;
    }
    // Acréscimo percentual sobre a seção (instalações do canteiro, despesas do estaleiro).
    const pct = /\((\d+(?:[.,]\d+)?)\s*%\)\s*$/.exec(String(l[6] ?? ""));
    if (!l[0] && pct && secao) {
      const fator = UM + div(dec(pct[1].replace(",", ".")), dec(100));
      for (const it of at.itens) if (it.secao === secao) it.coef = mul(it.coef, fator);
      continue;
    }
    if (!ehCodigoSicro(l[0])) continue;
    const codigo = codigoSicro(l[0]);
    const descricao = String(l[1] ?? "").replace(/\s+/g, " ").trim();
    const porHora = (q: Dec) => div(q, at.producao);
    if (secao === "A") {
      const q = numero(l[2]) ?? 0n, op = numero(l[3]) ?? 0n, imp = numero(l[4]) ?? 0n;
      garantirInsumo(carga, codigo, `${descricao} - hora produtiva`, "h", "equipamento");
      garantirInsumo(carga, codigo + SUFIXO_IMPRODUTIVO, `${descricao} - hora improdutiva`, "h", "equipamento");
      at.itens.push({ tipo: "insumo", item: codigo, coef: porHora(mul(q, op)), secao });
      at.itens.push({ tipo: "insumo", item: codigo + SUFIXO_IMPRODUTIVO, coef: porHora(mul(q, imp + at.fic)), secao });
    } else if (secao === "B") {
      const q = numero(l[2]) ?? 0n;
      garantirInsumo(carga, codigo, descricao, String(l[3] ?? "h").trim() || "h", "mao_de_obra");
      at.itens.push({ tipo: "insumo", item: codigo, coef: porHora(mul(q, UM + at.fic)), secao });
    } else if (secao === "C") {
      garantirInsumo(carga, codigo, descricao, String(l[3] ?? "").trim(), tipoPeloCodigo(codigo));
      const preco = numero(l[5]);
      if (preco != null && !precos.has(codigo)) precos.set(codigo, preco);
      at.itens.push({ tipo: "insumo", item: codigo, coef: numero(l[2]) ?? 0n, secao });
    } else if (secao === "D") {
      if (!carga.composicoes.has(codigo)) carga.composicoes.set(codigo, { descricao, unidade: String(l[3] ?? "").trim(), grupo: null });
      at.itens.push({ tipo: "composicao", item: codigo, coef: numero(l[2]) ?? 0n, secao });
    } else if (secao === "E" && ehCodigoSicro(l[2])) {
      // Tempo fixo: carga, manobra e descarga do material, pela composição de transporte da coluna "Código".
      const comp = codigoSicro(l[2]);
      if (!carga.composicoes.has(comp)) carga.composicoes.set(comp, { descricao, unidade: String(l[4] ?? "t").trim(), grupo: null });
      at.itens.push({ tipo: "composicao", item: comp, coef: numero(l[3]) ?? 0n, secao });
    }
    // Seção F (momento de transporte) fica de fora: depende da distância de cada obra.
  }
  fechar();
}

function garantirInsumo(carga: CargaSinapi, codigo: string, descricao: string, unidade: string, tipo: TipoInsumo) {
  if (!carga.insumos.has(codigo)) carga.insumos.set(codigo, { descricao, unidade: unidade || "un", tipo, grupo: null });
}

/** Meses de referência do SICRO: janeiro, abril, julho e outubro. */
export const MESES_SICRO = ["01", "04", "07", "10"];

const indice = (mes: string) => { const [a, m] = mes.split("-").map(Number); return a * 12 + (m - 1); };
const mesDoIndice = (t: number) => `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;

/**
 * Trimestres a buscar, em AAAA-MM: do seguinte ao último carregado até o mais recente que já pode
 * ter saído (o DNIT publica cerca de dois meses depois da referência). No máximo os 2 mais recentes.
 */
export function trimestresPendentes(ultimo: string | null, hoje: string): string[] {
  const limite = indice(hoje.slice(0, 7)) - 2;
  const ultimoTrimestre = limite - (limite % 3);
  let t = ultimo ? indice(ultimo) - (indice(ultimo) % 3) + 3 : ultimoTrimestre - 3;
  const lista: string[] = [];
  for (; t <= ultimoTrimestre; t += 3) lista.push(mesDoIndice(t));
  return lista.slice(-2);
}

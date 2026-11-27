/**
 * Planilha comparativa de preços no modelo CiviObras: preço de referência (SINAPI ou SICRO)
 * lado a lado com cada fornecedor, variação item a item, apuração por item (média, mediana e
 * menor preço), análise por fornecedor e resumo da pesquisa.
 *
 * A aba tem exatamente os itens e os fornecedores do processo. As larguras das colunas são
 * calculadas pelo maior texto de cada coluna, sem quebra de linha. Todas as contas são fórmulas
 * do Excel; o valor já calculado vai junto para quem abre a planilha sem recalcular.
 */
import ExcelJS from "exceljs";
import { MARCA } from "./excel-marca";

export type ItemComparativo = { codigo: string; descricao: string; unidade: string; quantidade: number; referencia: number | null };
export type FornecedorComparativo = { nome: string; cnpj: string; precos: (number | null)[]; frete: number | null };
export type DadosComparativo = {
  titulo: string;
  subtitulo: string;
  rodape: string;
  /** Pares rótulo e valor mostrados acima da tabela (obra, orçamento, referência...). */
  identificacao: [string, string][];
  /** Nome da tabela de referência, por exemplo "SINAPI" ou "SICRO". */
  fonte: string;
  regra: "arredondar" | "truncar";
  itens: ItemComparativo[];
  fornecedores: FornecedorComparativo[];
  /** Texto mostrado no lugar dos fornecedores quando ainda não há preços para comparar. */
  semPropostas?: string;
};

const BRANCO = "FFFFFFFF";
const CALC = "FFEEF4F5";
const APUR = "FFFDF3E7";
const TOTAL = "FFFDE8D3";
const VERM = { font: "FFA61B1B", fundo: "FFFADBD8" };
const VERD = { font: "FF1E6B34", fundo: "FFD5EFDD" };
const MOEDA = '"R$" #,##0.00';
const UNIT = '"R$" #,##0.00##';
const PCT = '"▲ +"0.00%;"▼ -"0.00%;"● "0.00%';
const DIF = '"▲ +R$ "#,##0.00;"▼ -R$ "#,##0.00;"● R$ "0.00';
const QTD = "#,##0.00##";

type V = number | null;
const soma = (v: V[]) => { const n = v.filter((x): x is number => x != null); return n.length ? n.reduce((a, b) => a + b, 0) : null; };
const mediana = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Mesmas contas das fórmulas da planilha, para gravar o valor calculado e conferir nos testes. */
export function calcularComparativo(d: DadosComparativo) {
  const aj = (x: number) => (d.regra === "truncar" ? Math.floor(x * 100 + 1e-7) : Math.round(x * 100 + 1e-7)) / 100;
  const nItens = d.itens.length;
  const comFrete = d.fornecedores.some((f) => (f.frete ?? 0) > 0);
  const refTot = d.itens.map((i) => (i.referencia == null ? null : aj(i.quantidade * i.referencia)));
  const forn = d.fornecedores.map((f) => {
    const tot = d.itens.map((i, k) => (f.precos[k] == null ? null : aj(i.quantidade * f.precos[k]!)));
    const vari = d.itens.map((i, k) => (f.precos[k] != null && (i.referencia ?? 0) > 0 ? f.precos[k]! / i.referencia! - 1 : null));
    const total = soma(tot);
    const frete = comFrete ? f.frete : null;
    const global = total == null && frete == null ? null : (total ?? 0) + (frete ?? 0);
    const cotados = f.precos.filter((p) => p != null).length;
    const completa = global == null || nItens === 0 ? "" : cotados >= nItens ? "Sim" : "Não";
    const refMesmos = cotados ? soma(tot.map((t, k) => (t != null ? refTot[k] : null))) ?? 0 : null;
    const totMesmos = soma(tot.map((t, k) => (refTot[k] != null ? t : null))) ?? 0;
    const dif = refMesmos != null && refMesmos > 0 ? totMesmos - refMesmos : null;
    const variacao = refMesmos != null && refMesmos > 0 ? totMesmos / refMesmos - 1 : null;
    const comRef = vari.filter((v) => v != null) as number[];
    return { tot, vari, total, global, cotados, completa, refMesmos, dif, variacao, acima: comRef.filter((v) => v > 0).length, comRef: comRef.length };
  });
  const porItem = d.itens.map((_, i) => {
    const t = forn.map((f) => f.tot[i]).filter((x): x is number => x != null);
    if (!t.length) return { n: 0, media: null, mediana: null, menor: null, quem: "" };
    const menor = Math.min(...t);
    const k = forn.findIndex((f) => f.tot[i] === menor);
    return { n: t.length, media: t.reduce((a, b) => a + b, 0) / t.length, mediana: mediana(t), menor, quem: d.fornecedores[k].nome };
  });
  const classificacao = forn.map((f, k) => (f.global == null ? "" : f.completa !== "Sim" ? "Fora da classificação"
    : `${1 + forn.filter((o, j) => j !== k && o.completa === "Sim" && o.global! < f.global!).length}º lugar`));
  const completas = forn.filter((f) => f.completa === "Sim");
  const menorGlobal = completas.length ? Math.min(...completas.map((f) => f.global!)) : null;
  const faltam = nItens - porItem.filter((p) => p.n >= 3).length;
  return {
    refTot, forn, porItem, classificacao,
    totalReferencia: soma(refTot), totalMedia: soma(porItem.map((p) => p.media)), totalMediana: soma(porItem.map((p) => p.mediana)), totalMenor: soma(porItem.map((p) => p.menor)),
    recebidas: forn.filter((f) => f.global != null).length, completas: completas.length,
    itensComTres: nItens === 0 ? "" : faltam === 0 ? "✔ Todos os itens" : `✖ Faltam ${faltam} de ${nItens} itens`,
    menorGlobal, fornecedorMenorGlobal: menorGlobal == null ? "" : d.fornecedores[forn.findIndex((f) => f.completa === "Sim" && f.global === menorGlobal)].nome,
  };
}

/** Letra da coluna do Excel a partir do número (1 = A). */
export function col(i: number) {
  let s = "";
  for (; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

const br = (v: number, casas = 2, max = casas) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: max });

/** Largura (em caracteres do Excel) que um texto ocupa sem quebrar. */
function largura(texto: string, tipo: "normal" | "negrito" | "cabecalho" | "titulo" = "normal") {
  const fator = { normal: 0.95, negrito: 1.05, cabecalho: 1.12, titulo: 1.45 }[tipo];
  return Math.ceil(texto.length * fator) + 2;
}

export async function abaComparativo(wb: ExcelJS.Workbook, d: DadosComparativo, logo: Buffer | null, nome = "Comparativo de preços") {
  const ws = wb.addWorksheet(nome, { properties: { tabColor: { argb: MARCA.laranja } } });
  const c = calcularComparativo(d);
  const nf = d.fornecedores.length, ni = d.itens.length;
  // Colunas: B item · C código · D descrição · E unid. · F qtde · G-H referência · 3 por fornecedor · 5 de apuração.
  const cU = (k: number) => 9 + 3 * k, cT = (k: number) => 10 + 3 * k, cV = (k: number) => 11 + 3 * k;
  const a0 = 9 + 3 * nf, [cN, cMed, cMdn, cMin, cQuem] = [a0, a0 + 1, a0 + 2, a0 + 3, a0 + 4];
  const ult = nf ? cQuem : 8;
  const ajF = d.regra === "truncar" ? "ROUNDDOWN" : "ROUND";

  const minimo = new Map<number, number>();
  const mesclas: { de: number; ate: number; w: number }[] = [];
  const precisa = (cc: number, w: number) => minimo.set(cc, Math.max(minimo.get(cc) ?? 0, w));

  const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const fino = { style: "thin" as const, color: { argb: MARCA.linha } };
  const grade: Partial<ExcelJS.Borders> = { top: fino, left: fino, bottom: fino, right: fino };
  type Estilo = { negrito?: boolean; cor?: string; tam?: number; fundo?: string; fmt?: string; al?: "left" | "center" | "right"; borda?: boolean; italico?: boolean };
  const pintar = (cell: ExcelJS.Cell, e: Estilo) => {
    cell.font = { name: "Calibri", size: e.tam ?? 10, bold: !!e.negrito, italic: !!e.italico, color: { argb: e.cor ?? MARCA.texto } };
    if (e.fundo) cell.fill = fill(e.fundo);
    if (e.fmt) cell.numFmt = e.fmt;
    cell.alignment = { vertical: "middle", horizontal: e.al ?? "left", indent: e.al === "left" || !e.al ? 1 : 0, wrapText: false };
    if (e.borda !== false) cell.border = grade;
  };
  /** Escreve numa célula (ou faixa mesclada) e registra a largura que o texto precisa. */
  const por = (r: number, c1: number, valor: ExcelJS.CellValue, e: Estilo = {}, c2 = c1, texto?: string, tipo: Parameters<typeof largura>[1] = e.negrito ? "negrito" : "normal") => {
    for (let k = c1; k <= c2; k++) pintar(ws.getCell(r, k), e);
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
    ws.getCell(r, c1).value = valor;
    const t = texto ?? (typeof valor === "string" ? valor : typeof valor === "number" ? br(valor) : "");
    if (t) { const w = largura(t, tipo) + (e.al === "left" || !e.al ? 1 : 0); if (c2 > c1) mesclas.push({ de: c1, ate: c2, w }); else precisa(c1, w); }
    return ws.getCell(r, c1);
  };
  const f = (formula: string, result: V | string): ExcelJS.CellValue => ({ formula, result: result ?? "" }) as ExcelJS.CellValue;
  const moeda = (v: V, casas = 2, max = casas) => (v == null ? "" : `R$ ${br(v, casas, max)}`);
  const pct = (v: V) => (v == null ? "" : `▲ +${br(Math.abs(v * 100))}%`);
  const cond = (ref: string, regras: { formula: string; cor: { font: string; fundo: string } }[]) =>
    ws.addConditionalFormatting({ ref, rules: regras.map((x, i) => ({ type: "expression", priority: i + 1, formulae: [x.formula], style: { font: { color: { argb: x.cor.font }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: x.cor.fundo } } } })) });
  const meta = (ref: string, celula: string) => cond(ref, [{ formula: `AND(ISNUMBER(${celula}),${celula}>0)`, cor: VERM }, { formula: `AND(ISNUMBER(${celula}),${celula}<=0)`, cor: VERD }]);

  // ---------- faixa da marca ----------
  ws.getColumn(1).width = 1.5;
  for (const [r, h] of [[1, 34], [2, 20], [3, 4]] as const) {
    ws.getRow(r).height = h;
    for (let k = 1; k <= ult; k++) ws.getCell(r, k).fill = fill(r === 3 ? MARCA.laranja : MARCA.petroleo);
  }
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 1, row: 0.25 }, ext: { width: 175, height: 37 } });
  }
  const iniTitulo = Math.min(5, ult);
  ws.mergeCells(1, iniTitulo, 1, ult);
  ws.mergeCells(2, iniTitulo, 2, ult);
  Object.assign(ws.getCell(1, iniTitulo), { value: d.titulo, font: { name: "Calibri", size: 15, bold: true, color: { argb: BRANCO } }, alignment: { vertical: "middle", horizontal: "right" } });
  Object.assign(ws.getCell(2, iniTitulo), { value: d.subtitulo, font: { name: "Calibri", size: 10, color: { argb: "FFFFA850" } }, alignment: { vertical: "middle", horizontal: "right" } });
  mesclas.push({ de: 2, ate: ult, w: largura(d.titulo, "titulo") + 28 }, { de: 2, ate: ult, w: largura(d.subtitulo) + 28 });
  ws.getRow(4).height = 8;

  // ---------- identificação ----------
  let r = 5;
  for (const [rot, val] of d.identificacao) {
    ws.getRow(r).height = 18;
    por(r, 2, rot, { negrito: true, cor: MARCA.suave, tam: 9, fundo: MARCA.claro }, 3);
    por(r, 4, val || "—", { fundo: BRANCO }, 8);
    r++;
  }
  r++;

  // ---------- cabeçalho da tabela ----------
  const h1 = r, h2 = r + 1, h3 = r + 2;
  ws.getRow(h1).height = 20; ws.getRow(h2).height = 18; ws.getRow(h3).height = 20;
  const cab: Estilo = { negrito: true, cor: BRANCO, fundo: MARCA.petroleo, al: "center", tam: 9 };
  /** Cabeçalho de grupo ocupando as duas primeiras linhas do cabeçalho. */
  const grupo = (c1: number, c2: number, texto: string, fundo: string) => {
    for (let k = c1; k <= c2; k++) { pintar(ws.getCell(h1, k), { ...cab, fundo, tam: 10 }); pintar(ws.getCell(h2, k), { ...cab, fundo }); }
    ws.mergeCells(h1, c1, h2, c2);
    ws.getCell(h1, c1).value = texto;
    mesclas.push({ de: c1, ate: c2, w: largura(texto, "cabecalho") });
  };
  grupo(2, 6, "ITENS DA COTAÇÃO", MARCA.petroleo);
  grupo(7, 8, `PREÇO DE REFERÊNCIA · ${d.fonte.toUpperCase()}`, MARCA.petroleo);
  d.fornecedores.forEach((fo, k) => {
    por(h1, cU(k), fo.nome, { ...cab, fundo: MARCA.petroleoEscuro, tam: 10 }, cV(k));
    por(h2, cU(k), fo.cnpj ? `CNPJ ${fo.cnpj}` : "", { ...cab, fundo: MARCA.petroleoEscuro, negrito: false, cor: "FFC9D7DB", tam: 9 }, cV(k));
  });
  if (nf) {
    grupo(cN, cQuem, "APURAÇÃO DO TOTAL DE CADA ITEM", MARCA.laranja);
  }
  const titulos: [number, string][] = [[2, "ITEM"], [3, "CÓDIGO"], [4, "DESCRIÇÃO"], [5, "UNID."], [6, "QTDE"], [7, "UNITÁRIO"], [8, "TOTAL"]];
  d.fornecedores.forEach((_, k) => titulos.push([cU(k), "UNITÁRIO"], [cT(k), "TOTAL"], [cV(k), "VARIAÇÃO"]));
  if (nf) titulos.push([cN, "PROPOSTAS"], [cMed, "MÉDIA"], [cMdn, "MEDIANA"], [cMin, "MENOR"], [cQuem, "FORNECEDOR DO MENOR"]);
  for (const [k, t] of titulos) {
    por(h3, k, t, { ...cab, fundo: k >= cN && nf ? MARCA.laranja : MARCA.petroleo }, k, undefined, "cabecalho");
    ws.getCell(h3, k).border = { ...grade, bottom: { style: "medium", color: { argb: MARCA.laranja } } };
  }

  // ---------- itens ----------
  const r0 = h3 + 1, rn = h3 + ni;
  d.itens.forEach((it, i) => {
    const l = r0 + i;
    ws.getRow(l).height = 18;
    por(l, 2, i + 1, { negrito: true, cor: MARCA.suave, fundo: MARCA.claro, al: "center" }, 2, String(i + 1));
    por(l, 3, it.codigo, { al: "center" });
    por(l, 4, it.descricao);
    por(l, 5, it.unidade, { al: "center" });
    por(l, 6, it.quantidade, { fmt: QTD, al: "right" }, 6, br(it.quantidade, 2, 4));
    por(l, 7, it.referencia, { fmt: UNIT, al: "right" }, 7, moeda(it.referencia, 2, 4));
    por(l, 8, f(`IF(AND(ISNUMBER(F${l}),ISNUMBER(G${l})),${ajF}(F${l}*G${l},2),"")`, c.refTot[i]), { fmt: MOEDA, fundo: CALC, al: "right" }, 8, moeda(c.refTot[i]));
    const totais: string[] = [];
    d.fornecedores.forEach((fo, k) => {
      const U = col(cU(k)), cf = c.forn[k];
      por(l, cU(k), fo.precos[i], { fmt: UNIT, al: "right" }, cU(k), moeda(fo.precos[i], 2, 4));
      por(l, cT(k), f(`IF(ISNUMBER(${U}${l}),${ajF}($F${l}*${U}${l},2),"")`, cf.tot[i]), { fmt: MOEDA, fundo: CALC, al: "right" }, cT(k), moeda(cf.tot[i]));
      por(l, cV(k), f(`IF(AND(ISNUMBER(${U}${l}),N($G${l})>0),${U}${l}/$G${l}-1,"")`, cf.vari[i]), { fmt: PCT, fundo: CALC, al: "right" }, cV(k), pct(cf.vari[i]));
      totais.push(`${col(cT(k))}${l}`);
    });
    if (nf) {
      const lst = totais.join(","), p = c.porItem[i];
      por(l, cN, f(`IF(COUNT(${lst})=0,"",COUNT(${lst}))`, p.n || null), { fundo: APUR, al: "center", fmt: "0" }, cN, String(p.n));
      por(l, cMed, f(`IF(COUNT(${lst})=0,"",AVERAGE(${lst}))`, p.media), { fundo: APUR, fmt: MOEDA, al: "right" }, cMed, moeda(p.media));
      por(l, cMdn, f(`IF(COUNT(${lst})=0,"",MEDIAN(${lst}))`, p.mediana), { fundo: APUR, fmt: MOEDA, al: "right" }, cMdn, moeda(p.mediana));
      por(l, cMin, f(`IF(COUNT(${lst})=0,"",MIN(${lst}))`, p.menor), { fundo: APUR, fmt: MOEDA, al: "right" }, cMin, moeda(p.menor));
      const mn = `${col(cMin)}${l}`;
      let quem = '""';
      for (let k = nf - 1; k >= 0; k--) quem = `IF(N(${totais[k]})=${mn},${col(cU(k))}$${h1},${quem})`;
      por(l, cQuem, f(`IF(${mn}="","",${quem})`, p.quem), { fundo: APUR }, cQuem, p.quem);
    }
  });

  // ---------- totais ----------
  const rt = rn + 1;
  const tot: Estilo = { negrito: true, cor: MARCA.petroleo, fundo: TOTAL, al: "right" };
  const somaCol = (cc: number, v: V) => f(`IF(COUNT(${col(cc)}${r0}:${col(cc)}${rn})=0,"",SUM(${col(cc)}${r0}:${col(cc)}${rn}))`, v);
  ws.getRow(rt).height = 20;
  por(rt, 2, "TOTAL DOS ITENS", { ...tot, al: "left" }, 7);
  por(rt, 8, somaCol(8, c.totalReferencia), { ...tot, fmt: MOEDA }, 8, moeda(c.totalReferencia), "negrito");
  d.fornecedores.forEach((_, k) => {
    por(rt, cU(k), null, tot);
    por(rt, cT(k), somaCol(cT(k), c.forn[k].total), { ...tot, fmt: MOEDA }, cT(k), moeda(c.forn[k].total), "negrito");
    por(rt, cV(k), null, tot);
  });
  if (nf) {
    por(rt, cN, null, tot);
    por(rt, cMed, somaCol(cMed, c.totalMedia), { ...tot, fmt: MOEDA }, cMed, moeda(c.totalMedia), "negrito");
    por(rt, cMdn, somaCol(cMdn, c.totalMediana), { ...tot, fmt: MOEDA }, cMdn, moeda(c.totalMediana), "negrito");
    por(rt, cMin, somaCol(cMin, c.totalMenor), { ...tot, fmt: MOEDA }, cMin, moeda(c.totalMenor), "negrito");
    por(rt, cQuem, null, tot);
  }
  const medio = { style: "medium" as const, color: { argb: MARCA.petroleo } };
  for (let k = 2; k <= ult; k++) ws.getCell(rt, k).border = { left: fino, right: fino, top: medio, bottom: medio };

  // Frete só aparece quando algum fornecedor cobrou à parte.
  const comFrete = d.fornecedores.some((fo) => (fo.frete ?? 0) > 0);
  const rf = comFrete ? rt + 1 : null;
  if (rf) {
    ws.getRow(rf).height = 18;
    por(rf, 2, "FRETE INFORMADO NA PROPOSTA", { negrito: true, cor: MARCA.suave, fundo: MARCA.claro }, 8);
    d.fornecedores.forEach((fo, k) => {
      por(rf, cU(k), null, { fundo: MARCA.claro });
      por(rf, cT(k), fo.frete, { fmt: MOEDA, al: "right" }, cT(k), moeda(fo.frete));
      por(rf, cV(k), null, { fundo: MARCA.claro });
    });
  }

  if (!nf) {
    if (d.semPropostas) por((rf ?? rt) + 2, 2, d.semPropostas, { italico: true, cor: MARCA.suave, borda: false }, 8);
  } else {
    // ---------- análise por fornecedor e resumo ----------
    const ra = (rf ?? rt) + 2;
    const linhas = ["nome", "global", "cotados", "completa", "ref", "dif", "var", "sit", "acima", "class"] as const;
    const rotulos: Record<(typeof linhas)[number], string> = {
      nome: "Fornecedor", global: comFrete ? "Valor global da proposta (itens + frete)" : "Valor global da proposta",
      cotados: "Itens cotados", completa: "Cotou todos os itens", ref: "Preço de referência dos mesmos itens",
      dif: "Diferença sobre a referência (R$)", var: "Variação sobre a referência (%)", sit: "Situação em relação à meta",
      acima: "Itens acima da referência", class: "Classificação pelo menor valor global",
    };
    const pos = Object.fromEntries(linhas.map((k, i) => [k, ra + 1 + i])) as Record<(typeof linhas)[number], number>;
    ws.getRow(ra).height = 20;
    por(ra, 2, "ANÁLISE POR FORNECEDOR · META: PREÇO MENOR OU IGUAL AO DE REFERÊNCIA", { ...cab, tam: 10 }, cV(nf - 1), undefined, "cabecalho");
    const G = (k: number) => `${col(cU(k))}${pos.global}`;
    const CP = (k: number) => `${col(cU(k))}${pos.completa}`;
    const nIt = `COUNT($F$${r0}:$F$${rn})`;
    for (const chave of linhas) {
      const l = pos[chave];
      ws.getRow(l).height = 18;
      por(l, 2, rotulos[chave], { negrito: true, cor: MARCA.suave, tam: 9, fundo: MARCA.claro }, 8);
      d.fornecedores.forEach((fo, k) => {
        const U = col(cU(k)), T = col(cT(k)), Vv = col(cV(k)), x = c.forn[k], R = `${U}${pos.ref}`;
        const faixaT = `${T}${r0}:${T}${rn}`, faixaU = `${U}${r0}:${U}${rn}`, faixaV = `${Vv}${r0}:${Vv}${rn}`, faixaH = `$H$${r0}:$H$${rn}`;
        let v: ExcelJS.CellValue, fmt: string | undefined, texto: string;
        switch (chave) {
          case "nome": v = f(`${U}$${h1}`, fo.nome); texto = fo.nome; break;
          case "global": v = f(rf ? `IF(COUNT(${T}${rt},${T}${rf})=0,"",SUM(${T}${rt},${T}${rf}))` : `IF(ISNUMBER(${T}${rt}),${T}${rt},"")`, x.global); fmt = MOEDA; texto = moeda(x.global); break;
          case "cotados": { const t = x.cotados ? `${x.cotados} de ${ni} itens` : ""; v = f(`IF(COUNT(${faixaU})=0,"",COUNT(${faixaU})&" de "&${nIt}&" itens")`, t); texto = t; break; }
          case "completa": v = f(`IF(OR(${nIt}=0,NOT(ISNUMBER(${G(k)}))),"",IF(COUNT(${faixaU})>=${nIt},"Sim","Não"))`, x.completa); texto = x.completa; break;
          case "ref": v = f(`IF(COUNT(${faixaT})=0,"",SUMIFS(${faixaH},${faixaT},">=0"))`, x.refMesmos); fmt = MOEDA; texto = moeda(x.refMesmos); break;
          case "dif": v = f(`IF(N(${R})>0,SUMIFS(${faixaT},${faixaH},">=0")-${R},"")`, x.dif); fmt = DIF; texto = x.dif == null ? "" : `▲ +R$ ${br(Math.abs(x.dif))}`; break;
          case "var": v = f(`IF(N(${R})>0,SUMIFS(${faixaT},${faixaH},">=0")/${R}-1,"")`, x.variacao); fmt = PCT; texto = pct(x.variacao); break;
          case "sit": { const vv = `${U}${pos.var}`, t = x.variacao == null ? "" : x.variacao <= 0 ? "✔ Dentro da meta" : "✖ Acima da referência"; v = f(`IF(ISNUMBER(${vv}),IF(${vv}<=0,"✔ Dentro da meta","✖ Acima da referência"),"")`, t); texto = t; break; }
          case "acima": { const t = x.comRef ? `${x.acima} de ${x.comRef} itens com referência` : ""; v = f(`IF(COUNT(${faixaV})=0,"",COUNTIF(${faixaV},">0")&" de "&COUNT(${faixaV})&" itens com referência")`, t); texto = t; break; }
          case "class": {
            const outros = d.fornecedores.map((_, j) => (j === k ? null : `(${CP(j)}="Sim")*(N(${G(j)})<${G(k)})`)).filter(Boolean).join("+") || "0";
            v = f(`IF(NOT(ISNUMBER(${G(k)})),"",IF(${CP(k)}<>"Sim","Fora da classificação",(1+${outros})&"º lugar"))`, c.classificacao[k]); texto = c.classificacao[k]; break;
          }
        }
        const forte = chave === "nome" || chave === "global" || chave === "class" || chave === "sit";
        por(l, cU(k), v, { fundo: CALC, al: "center", fmt, negrito: forte, cor: chave === "nome" || chave === "global" ? MARCA.petroleo : MARCA.texto }, cV(k), texto);
        const vv = `$${U}$${pos.var}`;
        if (chave === "dif" || chave === "var" || chave === "sit") meta(`${U}${l}:${Vv}${l}`, vv);
        if (chave === "completa") cond(`${U}${l}:${Vv}${l}`, [{ formula: `${U}${l}="Não"`, cor: VERM }]);
        if (chave === "class") cond(`${U}${l}:${Vv}${l}`, [{ formula: `LEFT(${U}${l},2)="1º"`, cor: { font: MARCA.petroleo, fundo: "FFFCE3C6" } }]);
      });
    }
    d.fornecedores.forEach((_, k) => meta(`${col(cT(k))}${rt}`, `$${col(cU(k))}$${pos.var}`));
    d.fornecedores.forEach((_, k) => meta(`${col(cV(k))}${r0}:${col(cV(k))}${rn}`, `${col(cV(k))}${r0}`));
    cond(`${col(cN)}${r0}:${col(cN)}${rn}`, [{ formula: `AND(ISNUMBER(${col(cN)}${r0}),${col(cN)}${r0}<3)`, cor: VERM }]);

    // Resumo da pesquisa, ao lado da análise.
    const LG = `${col(cU(0))}${pos.global}:${col(cV(nf - 1))}${pos.global}`;
    const LC = `${col(cU(0))}${pos.completa}:${col(cV(nf - 1))}${pos.completa}`;
    const falt = `(${nIt}-COUNTIF(${col(cN)}${r0}:${col(cN)}${rn},">=3"))`;
    const mg = `${col(cMin)}${ra + 4}`;
    let quem = '""';
    for (let k = nf - 1; k >= 0; k--) quem = `IF(AND(${CP(k)}="Sim",N(${G(k)})=${mg}),${col(cU(k))}${pos.nome},${quem})`;
    const ref = (cc: number) => `IF(ISNUMBER(${col(cc)}${rt}),${col(cc)}${rt},"")`;
    const resumo: [string, ExcelJS.CellValue, string | undefined, string][] = [
      ["Propostas recebidas", f(`COUNT(${LG})`, c.recebidas), "0", String(c.recebidas)],
      ["Propostas com todos os itens", f(`COUNTIF(${LC},"Sim")`, c.completas), "0", String(c.completas)],
      ["Itens com 3 ou mais propostas", f(`IF(${nIt}=0,"",IF(${falt}=0,"✔ Todos os itens","✖ Faltam "&${falt}&" de "&${nIt}&" itens"))`, c.itensComTres), undefined, c.itensComTres],
      ["Menor valor global", f(`IF(COUNTIF(${LC},"Sim")=0,"",_xlfn.MINIFS(${LG},${LC},"Sim"))`, c.menorGlobal), MOEDA, moeda(c.menorGlobal)],
      ["Fornecedor do menor valor global", f(`IF(${mg}="","",${quem})`, c.fornecedorMenorGlobal), undefined, c.fornecedorMenorGlobal],
      ["Total pela média", f(ref(cMed), c.totalMedia), MOEDA, moeda(c.totalMedia)],
      ["Total pela mediana", f(ref(cMdn), c.totalMediana), MOEDA, moeda(c.totalMediana)],
      ["Total pelo menor preço de cada item", f(ref(cMin), c.totalMenor), MOEDA, moeda(c.totalMenor)],
      ["Total pela referência", f(`IF(ISNUMBER(H${rt}),H${rt},"")`, c.totalReferencia), MOEDA, moeda(c.totalReferencia)],
    ];
    por(ra, cN, "RESUMO DA PESQUISA", { ...cab, fundo: MARCA.laranja, tam: 10 }, cQuem, undefined, "cabecalho");
    resumo.forEach(([rot, v, fmt, texto], i) => {
      const l = ra + 1 + i;
      por(l, cN, rot, { negrito: true, cor: MARCA.suave, tam: 9, fundo: MARCA.claro }, cMdn);
      por(l, cMin, v, { negrito: true, fundo: APUR, fmt, al: "center" }, cQuem, texto, "negrito");
    });
    const sit = `${col(cMin)}${ra + 3}`;
    cond(sit, [{ formula: `LEFT(${sit},1)="✖"`, cor: VERM }, { formula: `LEFT(${sit},1)="✔"`, cor: VERD }]);
  }

  // ---------- larguras: o maior texto de cada coluna, sem quebra ----------
  const larg = new Map<number, number>();
  for (let k = 2; k <= ult; k++) larg.set(k, Math.max(minimo.get(k) ?? 0, 5));
  for (const m of mesclas.sort((a, b) => a.ate - a.de - (b.ate - b.de))) {
    const atual = Array.from({ length: m.ate - m.de + 1 }, (_, i) => larg.get(m.de + i) ?? 0).reduce((a, b) => a + b, 0);
    if (atual < m.w) {
      // A sobra vai para a descrição quando ela faz parte da faixa; senão, é repartida pelas colunas da faixa.
      if (m.de <= 4 && m.ate >= 4) larg.set(4, (larg.get(4) ?? 0) + (m.w - atual));
      else for (let k = m.de; k <= m.ate; k++) larg.set(k, (larg.get(k) ?? 0) + Math.ceil(((larg.get(k) ?? 0) / atual) * (m.w - atual)));
    }
  }
  for (const [k, w] of larg) ws.getColumn(k).width = Math.min(w, 120);

  ws.views = [{ state: "frozen", xSplit: 4, ySplit: h3, showGridLines: false }];
  ws.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, printTitlesRow: `${h1}:${h3}`,
  };
  ws.headerFooter = { oddFooter: `&L&8&K4D6A73${d.rodape.replace(/&/g, "&&")}&R&8&K4D6A73Página &P de &N` };
  return ws;
}

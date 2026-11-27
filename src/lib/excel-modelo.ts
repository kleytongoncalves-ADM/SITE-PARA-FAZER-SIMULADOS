/**
 * Modelo padrão das planilhas exportadas pelo CiviObras: capa com a logo e as cores da marca,
 * abas com faixa de título, cabeçalho azul petróleo, linhas alternadas, totais destacados
 * e impressão em A4 com cabeçalho e número de página. Use em toda exportação para Excel.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

import { FORMATO, MARCA } from "./excel-marca";

export { FORMATO, MARCA };

export type Coluna = { titulo: string; largura: number; formato?: string; alinhar?: "left" | "center" | "right" };
export type Celula = string | number | Date | null | { formula: string; result?: number };

/** Data do banco (AAAA-MM-DD) como data de verdade na planilha, para ordenar e filtrar. */
export const dataExcel = (iso?: string | null): Date | null => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** Texto "dd/mm/aaaa" vira data; o restante segue como está. */
function comoData(v: Celula): Celula {
  if (typeof v !== "string") return v;
  const m = DATA_BR.exec(v);
  if (!m) return v;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return d.getUTCDate() === Number(m[1]) ? d : v;
}
const letra = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export type Linha = { valores: Celula[]; tipo?: "grupo" | "total" | "normal" };

const fonte = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Calibri", size: 10, color: { argb: MARCA.texto }, ...extra });
const preencher = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const borda = (argb: string = MARCA.linha): Partial<ExcelJS.Borders> => ({ bottom: { style: "thin", color: { argb } } });

/** Estimativa de linhas ocupadas por um texto numa largura de colunas (em caracteres). */
function linhasNecessarias(texto: string, largura: number) {
  return texto.split("\n").reduce((n, parte) => n + Math.max(1, Math.ceil(parte.length / largura)), 0);
}

const logoDaPasta = new WeakMap<ExcelJS.Workbook, number>();
let logoCache: Buffer | null | undefined;
export async function logo() {
  if (logoCache !== undefined) return logoCache;
  try { logoCache = await readFile(path.join(process.cwd(), "public", "marca", "logo.png")); } catch { logoCache = null; }
  return logoCache;
}

export type Documento = { orgao: string; titulo: string; subtitulo: string; geradoEm: Date; geradoPor: string };

export function novaPasta(doc: Documento) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CiviObras";
  wb.company = doc.orgao;
  wb.title = doc.titulo;
  wb.created = doc.geradoEm;
  return wb;
}

/** A4; abas muito largas saem em A3 para o texto não ficar ilegível ao ajustar à largura da página. */
function configurarImpressao(ws: ExcelJS.Worksheet, doc: Documento, paisagem: boolean, larga = false) {
  ws.pageSetup = {
    paperSize: (larga ? 8 : 9) as ExcelJS.PaperSize, orientation: paisagem ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.25, footer: 0.25 }, horizontalCentered: true,
  };
  ws.headerFooter = {
    oddHeader: `&L&8&K4D6A73CiviObras · ${doc.orgao.replace(/&/g, "&&")}&R&8&K4D6A73${doc.titulo.replace(/&/g, "&&")}`,
    oddFooter: `&L&8&K4D6A73${doc.subtitulo.replace(/&/g, "&&")}&R&8&K4D6A73Página &P de &N`,
  };
}

/** Faixa da marca no topo de cada aba: fundo petróleo, logo, título e linha laranja. */
async function faixa(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, ncol: number, titulo: string, sub: string) {
  const ultima = Math.max(ncol, 4);
  for (let r = 1; r <= 3; r++) {
    const row = ws.getRow(r);
    row.height = r === 1 ? 30 : r === 2 ? 22 : 5;
    for (let c = 1; c <= ultima; c++) row.getCell(c).fill = preencher(r === 3 ? MARCA.laranja : MARCA.petroleo);
  }
  const img = await logo();
  const inicioTexto = img ? Math.min(ncol <= 4 ? 2 : 3, ultima) : 1;
  if (img) {
    // A logo entra uma vez no arquivo e é reaproveitada em todas as abas.
    let id = logoDaPasta.get(wb);
    if (id === undefined) { id = wb.addImage({ buffer: img as unknown as ExcelJS.Buffer, extension: "png" }); logoDaPasta.set(wb, id); }
    ws.addImage(id, { tl: { col: 0.15, row: 0.3 }, ext: { width: 150, height: 32 } });
  }
  ws.mergeCells(1, inicioTexto, 1, ultima);
  ws.mergeCells(2, inicioTexto, 2, ultima);
  const t = ws.getCell(1, inicioTexto);
  t.value = titulo; t.font = fonte({ size: 15, bold: true, color: { argb: "FFFFFFFF" } }); t.alignment = { vertical: "middle", horizontal: img ? "right" : "left", shrinkToFit: true };
  const s = ws.getCell(2, inicioTexto);
  s.value = sub; s.font = fonte({ size: 10, color: { argb: "FFFFA850" } }); s.alignment = { vertical: "middle", horizontal: img ? "right" : "left", shrinkToFit: true };
  ws.getRow(4).height = 8;
}

/** Capa: identificação do documento em pares rótulo e valor, mais um quadro de destaques. */
export async function capa(wb: ExcelJS.Workbook, doc: Documento, dados: [string, string][], destaques: [string, number, string?][] = []) {
  const ws = wb.addWorksheet("Capa", { views: [{ showGridLines: false }], properties: { tabColor: { argb: MARCA.laranja } } });
  ws.columns = [{ width: 4 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 4 }];
  await faixa(wb, ws, 6, doc.titulo, doc.subtitulo);
  let r = 6;
  ws.getCell(r, 2).value = doc.orgao.toUpperCase();
  ws.getCell(r, 2).font = fonte({ size: 11, bold: true, color: { argb: MARCA.petroleo } });
  r += 2;
  if (destaques.length) {
    // Quatro por linha; os demais continuam na linha de baixo.
    destaques.forEach(([rotulo, v, fmt], k) => {
      const c = 2 + (k % 4), rr = r + Math.floor(k / 4) * 3;
      const cr = ws.getCell(rr, c), cv = ws.getCell(rr + 1, c);
      cr.value = rotulo; cr.font = fonte({ size: 9, color: { argb: k === 0 ? "FFE8F3F5" : MARCA.suave } });
      cv.value = v; cv.numFmt = fmt ?? FORMATO.moeda; cv.font = fonte({ size: 14, bold: true, color: { argb: k === 0 ? "FFFFA850" : MARCA.texto } });
      for (const x of [cr, cv]) { x.fill = preencher(k === 0 ? MARCA.petroleo : MARCA.claro); x.alignment = { vertical: "middle", indent: 1, shrinkToFit: x === cv }; }
    });
    const faixas = Math.ceil(destaques.length / 4);
    for (let f = 0; f < faixas; f++) { ws.getRow(r + f * 3).height = 20; ws.getRow(r + f * 3 + 1).height = 26; ws.getRow(r + f * 3 + 2).height = 6; }
    r += 3 * faixas;
  }
  for (const [rotulo, valor] of dados) {
    const a = ws.getCell(r, 2), b = ws.getCell(r, 3);
    ws.mergeCells(r, 3, r, 5);
    a.value = rotulo; a.font = fonte({ bold: true, color: { argb: MARCA.suave } });
    b.value = valor || "—"; b.font = fonte();
    // Textos longos quebram dentro das três colunas mescladas; o Excel não ajusta a altura sozinho.
    a.alignment = { vertical: "top", wrapText: true };
    b.alignment = { vertical: "top", wrapText: true };
    a.border = borda(); b.border = borda();
    const linhas = Math.max(linhasNecessarias(String(valor ?? ""), 66), linhasNecessarias(rotulo, 28));
    ws.getRow(r).height = Math.max(18, linhas * 13.5 + 4);
    r++;
  }
  r++;
  ws.getCell(r, 2).value = `Gerado em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(doc.geradoEm)} por ${doc.geradoPor}`;
  ws.getCell(r, 2).font = fonte({ size: 9, italic: true, color: { argb: MARCA.suave } });
  configurarImpressao(ws, doc, false);
  return ws;
}

/** Aba de tabela no padrão da marca. Devolve a aba e o número da primeira linha de dados. */
export async function abaTabela(wb: ExcelJS.Workbook, doc: Documento, nome: string, o: {
  titulo: string; subtitulo?: string; colunas: Coluna[]; linhas: Linha[]; paisagem?: boolean; nota?: string;
}) {
  const ws = wb.addWorksheet(nome, { views: [{ showGridLines: false, state: "frozen", ySplit: 5 }], properties: { tabColor: { argb: MARCA.petroleo } } });
  // Valores de obra pública passam de cem milhões: a coluna de moeda precisa caber sem virar "####".
  ws.columns = o.colunas.map((c) => ({ width: c.formato === FORMATO.moeda ? Math.max(c.largura, 18) : c.largura }));
  await faixa(wb, ws, o.colunas.length, o.titulo, o.subtitulo ?? doc.subtitulo);
  const cab = ws.getRow(5);
  o.colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.titulo;
    cell.font = fonte({ bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 });
    cell.fill = preencher(MARCA.petroleo);
    cell.alignment = { vertical: "middle", horizontal: c.alinhar ?? (c.formato ? "right" : "left"), wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: MARCA.laranja } } };
  });
  cab.height = 24;
  let zebra = false;
  // Linhas comuns desde o último grupo ou total (para o subtotal) e desde o começo (para o total geral).
  const somavel = (c: Coluna) => c.formato === FORMATO.moeda || c.formato === FORMATO.numero || c.formato === FORMATO.quantidade;
  const todas: number[] = [];
  let bloco: number[] = [];
  const faixasDe = (rs: number[]) => {
    const f: [number, number][] = [];
    for (const n of rs) { const u = f[f.length - 1]; if (u && u[1] === n - 1) u[1] = n; else f.push([n, n]); }
    return f;
  };
  const numeroDe = (v: Celula) => (typeof v === "number" ? v : null);
  const valorEm = new Map<number, Celula[]>();
  for (const l of o.linhas) {
    const valores = l.valores.map((v, i) => (o.colunas[i]?.formato === FORMATO.data || !o.colunas[i]?.formato ? comoData(v) : v));
    const linhaAtual = (ws.lastRow?.number ?? 5) + 1;
    if (l.tipo === "total") {
      // O total vira fórmula quando confere com a soma das linhas acima; assim ele acompanha quem editar a planilha.
      o.colunas.forEach((c, i) => {
        const v = numeroDe(valores[i]);
        if (v == null || !somavel(c)) return;
        for (const rs of [bloco, todas]) {
          if (!rs.length) continue;
          const soma = rs.reduce((t, n) => t + (numeroDe(valorEm.get(n)![i]) ?? 0), 0);
          const f = faixasDe(rs);
          if (Math.abs(soma - v) < 0.005 && f.length <= 40) {
            valores[i] = { formula: `SUM(${f.map(([a, b]) => `${letra(i)}${a}:${letra(i)}${b}`).join(",")})`, result: v };
            break;
          }
        }
      });
      bloco = [];
    } else if (l.tipo === "grupo") bloco = [];
    else { todas.push(linhaAtual); bloco.push(linhaAtual); valorEm.set(linhaAtual, valores); }
    const row = ws.addRow(valores);
    // Linhas de grupo e de total: o rótulo ocupa as colunas vazias seguintes, sem quebrar em coluna estreita.
    let rotuloAte = 1;
    if ((l.tipo === "grupo" || l.tipo === "total") && typeof l.valores[0] === "string") {
      while (rotuloAte < o.colunas.length && (l.valores[rotuloAte] == null || l.valores[rotuloAte] === "")) rotuloAte++;
      if (rotuloAte > 1) ws.mergeCells(row.number, 1, row.number, rotuloAte);
    }
    zebra = l.tipo === "grupo" ? false : !zebra;
    o.colunas.forEach((c, i) => {
      // Células cobertas pela mescla do rótulo repassam o estilo à primeira; não podem sobrescrevê-lo.
      if (i > 0 && i < rotuloAte) return;
      const cell = row.getCell(i + 1);
      const ehData = cell.value instanceof Date;
      if (ehData) cell.numFmt = FORMATO.data; else if (c.formato) cell.numFmt = c.formato;
      cell.alignment = i === 0 && rotuloAte > 1
        ? { vertical: "middle", horizontal: "left", wrapText: false }
        : { vertical: "top", horizontal: c.alinhar ?? (c.formato ? "right" : "left"), wrapText: !c.formato };
      cell.border = borda();
      if (l.tipo === "grupo") { cell.font = fonte({ bold: true, color: { argb: MARCA.petroleo } }); cell.fill = preencher("FFDDF3F5"); }
      else if (l.tipo === "total") {
        cell.font = fonte({ bold: true, size: 10.5 }); cell.fill = preencher("FFFDE8D3");
        cell.border = { top: { style: "medium", color: { argb: MARCA.petroleo } }, bottom: { style: "medium", color: { argb: MARCA.petroleo } } };
      } else { cell.font = fonte(); if (zebra) cell.fill = preencher(MARCA.zebra); }
    });
  }
  if (!o.linhas.length) {
    const r = ws.addRow(["Sem registros."]).number;
    if (o.colunas.length > 1) ws.mergeCells(r, 1, r, o.colunas.length);
    ws.getCell(r, 1).font = fonte({ italic: true, color: { argb: MARCA.suave } });
  }
  if (o.nota) {
    const r = ws.addRow([]).number + 1;
    ws.getCell(r, 1).value = o.nota;
    ws.getCell(r, 1).font = fonte({ size: 9, italic: true, color: { argb: MARCA.suave } });
  }
  // Com linhas de grupo mescladas o Excel não ordena; o filtro fica só nas tabelas simples.
  if (o.linhas.length && !o.linhas.some((l) => l.tipo === "grupo")) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: o.colunas.length } };
  configurarImpressao(ws, doc, o.paisagem ?? true, o.colunas.reduce((t, c) => t + c.largura, 0) > 200);
  ws.pageSetup.printTitlesRow = "5:5";
  return ws;
}

export async function responderPlanilha(wb: ExcelJS.Workbook, nomeArquivo: string) {
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

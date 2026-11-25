import { readFileSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { Celula, Planilha } from "../src/servicos/importador-sinapi";

function valor(v: unknown): Celula {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
  if (o.result !== undefined) return valor(o.result);
  if (o.richText) return o.richText.map((t) => t.text).join("");
  if (o.text !== undefined) return o.text;
  return String(v);
}

/**
 * O leitor em fluxo precisa do workbook.xml antes das abas para saber o nome de cada uma.
 * Nem todo programa grava nessa ordem, então o arquivo é reempacotado com a ordem certa.
 */
async function reordenar(conteudo: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(conteudo);
  const peso = (n: string) =>
    n === "[Content_Types].xml" ? 0 : n.startsWith("_rels/") ? 1 : n === "xl/workbook.xml" ? 2 : n.startsWith("xl/_rels/") ? 3
      : n === "xl/sharedStrings.xml" ? 4 : n.startsWith("xl/worksheets/") ? 6 : 5;
  const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort((a, b) => peso(a) - peso(b));
  const novo = new JSZip();
  for (const n of nomes) novo.file(n, await zip.files[n].async("nodebuffer"));
  return novo.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 1 } });
}

async function lerXlsx(original: Buffer, arquivo: string): Promise<Planilha[]> {
  const conteudo = await reordenar(original);
  const { PassThrough } = await import("node:stream");
  const fluxo = new PassThrough();
  fluxo.end(conteudo);
  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(fluxo, {
    sharedStrings: "cache", worksheets: "emit", hyperlinks: "ignore", styles: "ignore",
  });
  const saida: Planilha[] = [];
  for await (const aba of leitor) {
    const linhas: Celula[][] = [];
    for await (const linha of aba) {
      const v = (linha.values as unknown[]) ?? [];
      linhas[linha.number - 1] = v.slice(1).map(valor);
    }
    const nome = (aba as unknown as { name?: string }).name ?? `Aba ${saida.length + 1}`;
    saida.push({ arquivo, aba: nome, linhas: Array.from(linhas, (l) => l ?? []) });
  }
  return saida;
}

/** Lê planilhas .xlsx soltas ou dentro de .zip, como a Caixa publica. */
export async function lerPlanilhas(caminhos: string[]): Promise<Planilha[]> {
  const todas: Planilha[] = [];
  for (const caminho of caminhos) {
    const conteudo = readFileSync(caminho);
    if (caminho.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(conteudo);
      for (const [nome, entrada] of Object.entries(zip.files)) {
        if (entrada.dir || !/\.xlsx$/i.test(nome) || /^__MACOSX/.test(nome)) continue;
        todas.push(...await lerXlsx(await entrada.async("nodebuffer"), basename(nome)));
      }
    } else {
      todas.push(...await lerXlsx(conteudo, basename(caminho)));
    }
  }
  return todas;
}

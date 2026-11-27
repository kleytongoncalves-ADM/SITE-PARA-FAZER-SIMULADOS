import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { Celula, Planilha } from "../src/servicos/importador-sinapi";

function valor(v: unknown): Celula {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as { formula?: string; result?: unknown; richText?: { text: string }[]; text?: string };
  // A Caixa grava o código da composição como HYPERLINK(destino; código), com o valor guardado zerado.
  const link = typeof o.formula === "string" ? /^HYPERLINK\(.*[,;]\s*"?([\d.]+)"?\s*\)$/i.exec(o.formula.trim()) : null;
  if (link) return Number(link[1]);
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

/** Abre um .7z (formato em que o DNIT publica o SICRO) com o 7-Zip que vem com as dependências. */
async function extrair7z(caminho: string): Promise<{ nome: string; conteudo: Buffer }[]> {
  const { path7za } = await import("7zip-bin");
  try { chmodSync(path7za, 0o755); } catch {}
  const pasta = mkdtempSync(join(tmpdir(), "7z-"));
  try {
    execFileSync(path7za, ["x", "-y", "-bso0", "-bsp0", `-o${pasta}`, caminho, "*.xlsx", "-r"], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });
    const saida: { nome: string; conteudo: Buffer }[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) andar(c); else saida.push({ nome: n, conteudo: readFileSync(c) });
      }
    };
    andar(pasta);
    return saida;
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

/**
 * Lê planilhas .xlsx soltas ou dentro de .zip (como a Caixa publica) ou .7z (como o DNIT publica).
 * `aceitar` escolhe, pelo nome, quais planilhas de dentro do pacote ler.
 */
export async function lerPlanilhas(caminhos: string[], aceitar: (nome: string) => boolean = () => true): Promise<Planilha[]> {
  const todas: Planilha[] = [];
  for (const caminho of caminhos) {
    const minusculo = caminho.toLowerCase();
    if (minusculo.endsWith(".7z")) {
      for (const f of await extrair7z(caminho)) {
        if (/\.xlsx$/i.test(f.nome) && aceitar(f.nome)) todas.push(...await lerXlsx(f.conteudo, f.nome));
      }
      continue;
    }
    const conteudo = readFileSync(caminho);
    if (minusculo.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(conteudo);
      for (const [nome, entrada] of Object.entries(zip.files)) {
        if (entrada.dir || !/\.xlsx$/i.test(nome) || /^__MACOSX/.test(nome) || !aceitar(basename(nome))) continue;
        todas.push(...await lerXlsx(await entrada.async("nodebuffer"), basename(nome)));
      }
    } else {
      todas.push(...await lerXlsx(conteudo, basename(caminho)));
    }
  }
  return todas;
}

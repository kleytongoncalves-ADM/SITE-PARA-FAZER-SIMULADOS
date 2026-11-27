/**
 * Atualização automática do SINAPI. Roda todo mês pela tarefa agendada do GitHub
 * (.github/workflows/sinapi.yml) e também pode ser chamada à mão:
 *
 *   npm run atualizar-sinapi -- [--uf RJ] [--mes AAAA-MM] [--url https://...zip]
 *
 * Descobre o último mês carregado, baixa da Caixa os meses seguintes já publicados e
 * faz a mesma carga do importador manual: os custos das composições são conferidos
 * contra os publicados e a tabela só é liberada se a conferência passar.
 *
 * Saída: 0 quando carregou ou quando o mês ainda não foi publicado; 1 quando o download
 * foi recusado, o arquivo veio inválido, a carga falhou ou o mês está atrasado demais.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { opcoesDeConexao } from "../src/lib/db";
import { gravarCargaSinapi, interpretarSinapi } from "../src/servicos/importador-sinapi";
import { lerPlanilhas } from "./ler-planilhas";
import { obterComEspera } from "./rede";

try { process.loadEnvFile(".env"); } catch {}

/** Endereços conhecidos do arquivo mensal da Caixa. {ano} e {mes} são trocados pelo mês de referência. */
const MODELOS = (process.env.SINAPI_URL_MODELO ? [process.env.SINAPI_URL_MODELO] : []).concat([
  "https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais/SINAPI-{ano}-{mes}-formato-xlsx.zip",
  "https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais/SINAPI-{ano}-{mes}-formato-xlsx.ZIP",
]);
/** A Caixa publica por volta do dia 10 do mês seguinte. Depois deste dia sem arquivo, a tarefa falha para avisar. */
const DIA_LIMITE = 25;

export const proximoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};
/** Meses a buscar: do seguinte ao último carregado até o mês passado (no máximo os 3 mais recentes). */
export function mesesPendentes(ultimo: string | null, hoje: string): string[] {
  const atual = hoje.slice(0, 7);
  const lista: string[] = [];
  const [a, m] = atual.split("-").map(Number);
  let inicio = ultimo ? proximoMes(ultimo) : `${m <= 2 ? a - 1 : a}-${String(((m + 9) % 12) + 1).padStart(2, "0")}`;
  while (inicio < atual) { lista.push(inicio); inicio = proximoMes(inicio); }
  return lista.slice(-3);
}

type Baixado = { situacao: "ok"; conteudo: Buffer; url: string } | { situacao: "nao_publicado" } | { situacao: "recusado"; detalhe: string };

async function baixar(urls: string[]): Promise<Baixado> {
  let recusa = "";
  for (const url of urls) {
    // Arquivo já baixado (carga manual pelo GitHub): caminho dentro do repositório.
    if (!/^https?:\/\//i.test(url)) {
      if (!existsSync(url)) { recusa = `${url}: arquivo não encontrado`; continue; }
      const conteudo = readFileSync(url);
      if (conteudo.subarray(0, 2).toString("latin1") !== "PK") { recusa = `${url}: não é um arquivo ZIP`; continue; }
      return { situacao: "ok", conteudo, url };
    }
    let r: Response;
    try {
      r = await obterComEspera(url, { redirect: "follow", tempo: 180_000, headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/zip,application/octet-stream,*/*", "Accept-Language": "pt-BR,pt;q=0.9", Referer: "https://www.caixa.gov.br/site/Paginas/downloads.aspx",
      } });
    } catch (e) { recusa = `${url}: ${e instanceof Error ? e.message : e}`; continue; }
    if (r.status === 404) continue;
    if (!r.ok) { recusa = `${url}: resposta ${r.status}`; continue; }
    const conteudo = Buffer.from(await r.arrayBuffer());
    // ZIP e XLSX começam com "PK". Página de erro ou de bloqueio vem como HTML.
    if (conteudo.subarray(0, 2).toString("latin1") !== "PK") { recusa = `${url}: a resposta não é um arquivo ZIP (${conteudo.length} bytes)`; continue; }
    return { situacao: "ok", conteudo, url };
  }
  return recusa ? { situacao: "recusado", detalhe: recusa } : { situacao: "nao_publicado" };
}

async function principal() {
  const args = process.argv.slice(2);
  const opcao = (nome: string) => { const i = args.indexOf(nome); return i < 0 ? null : args[i + 1] ?? null; };
  const uf = (opcao("--uf") || process.env.SINAPI_UF || "RJ").toUpperCase();
  const mesArg = opcao("--mes") || process.env.SINAPI_MES || null;
  const urlArg = opcao("--url") || process.env.SINAPI_URL || null;
  if (mesArg && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(mesArg)) throw new Error("Mês inválido. Use AAAA-MM.");
  const banco = process.env.DATABASE_URL;
  if (!banco) throw new Error("DATABASE_URL não configurada.");

  const c = new Client(opcoesDeConexao(banco));
  await c.connect();
  let falhou = false;
  const pasta = mkdtempSync(join(tmpdir(), "sinapi-"));
  try {
    const ultimo = (await c.query("select to_char(max(mes), 'YYYY-MM') as m from tabela_preco where fonte = 'sinapi' and orgao_id is null and uf = $1", [uf])).rows[0].m as string | null;
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    // Base vazia: só a referência mais recente publicada, procurando do mês mais novo para trás.
    // Com base carregada: todos os meses que faltam, em ordem, para não deixar buraco no histórico.
    const somenteMaisRecente = !mesArg && !ultimo;
    const meses = mesArg ? [mesArg] : somenteMaisRecente ? mesesPendentes(null, hoje).reverse() : mesesPendentes(ultimo, hoje);
    console.log(`SINAPI ${uf}: último mês carregado ${ultimo ?? "nenhum"}. A buscar: ${meses.join(", ") || "nada"}.`);

    for (const mes of meses) {
      const [ano, mm] = mes.split("-");
      const r = await baixar(urlArg ? [urlArg] : MODELOS.map((u) => u.replaceAll("{ano}", ano).replaceAll("{mes}", mm)));
      if (r.situacao === "nao_publicado" && somenteMaisRecente && mes !== meses[meses.length - 1]) {
        console.log(`${mes}: ainda não publicado pela Caixa. Procurando o mês anterior.`);
        continue;
      }
      if (r.situacao === "nao_publicado") {
        const atrasado = !mesArg && proximoMes(mes) === hoje.slice(0, 7) ? Number(hoje.slice(8)) > DIA_LIMITE : !mesArg;
        console.log(`${mes}: ainda não publicado pela Caixa.${atrasado ? " Já passou do prazo habitual: confira o endereço do arquivo." : ""}`);
        if (atrasado || mesArg) falhou = true;
        continue;
      }
      if (r.situacao === "recusado") {
        // Já esperou e tentou de novo; insistir nos outros meses agora só prolonga o bloqueio.
        console.error(`${mes}: download recusado. ${r.detalhe}. Nova tentativa na próxima execução agendada.`);
        falhou = true;
        break;
      }
      const arquivo = join(pasta, `SINAPI-${ano}-${mm}.zip`);
      writeFileSync(arquivo, r.conteudo);
      console.log(`${mes}: baixado de ${r.url} (${(r.conteudo.length / 1024 / 1024).toFixed(1)} MB). Lendo...`);
      const carga = interpretarSinapi(await lerPlanilhas([arquivo]), { uf, mes: `${mes}-01` });
      console.log(`${mes}: ${carga.insumos.size} insumos, ${carga.composicoes.size} composições, ${carga.analitico.length} linhas de analítico.`);
      try {
        await c.query("begin");
        const res = await gravarCargaSinapi(c as never, carga);
        await c.query("commit");
        for (const x of res) {
          console.log(`${mes} ${x.regime === "desonerado" ? "desonerado" : "não desonerado"}: ${x.insumos} preços, ${x.conferidas} composições conferidas, ${x.divergentes} divergentes. Situação: ${x.situacao === "liberada" ? "liberada" : "em conferência"}.`);
          if (x.situacao !== "liberada") falhou = true;
        }
        for (const a of carga.avisos) console.log(`Aviso: ${a}`);
        if (somenteMaisRecente) break;
      } catch (e) {
        await c.query("rollback").catch(() => {});
        console.error(`${mes}: a carga falhou. ${e instanceof Error ? e.message : e}`);
        falhou = true;
      }
    }
  } finally {
    rmSync(pasta, { recursive: true, force: true });
    await c.end();
  }
  if (falhou) process.exit(1);
}

if (process.argv[1]?.includes("atualizar-sinapi")) principal().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

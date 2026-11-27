/**
 * Atualização automática do SICRO (DNIT). Roda todo dia pela tarefa agendada do GitHub
 * (.github/workflows/sicro.yml) e também pode ser chamada à mão:
 *
 *   npm run atualizar-sicro -- [--uf RJ] [--mes AAAA-MM] [--url https://...7z]
 *
 * O DNIT publica um arquivo .7z por UF a cada trimestre (janeiro, abril, julho e outubro),
 * cerca de dois meses depois da referência, numa página por mês. Quando sai uma versão
 * "revisada" do último trimestre carregado, a carga é refeita com ela.
 *
 * Saída: 0 quando carregou ou quando não há nada novo; 1 quando o download foi recusado,
 * o arquivo veio inválido, a carga falhou ou o trimestre está atrasado demais.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { opcoesDeConexao } from "../src/lib/db";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { interpretarSicro, relatorioDe, trimestresPendentes } from "../src/servicos/importador-sicro";
import { lerPlanilhas } from "./ler-planilhas";
import { obterComEspera } from "./rede";

try { process.loadEnvFile(".env"); } catch {}

export const BASE_SICRO = "https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro/relatorios/relatorios-sicro";

const ESTADOS: Record<string, [string, string]> = {
  AC: ["norte", "acre"], AM: ["norte", "amazonas"], AP: ["norte", "amapa"], PA: ["norte", "para"], RO: ["norte", "rondonia"],
  RR: ["norte", "roraima"], TO: ["norte", "tocantins"], AL: ["nordeste", "alagoas"], BA: ["nordeste", "bahia"], CE: ["nordeste", "ceara"],
  MA: ["nordeste", "maranhao"], PB: ["nordeste", "paraiba"], PE: ["nordeste", "pernambuco"], PI: ["nordeste", "piaui"],
  RN: ["nordeste", "rio-grande-do-norte"], SE: ["nordeste", "sergipe"], DF: ["centro-oeste", "distrito-federal"],
  GO: ["centro-oeste", "goias"], MT: ["centro-oeste", "mato-grosso"], MS: ["centro-oeste", "mato-grosso-do-sul"],
  ES: ["sudeste", "espirito-santo"], MG: ["sudeste", "minas-gerais"], RJ: ["sudeste", "rio-de-janeiro"], SP: ["sudeste", "sao-paulo"],
  PR: ["sul", "parana"], RS: ["sul", "rio-grande-do-sul"], SC: ["sul", "santa-catarina"],
};
const NOMES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Depois de tantos meses da referência sem arquivo, a tarefa falha para avisar. */
const MESES_LIMITE = 4;

const links = (html: string, base: string) =>
  [...html.matchAll(/href="([^"#]+)"/g)].map((m) => { try { return new URL(m[1].replace(/&amp;/g, "&"), base).toString(); } catch { return ""; } })
    .filter((u) => u.startsWith("https://www.gov.br/dnit/"));

/** Páginas do mês na listagem da região, a revisada primeiro. */
export function paginasDoMes(html: string, uf: string, mes: string): string[] {
  const [regiao, estado] = ESTADOS[uf] ?? [];
  if (!regiao) throw new Error(`UF desconhecida: ${uf}`);
  const [ano, mm] = mes.split("-");
  const nome = NOMES[Number(mm) - 1];
  const achados = links(html, `${BASE_SICRO}/${regiao}/${regiao}`).filter((u) => {
    const partes = new URL(u).pathname.toLowerCase().split("/");
    const i = partes.indexOf(estado);
    if (i < 0 || partes[i + 1] !== ano) return false;
    const ultimo = partes[partes.length - 1];
    return new RegExp(`^${nome}-${ano}(-revisad[oa])?$`).test(ultimo) || new RegExp(`^${uf.toLowerCase()}-${mm}-${ano}\\.(7z|zip)$`).test(ultimo);
  });
  const unicos = [...new Set(achados)];
  const peso = (u: string) => (/revisad/.test(u) ? 0 : /\.(7z|zip)$/i.test(u) ? 1 : 2);
  return unicos.sort((a, b) => peso(a) - peso(b));
}

/** Endereço do arquivo dentro da página do mês. */
export function arquivoDaPagina(html: string, pagina: string): string | null {
  return links(html, pagina).find((u) => /\.(7z|zip)$/i.test(new URL(u).pathname)) ?? null;
}

const CABECALHOS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

async function obter(url: string, tempo = 60_000): Promise<Response> {
  return obterComEspera(url, { redirect: "follow", tempo, headers: CABECALHOS });
}

type Achado = { situacao: "ok"; conteudo: Buffer; url: string; extensao: string } | { situacao: "nao_publicado" } | { situacao: "recusado"; detalhe: string };

async function baixarArquivo(url: string): Promise<Achado> {
  const r = await obter(url, 300_000);
  if (r.status === 404) return { situacao: "nao_publicado" };
  if (!r.ok) return { situacao: "recusado", detalhe: `${url}: resposta ${r.status}` };
  const conteudo = Buffer.from(await r.arrayBuffer());
  const inicio = conteudo.subarray(0, 6).toString("hex");
  if (inicio === "377abcaf271c") return { situacao: "ok", conteudo, url, extensao: "7z" };
  if (inicio.startsWith("504b")) return { situacao: "ok", conteudo, url, extensao: "zip" };
  return { situacao: "recusado", detalhe: `${url}: a resposta não é um arquivo .7z ou .zip (${conteudo.length} bytes)` };
}

async function procurar(uf: string, mes: string): Promise<Achado> {
  const [regiao] = ESTADOS[uf];
  let lista: Response;
  try { lista = await obter(`${BASE_SICRO}/${regiao}/${regiao}`); } catch (e) { return { situacao: "recusado", detalhe: `listagem do DNIT: ${e instanceof Error ? e.message : e}` }; }
  if (!lista.ok) return { situacao: "recusado", detalhe: `listagem do DNIT: resposta ${lista.status}` };
  const paginas = paginasDoMes(await lista.text(), uf, mes);
  for (const p of paginas) {
    try {
      if (/\.(7z|zip)$/i.test(p)) return await baixarArquivo(p);
      const r = await obter(p);
      if (!r.ok) continue;
      const arquivo = arquivoDaPagina(await r.text(), p);
      if (arquivo) return await baixarArquivo(arquivo);
    } catch (e) {
      return { situacao: "recusado", detalhe: `${p}: ${e instanceof Error ? e.message : e}` };
    }
  }
  return { situacao: "nao_publicado" };
}

async function principal() {
  const args = process.argv.slice(2);
  const opcao = (nome: string) => { const i = args.indexOf(nome); return i < 0 ? null : args[i + 1] ?? null; };
  const uf = (opcao("--uf") || process.env.SICRO_UF || "RJ").toUpperCase();
  const mesArg = opcao("--mes") || process.env.SICRO_MES || null;
  const urlArg = opcao("--url") || process.env.SICRO_URL || null;
  if (!ESTADOS[uf]) throw new Error(`UF desconhecida: ${uf}`);
  if (mesArg && !/^20\d{2}-(01|04|07|10)$/.test(mesArg)) throw new Error("Mês inválido. O SICRO sai em janeiro, abril, julho e outubro (AAAA-MM).");
  const banco = process.env.DATABASE_URL;
  if (!banco) throw new Error("DATABASE_URL não configurada.");

  const c = new Client(opcoesDeConexao(banco));
  await c.connect();
  let falhou = false;
  const pasta = mkdtempSync(join(tmpdir(), "sicro-"));
  try {
    const u = (await c.query(
      `select to_char(mes, 'YYYY-MM') as m, conferencia->>'origem' as origem from tabela_preco
        where fonte = 'sicro' and orgao_id is null and uf = $1 order by mes desc limit 1`, [uf])).rows[0] as { m: string; origem: string | null } | undefined;
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    // Base vazia: só o trimestre mais recente publicado, do mais novo para trás.
    const somenteMaisRecente = !mesArg && !u;
    const pendentes = mesArg ? [mesArg] : somenteMaisRecente ? trimestresPendentes(null, hoje).reverse() : trimestresPendentes(u?.m ?? null, hoje);
    // O último carregado entra de novo na busca para pegar a versão revisada, se sair.
    const meses = !mesArg && u && !/revisad/.test(u.origem ?? "") ? [u.m, ...pendentes] : pendentes;
    console.log(`SICRO ${uf}: último trimestre carregado ${u?.m ?? "nenhum"}. A buscar: ${meses.join(", ") || "nada"}.`);

    for (const mes of meses) {
      const r = urlArg ? await baixarArquivo(urlArg) : await procurar(uf, mes);
      const reconferencia = mes === u?.m && !mesArg;
      if (r.situacao === "nao_publicado") {
        if (reconferencia) continue;
        if (somenteMaisRecente && mes !== meses[meses.length - 1]) { console.log(`${mes}: ainda não publicado pelo DNIT. Procurando o trimestre anterior.`); continue; }
        const [a, m] = mes.split("-").map(Number);
        const atraso = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - (a * 12 + m);
        const atrasado = mesArg != null || atraso > MESES_LIMITE;
        console.log(`${mes}: ainda não publicado pelo DNIT.${atrasado ? " Já passou do prazo habitual: confira a página do SICRO." : ""}`);
        if (atrasado) falhou = true;
        continue;
      }
      if (r.situacao === "recusado") { console.error(`${mes}: download recusado. ${r.detalhe}. Nova tentativa na próxima execução agendada.`); falhou = true; break; }
      if (reconferencia && (!/revisad/i.test(r.url) || r.url === u?.origem)) continue;
      const arquivo = join(pasta, `SICRO-${uf}-${mes}.${r.extensao}`);
      writeFileSync(arquivo, r.conteudo);
      console.log(`${mes}: baixado de ${r.url} (${(r.conteudo.length / 1024 / 1024).toFixed(1)} MB). Lendo...`);
      try {
        const carga = interpretarSicro(await lerPlanilhas([arquivo], (n) => relatorioDe(n) !== null), { uf, mes: `${mes}-01` });
        carga.origem = r.url;
        console.log(`${mes}: ${carga.insumos.size} insumos, ${carga.composicoes.size} composições, ${carga.analitico.length} linhas de analítico.`);
        await c.query("begin");
        const res = await gravarCargaSinapi(c as never, carga, "sicro");
        await c.query("commit");
        for (const x of res) {
          console.log(`${mes} ${x.regime === "desonerado" ? "com desoneração" : "sem desoneração"}: ${x.insumos} preços, ${x.conferidas} composições conferidas, ${x.divergentes} divergentes. Situação: ${x.situacao === "liberada" ? "liberada" : "em conferência"}.`);
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

if (process.argv[1]?.includes("atualizar-sicro")) principal().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

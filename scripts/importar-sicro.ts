/**
 * Carga do SICRO (DNIT), feita à mão com o arquivo baixado do site do DNIT.
 *
 *   npm run importar-sicro -- <arquivo .7z, .zip ou os .xlsx> [--uf RJ] [--mes AAAA-MM]
 *
 * Use a conexão de administrador do banco (DATABASE_URL). A carga confere o custo de cada
 * composição contra o publicado e só libera a tabela se a conferência passar.
 */
import { Client } from "pg";
import { opcoesDeConexao } from "../src/lib/db";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { interpretarSicro, relatorioDe } from "../src/servicos/importador-sicro";
import { lerPlanilhas } from "./ler-planilhas";

try { process.loadEnvFile(".env"); } catch {}

async function principal() {
  const args = process.argv.slice(2);
  const opcao = (nome: string) => {
    const i = args.indexOf(nome);
    if (i < 0) return null;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const uf = opcao("--uf");
  const mesArg = opcao("--mes");
  if (mesArg && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(mesArg)) throw new Error("Mês inválido. Use AAAA-MM.");
  if (!args.length) throw new Error("Informe o arquivo do SICRO (.7z, .zip ou .xlsx).");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");

  console.log(`Lendo ${args.length} arquivo(s)...`);
  const planilhas = await lerPlanilhas(args, (n) => relatorioDe(n) !== null);
  const carga = interpretarSicro(planilhas, { uf, mes: mesArg ? `${mesArg}-01` : null });
  console.log(`SICRO ${carga.uf} ${carga.mes.slice(0, 7)}: ${carga.insumos.size} insumos, ${carga.composicoes.size} composições, ${carga.analitico.length} linhas de analítico.`);

  const c = new Client(opcoesDeConexao(url));
  await c.connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c as never, carga, "sicro");
    await c.query("commit");
    for (const x of r) {
      console.log(`${x.regime === "desonerado" ? "Com desoneração" : "Sem desoneração"}: ${x.insumos} preços, ${x.conferidas} composições conferidas, ${x.divergentes} divergentes. Situação: ${x.situacao === "liberada" ? "liberada" : "em conferência"}.`);
    }
    for (const a of carga.avisos) console.log(`Aviso: ${a}`);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

principal().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

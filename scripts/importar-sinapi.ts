/**
 * Carga mensal do SINAPI.
 *
 *   npm run importar-sinapi -- <arquivo.xlsx ou .zip> [mais arquivos] [--uf RJ] [--mes AAAA-MM]
 *
 * Use a conexão de administrador do banco (DATABASE_URL). A carga confere os custos das
 * composições contra os publicados e só libera a tabela para uso se a conferência passar.
 */
import { Client } from "pg";
import { opcoesDeConexao } from "../src/lib/db";
import { gravarCargaSinapi, interpretarSinapi } from "../src/servicos/importador-sinapi";
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
  const uf = (opcao("--uf") ?? "RJ").toUpperCase();
  const mesArg = opcao("--mes");
  if (!args.length) throw new Error("Informe o arquivo do SINAPI (.xlsx ou .zip).");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");

  console.log(`Lendo ${args.length} arquivo(s)...`);
  const planilhas = await lerPlanilhas(args);
  const carga = interpretarSinapi(planilhas, { uf, mes: mesArg ? `${mesArg}-01` : null });
  console.log(`${carga.uf} ${carga.mes.slice(0, 7)}: ${carga.insumos.size} insumos, ${carga.composicoes.size} composições, ${carga.analitico.length} linhas de analítico.`);

  const c = new Client(opcoesDeConexao(url));
  await c.connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c as never, carga);
    await c.query("commit");
    for (const x of r) {
      console.log(`${x.regime === "desonerado" ? "Desonerado" : "Não desonerado"}: ${x.insumos} preços, ${x.composicoes} custos publicados, ${x.conferidas} conferidas, ${x.divergentes} divergentes. Situação: ${x.situacao === "liberada" ? "liberada" : "em conferência"}.`);
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

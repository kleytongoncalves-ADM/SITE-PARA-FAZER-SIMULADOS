import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/** Aplica, em ordem, as migrações de db/migracoes que ainda não foram aplicadas. */
export async function migrar(url: string, opcoes: { recriar?: boolean } = {}) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    if (opcoes.recriar) {
      await c.query("drop schema public cascade; create schema public;");
    }
    await c.query("create table if not exists migracao (nome text primary key, aplicada_em timestamptz not null default now())");
    const pasta = join(process.cwd(), "db", "migracoes");
    const arquivos = readdirSync(pasta).filter((a) => a.endsWith(".sql")).sort();
    const aplicadas: string[] = [];
    for (const arquivo of arquivos) {
      const ja = await c.query("select 1 from migracao where nome = $1", [arquivo]);
      if (ja.rowCount) continue;
      await c.query("begin");
      try {
        await c.query(readFileSync(join(pasta, arquivo), "utf8"));
        await c.query("insert into migracao (nome) values ($1)", [arquivo]);
        await c.query("commit");
        aplicadas.push(arquivo);
      } catch (erro) {
        await c.query("rollback");
        throw erro;
      }
    }
    return aplicadas;
  } finally {
    await c.end();
  }
}

if (process.argv[1]?.endsWith("migrar.ts")) {
  process.loadEnvFile?.(".env");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  migrar(url).then((a) => console.log(a.length ? `Migrações aplicadas: ${a.join(", ")}` : "Banco já atualizado."));
}

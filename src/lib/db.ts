import { Pool, type PoolClient, type PoolConfig } from "pg";
import { CA_BANCO } from "./ca-banco";

declare global {
  var __civiobraPool: Pool | undefined;
  var __civiobraPapelConferido: boolean | undefined;
}

/**
 * Opções de conexão. Em banco remoto a conexão é sempre cifrada e o certificado
 * é conferido. O parâmetro sslmode da URL é retirado porque, no driver, ele
 * passaria por cima desta configuração.
 */
export function opcoesDeConexao(url: string): PoolConfig {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  const daSupabase = /\.supabase\.(com|co)$/.test(u.hostname);
  return {
    connectionString: u.toString(),
    ssl: local ? false : daSupabase ? { ca: CA_BANCO, rejectUnauthorized: true } : { rejectUnauthorized: true },
    max: Number(process.env.DATABASE_CONEXOES ?? (process.env.NODE_ENV === "production" ? 3 : 10)),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  };
}

export function pool(): Pool {
  if (!globalThis.__civiobraPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    globalThis.__civiobraPool = new Pool(opcoesDeConexao(url));
  }
  return globalThis.__civiobraPool;
}

/**
 * O isolamento entre órgãos é feito pelo banco. Um papel administrativo ignora
 * essa proteção, então em produção o sistema se recusa a funcionar com ele.
 */
export async function conferirPapelDoBanco(): Promise<void> {
  if (globalThis.__civiobraPapelConferido) return;
  const r = await pool().query(
    "select current_user as papel, rolsuper, rolbypassrls from pg_roles where rolname = current_user",
  );
  const p = r.rows[0];
  if (p && (p.rolsuper || p.rolbypassrls)) {
    const msg = `O papel de banco "${p.papel}" ignora a proteção por órgão. Use o papel do sistema (db/producao/papel-do-sistema.sql).`;
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    console.warn(msg);
  }
  globalThis.__civiobraPapelConferido = true;
}

export async function fecharPool() {
  await globalThis.__civiobraPool?.end();
  globalThis.__civiobraPool = undefined;
  globalThis.__civiobraPapelConferido = undefined;
}

/** Quem está fazendo a operação. Vai para o banco em toda transação. */
export type Contexto = { usuarioId: string | null; orgaoId: string; operadorId?: string };

/** Erro de regra de negócio, com mensagem pronta para mostrar ao usuário. */
export class ErroDeRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeRegra";
  }
}

function traduzir(erro: unknown): unknown {
  const e = erro as { code?: string; message?: string; constraint?: string };
  if (e?.code === "P0001" && e.message) return new ErroDeRegra(e.message);
  if (e?.code === "23505") {
    if (e.constraint === "obra_orgao_id_codigo_key") return new ErroDeRegra("Já existe uma obra com este código.");
    if (e.constraint === "usuario_email_unico") return new ErroDeRegra("Já existe um usuário com este e-mail.");
    if (e.constraint === "orgao_cnpj_key") return new ErroDeRegra("Já existe uma empresa com este CNPJ.");
    if (e.constraint === "vinculo_ativo_unico") return new ErroDeRegra("Esta pessoa já tem este papel na obra.");
    return new ErroDeRegra("Registro duplicado.");
  }
  if (e?.code === "23514") return new ErroDeRegra("Algum valor informado está fora do permitido. Confira datas e números.");
  return erro;
}

/**
 * Executa uma transação com o órgão e o usuário gravados no banco.
 * O isolamento por órgão e a auditoria dependem deste contexto.
 */
export async function comContexto<T>(ctx: Contexto, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await conferirPapelDoBanco();
  const c = await pool().connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('app.orgao_id', $1, true), set_config('app.usuario_id', $2, true), set_config('app.operador_id', $3, true)",
      [ctx.orgaoId, ctx.usuarioId ?? "", ctx.operadorId ?? ""],
    );
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (erro) {
    await c.query("rollback").catch(() => {});
    throw traduzir(erro);
  } finally {
    c.release();
  }
}

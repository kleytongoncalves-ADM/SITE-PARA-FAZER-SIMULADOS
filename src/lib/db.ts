import { Pool, type PoolClient } from "pg";

declare global {
  var __civiobraPool: Pool | undefined;
}

export function pool(): Pool {
  if (!globalThis.__civiobraPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    globalThis.__civiobraPool = new Pool({ connectionString: url, max: 10 });
  }
  return globalThis.__civiobraPool;
}

export async function fecharPool() {
  await globalThis.__civiobraPool?.end();
  globalThis.__civiobraPool = undefined;
}

/** Quem está fazendo a operação. Vai para o banco em toda transação. */
export type Contexto = { usuarioId: string | null; orgaoId: string };

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
  const c = await pool().connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.orgao_id', $1, true), set_config('app.usuario_id', $2, true)", [
      ctx.orgaoId,
      ctx.usuarioId ?? "",
    ]);
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

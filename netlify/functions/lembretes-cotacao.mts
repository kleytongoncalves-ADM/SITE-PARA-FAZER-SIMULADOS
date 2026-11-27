import { createHash, createHmac } from "node:crypto";

/**
 * Tarefa agendada: de hora em hora, pede ao sistema para mandar o lembrete de
 * prazo das cotações que terminam nas próximas 24 horas. A chave é calculada das
 * mesmas variáveis que o sistema usa (COTACAO_SEGREDO ou DATABASE_URL).
 */
export default async () => {
  const base = process.env.URL;
  const s = process.env.COTACAO_SEGREDO || process.env.DATABASE_URL;
  if (!base || !s) return new Response("Sem configuração", { status: 200 });
  const segredo = createHash("sha256").update(`cotacao-link:${s}`).digest();
  const chave = createHmac("sha256", segredo).update("tarefa:lembretes").digest("hex");
  const r = await fetch(`${base}/api/tarefas/lembretes`, { method: "POST", headers: { "x-chave-tarefa": chave } });
  return new Response(await r.text(), { status: r.status });
};

export const config = { schedule: "@hourly" };

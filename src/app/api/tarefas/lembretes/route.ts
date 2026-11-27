import { timingSafeEqual } from "node:crypto";
import { enviarLembretes } from "@/servicos/avisos-cotacao";
import { chaveDeTarefa } from "@/servicos/cotacoes";

export const dynamic = "force-dynamic";

/** Lembrete de prazo das cotações. Chamado de hora em hora pela tarefa agendada do Netlify (netlify/functions/lembretes-cotacao.mts). */
export async function POST(request: Request) {
  const recebida = Buffer.from(request.headers.get("x-chave-tarefa") ?? "");
  const esperada = Buffer.from(chaveDeTarefa("lembretes"));
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return new Response("Não autorizado", { status: 401 });
  const enviados = await enviarLembretes();
  return Response.json({ enviados });
}

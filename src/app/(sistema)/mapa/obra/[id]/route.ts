import { ErroDeRegra } from "@/lib/db";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { fichaDaObra } from "@/servicos/mapa";

export const dynamic = "force-dynamic";

/** Ficha completa da obra, carregada quando ela é escolhida no mapa. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return Response.json({ erro: "Sessão encerrada. Entre de novo." }, { status: 401 });
  try {
    return Response.json(await fichaDaObra(comoAtor(u), id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ErroDeRegra) return Response.json({ erro: e.message }, { status: 404 });
    throw e;
  }
}

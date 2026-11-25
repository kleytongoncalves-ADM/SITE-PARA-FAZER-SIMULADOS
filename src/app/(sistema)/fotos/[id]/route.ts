import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { lerFoto } from "@/servicos/campo";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const mini = new URL(req.url).searchParams.has("mini");
  const f = await lerFoto(comoAtor(u), id, mini);
  if (!f) return new Response("Foto não encontrada.", { status: 404 });
  return new Response(new Uint8Array(f.bytes), {
    headers: { "Content-Type": f.mime, "Cache-Control": "private, max-age=86400, immutable", "Content-Disposition": `inline; filename="foto-${id.slice(0, 8)}.jpg"` },
  });
}

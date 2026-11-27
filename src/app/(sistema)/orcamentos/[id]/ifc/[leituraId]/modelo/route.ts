import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { lerParteDoModelo } from "@/servicos/ifc";
import { SemPermissao } from "@/servicos/permissoes";

/** Uma parte do modelo 3D do projeto (?parte=0, 1, …), para a vista 3D do orçamento. */
export async function GET(req: Request, { params }: { params: Promise<{ leituraId: string }> }) {
  const { leituraId } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const parte = Number(new URL(req.url).searchParams.get("parte") ?? "0");
  let bytes: Buffer | null;
  try {
    bytes = await lerParteDoModelo(comoAtor(u), leituraId, parte);
  } catch (e) {
    if (e instanceof SemPermissao) return new Response("Sem permissão.", { status: 403 });
    throw e;
  }
  if (!bytes) return new Response("Modelo não encontrado.", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.length),
      // O modelo de uma leitura não muda depois de gravado.
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

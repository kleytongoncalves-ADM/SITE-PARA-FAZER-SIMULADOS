import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { lerArquivo } from "@/servicos/documentos";

const NA_TELA = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function GET(req: Request, { params }: { params: Promise<{ versaoId: string }> }) {
  const { versaoId } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const f = await lerArquivo(comoAtor(u), versaoId);
  if (!f) return new Response("Arquivo não encontrado.", { status: 404 });
  const baixar = new URL(req.url).searchParams.has("baixar") || !NA_TELA.has(f.mime);
  const nome = f.nome.replace(/["\\\r\n]/g, "_");
  return new Response(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.bytes.length),
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      // A versão não muda depois de enviada.
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; plugin-types application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

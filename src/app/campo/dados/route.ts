import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { dadosParaCampo } from "@/servicos/diario-campo";
import { pode } from "@/servicos/permissoes";

export const dynamic = "force-dynamic";

/** Obras, atividades e rótulos que o aparelho guarda para lançar o diário sem internet. */
export async function GET() {
  const u = await usuarioAtual();
  if (!u) return Response.json({ erro: "Sessão encerrada. Entre de novo." }, { status: 401 });
  const a = comoAtor(u);
  if (!pode(a, "diario.lancar")) return Response.json({ erro: "Seu perfil não lança diário." }, { status: 403 });
  const dados = await dadosParaCampo({ ...a, nome: u.nome, orgaoNome: u.orgaoNome });
  return Response.json(dados, { headers: { "Cache-Control": "no-store" } });
}

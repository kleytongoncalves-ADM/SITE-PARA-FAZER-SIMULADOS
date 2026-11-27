import { revalidatePath } from "next/cache";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { lerPacote, receberPacote, type ResultadoEnvio } from "@/servicos/diario-campo";

export const dynamic = "force-dynamic";

const LIMITE_BYTES = 1_000_000;
const MAX_PACOTES = 30;

/** Recebe os lançamentos feitos sem internet. Cada um é tratado à parte: um recusado não segura os outros. */
export async function POST(req: Request) {
  const origem = req.headers.get("origin");
  if (origem && new URL(origem).host !== req.headers.get("host")) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  const u = await usuarioAtual();
  if (!u) return Response.json({ erro: "Sessão encerrada. Entre de novo." }, { status: 401 });
  const corpo = await req.text();
  if (corpo.length > LIMITE_BYTES) return Response.json({ erro: "Envio grande demais. Envie menos lançamentos por vez." }, { status: 413 });
  let pacotes: unknown;
  try {
    pacotes = (JSON.parse(corpo) as { pacotes?: unknown }).pacotes;
  } catch {
    return Response.json({ erro: "Envio inválido." }, { status: 400 });
  }
  if (!Array.isArray(pacotes) || pacotes.length === 0 || pacotes.length > MAX_PACOTES) return Response.json({ erro: "Envio inválido." }, { status: 400 });
  const a = comoAtor(u);
  const resultados: ResultadoEnvio[] = [];
  for (const bruto of pacotes) {
    const p = lerPacote(bruto);
    if (typeof p === "string") {
      resultados.push({ chave: String((bruto as { chave?: unknown })?.chave ?? ""), situacao: "recusado", mensagem: p });
      continue;
    }
    const r = await receberPacote(a, p);
    resultados.push(r);
    if (r.diarioId && r.situacao === "enviado") {
      revalidatePath(`/diario/${r.diarioId}`);
      revalidatePath(`/obras/${p.obraId}/diario`);
    }
  }
  return Response.json({ resultados }, { headers: { "Cache-Control": "no-store" } });
}

import { revalidatePath } from "next/cache";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { enviarFoto, TAMANHO_MAXIMO_FOTO, type AlvoFoto } from "@/servicos/campo";
import { SemPermissao } from "@/servicos/permissoes";

const ALVOS: (keyof AlvoFoto)[] = ["diarioId", "naoConformidadeId", "ocorrenciaSegurancaId", "inspecaoId"];
const num = (v: FormDataEntryValue | null) => (v == null || v === "" ? null : Number(v));

export async function POST(req: Request) {
  // Mesma origem: o envio vem só das telas do sistema.
  const origem = req.headers.get("origin");
  if (origem && new URL(origem).host !== req.headers.get("host")) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  const u = await usuarioAtual();
  if (!u) return Response.json({ erro: "Sessão encerrada. Entre de novo." }, { status: 401 });
  const f = await req.formData();
  const arquivo = f.get("foto");
  const mini = f.get("miniatura");
  if (!(arquivo instanceof Blob) || !(mini instanceof Blob)) return Response.json({ erro: "Escolha uma foto." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) return Response.json({ erro: "A foto passa de 3 MB." }, { status: 400 });
  const alvo: AlvoFoto = {};
  for (const k of ALVOS) if (f.get(k)) alvo[k] = String(f.get(k));
  try {
    await enviarFoto(comoAtor(u), {
      obraId: String(f.get("obraId") ?? ""), alvo, momento: f.get("momento") === "depois" ? "depois" : f.get("momento") === "antes" ? "antes" : null,
      legenda: String(f.get("legenda") ?? ""), tiradaEm: String(f.get("tiradaEm") ?? "") || null,
      latitude: num(f.get("latitude")), longitude: num(f.get("longitude")), mime: arquivo.type,
      largura: Number(f.get("largura")), altura: Number(f.get("altura")),
      conteudo: Buffer.from(await arquivo.arrayBuffer()), miniatura: Buffer.from(await mini.arrayBuffer()),
    });
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
  const volta = String(f.get("caminho") ?? "");
  if (volta.startsWith("/")) revalidatePath(volta);
  return Response.json({ ok: true });
}

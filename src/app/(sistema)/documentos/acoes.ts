"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { baixarArt, dispensarExigencia, enviarDocumento, novaVersao, salvarDocumento, superarDocumento, type Arquivo, type DadosDocumento } from "@/servicos/documentos";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}

async function arquivo(f: FormData): Promise<Arquivo> {
  const a = f.get("arquivo");
  if (!(a instanceof File) || !a.size) return { nome: "", conteudo: Buffer.alloc(0) };
  return { nome: a.name, conteudo: Buffer.from(await a.arrayBuffer()) };
}

function dados(f: FormData): Omit<DadosDocumento, "categoria"> {
  return {
    tipo: t(f, "tipo"), titulo: t(f, "titulo"), numero: t(f, "numero") || null, emissor: t(f, "emissor") || null,
    emissao: t(f, "emissao") || null, validade: t(f, "validade") || null, exigencia: t(f, "exigencia") || null, contratoId: t(f, "contratoId") || null,
    conselho: t(f, "conselho") || null, profissional: t(f, "profissional") || null, registro: t(f, "registro") || null, atividade: t(f, "atividade") || null,
  };
}

function revalidar(obraId: string, id?: string) {
  revalidatePath(`/obras/${obraId}/documentos`);
  revalidatePath("/documentos");
  if (id) revalidatePath(`/documentos/${id}`);
}

export async function acaoEnviarDocumento(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  let id: string;
  try {
    id = await enviarDocumento(await ator(), obraId, { categoria: t(f, "categoria"), ...dados(f) }, await arquivo(f));
  } catch (e) { return falha(e); }
  revalidar(obraId);
  redirect(`/documentos/${id}`);
}

export async function acaoSalvarDocumento(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await salvarDocumento(await ator(), id, dados(f));
    revalidar(obraId, id);
    return { ok: "Dados atualizados." };
  } catch (e) { return falha(e); }
}

export async function acaoNovaVersao(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    const n = await novaVersao(await ator(), id, await arquivo(f), t(f, "mudanca"));
    revalidar(obraId, id);
    return { ok: `Versão ${n} registrada.` };
  } catch (e) { return falha(e); }
}

export async function acaoSuperar(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await superarDocumento(await ator(), id, t(f, "substitutoId"), t(f, "motivo"));
    revalidar(obraId, id);
    revalidatePath(`/documentos/${t(f, "substitutoId")}`);
    return { ok: "Documento marcado como superado." };
  } catch (e) { return falha(e); }
}

export async function acaoBaixarArt(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await baixarArt(await ator(), id, t(f, "data"));
    revalidar(obraId, id);
    return { ok: "Baixa registrada." };
  } catch (e) { return falha(e); }
}

export async function acaoDispensar(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await dispensarExigencia(await ator(), obraId, t(f, "exigencia"), t(f, "justificativa"));
    revalidar(obraId);
    return { ok: "Dispensa registrada." };
  } catch (e) { return falha(e); }
}

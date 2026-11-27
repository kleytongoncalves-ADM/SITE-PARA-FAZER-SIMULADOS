"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import type { LeituraIfc } from "@/lib/ifc/quantitativos";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { guardarParteDoModelo, lancarQuantitativo, modelo3dDisponivel, registrarLeituraIfc, removerLeituraIfc, type MedidaLancamento } from "@/servicos/ifc";
import { SemPermissao } from "@/servicos/permissoes";

type Estado = { erro?: string; ok?: string };
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());
const falha = (e: unknown): Estado => {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
};

export async function acaoRegistrarIfc(id: string, dados: { arquivo: string; tamanho: number; leitura: LeituraIfc }): Promise<Estado & { leituraId?: string; modelo3d?: boolean }> {
  const a = await ator();
  let leituraId: string;
  try {
    leituraId = await registrarLeituraIfc(a, id, dados);
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/orcamentos/${id}/ifc`);
  return { leituraId, modelo3d: modelo3dDisponivel() };
}

/** Recebe uma parte do modelo 3D compactado (campo "parte" do formulário). */
export async function acaoGuardarModeloIfc(id: string, leituraId: string, parte: number, total: number, f: FormData): Promise<Estado> {
  const a = await ator();
  const arquivo = f.get("parte");
  if (!(arquivo instanceof Blob)) return { erro: "Modelo 3D inválido." };
  try {
    await guardarParteDoModelo(a, id, leituraId, parte, total, Buffer.from(await arquivo.arrayBuffer()));
  } catch (e) {
    return falha(e);
  }
  return {};
}

export async function acaoLancarIfc(id: string, quantitativoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    await lancarQuantitativo(a, id, quantitativoId, {
      tipo: t(f, "tipo") === "insumo" ? "insumo" : "composicao", refId: t(f, "refId"), etapaId: t(f, "etapaId"),
      medida: t(f, "medida") as MedidaLancamento, multiplicador: t(f, "multiplicador"),
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/orcamentos/${id}`, "layout");
  return { ok: "Item incluído." };
}

export async function acaoRemoverLeituraIfc(id: string, leituraId: string): Promise<Estado> {
  const a = await ator();
  try {
    await removerLeituraIfc(a, id, leituraId);
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/orcamentos/${id}/ifc`);
  redirect(`/orcamentos/${id}/ifc`);
}

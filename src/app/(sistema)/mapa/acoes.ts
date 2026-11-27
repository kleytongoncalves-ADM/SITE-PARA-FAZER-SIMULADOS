"use server";

import { revalidatePath } from "next/cache";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { definirLocal } from "@/servicos/mapa";
import { SemPermissao } from "@/servicos/permissoes";

export async function acaoDefinirLocal(obraId: string, latitude: number, longitude: number): Promise<{ erro?: string }> {
  const a = comoAtor(await exigirUsuario());
  try {
    await definirLocal(a, obraId, latitude, longitude);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
    throw e;
  }
  revalidatePath("/mapa");
  revalidatePath(`/obras/${obraId}`);
  return {};
}

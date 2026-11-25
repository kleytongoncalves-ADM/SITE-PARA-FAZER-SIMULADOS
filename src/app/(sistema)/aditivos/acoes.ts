"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  assinarAditivo, cancelarAditivo, criarAditivo, incluirItem, registrarRevisao, removerItem, salvarAditivo, type TipoRevisao,
} from "@/servicos/aditivos";
import type { Executor } from "@/servicos/contratos";
import { SemPermissao } from "@/servicos/permissoes";
import type { Fonte } from "@/servicos/precos";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}

async function executar(id: string, contratoId: string, fn: () => Promise<unknown>, ok?: string): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/aditivos/${id}`);
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/contratos");
  return ok ? { ok } : {};
}

const dados = (f: FormData) => ({
  objeto: t(f, "objeto"), justificativa: t(f, "justificativa"), fundamento: t(f, "fundamento"), prazoDias: t(f, "prazoDias"), novaVigencia: t(f, "novaVigencia"),
});

export async function acaoNovoAditivo(contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await criarAditivo(a, contratoId, dados(f));
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/aditivos/${id}`);
}

export async function acaoSalvarAditivo(id: string, contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const linhas = f.getAll("item").map((v) => ({ itemServicoId: String(v), variacao: t(f, `v_${String(v)}`) }));
  return executar(id, contratoId, () => salvarAditivo(a, id, { ...dados(f), linhas }), "Aditivo salvo.");
}

export async function acaoIncluirItem(id: string, contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, contratoId, () => incluirItem(a, id, {
    etapa: t(f, "etapa") === "__nova" ? t(f, "etapaNova") : t(f, "etapa"), descricao: t(f, "descricao"), unidade: t(f, "unidade"),
    quantidade: t(f, "quantidade"), precoUnitario: t(f, "precoUnitario"), codigo: t(f, "codigo"), fonte: t(f, "fonte") as Fonte,
    executor: t(f, "executor") as Executor,
  }), "Item incluído.");
}

export async function acaoRemoverItem(id: string, contratoId: string, itemId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, contratoId, () => removerItem(a, id, itemId));
}

export async function acaoAssinarAditivo(id: string, contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, contratoId, () => assinarAditivo(a, id, t(f, "dataAssinatura")));
}

export async function acaoCancelarAditivo(id: string, contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, contratoId, () => cancelarAditivo(a, id, t(f, "motivo")));
}

export async function acaoRevisao(contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    await registrarRevisao(a, contratoId, {
      tipo: t(f, "tipo") as TipoRevisao, inicio: t(f, "inicio"), indice: t(f, "indice"), indiceBase: t(f, "indiceBase"), indiceAtual: t(f, "indiceAtual"),
      percentual: t(f, "percentual"), justificativa: t(f, "justificativa"), documento: t(f, "documento"),
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/medicoes");
  return { ok: "Apostilamento registrado." };
}

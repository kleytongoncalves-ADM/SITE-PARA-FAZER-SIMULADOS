"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  abrirDiario, adicionarLinha, assinarDiario, complementarDiario, excluirFoto, removerLinha, repetirAnterior, salvarDiario, vistarDiario,
  type LinhaDiario, type TipoOcorrenciaDiario,
} from "@/servicos/campo";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => {
  const v = t(f, k).replace(",", ".");
  return v === "" ? null : Number(v);
};
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}

async function executar(id: string, fn: () => Promise<unknown>, ok?: string): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/diario/${id}`);
  return ok ? { ok } : {};
}

export async function acaoAbrirDiario(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await abrirDiario(a, obraId, t(f, "data"));
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/obras/${obraId}/diario`);
  redirect(`/diario/${id}`);
}

export async function acaoSalvarDiario(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => salvarDiario(a, id, { climaManha: t(f, "climaManha"), climaTarde: t(f, "climaTarde"), condicao: t(f, "condicao"), relato: t(f, "relato") }), "Diário salvo.");
}

export async function acaoAdicionarLinha(id: string, tipo: LinhaDiario["tipo"], _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const inteiro = (k: string) => {
    const v = n(f, k);
    return v == null ? 1 : Math.round(v);
  };
  const l: LinhaDiario =
    tipo === "efetivo" ? { tipo, funcao: t(f, "funcao"), empresa: t(f, "empresa"), quantidade: inteiro("quantidade") }
    : tipo === "equipamento" ? { tipo, descricao: t(f, "descricao"), quantidade: inteiro("quantidade"), horas: n(f, "horas") }
    : tipo === "servico" ? { tipo, descricao: t(f, "descricao"), local: t(f, "local"), atividadeId: t(f, "atividadeId") || null, avancoPct: n(f, "avancoPct") }
    : { tipo, subtipo: t(f, "subtipo") as TipoOcorrenciaDiario, descricao: t(f, "descricao"), motivo: t(f, "motivo") || null, horas: n(f, "horas") };
  return executar(id, () => adicionarLinha(a, id, l));
}

export async function acaoRemoverLinha(id: string, tipo: LinhaDiario["tipo"], linhaId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => removerLinha(a, id, tipo, linhaId));
}

export async function acaoRepetirAnterior(id: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => repetirAnterior(a, id));
}

export async function acaoAssinarDiario(id: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => assinarDiario(a, id), "Diário assinado.");
}

export async function acaoVistoDiario(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => vistarDiario(a, id, t(f, "observacao")), "Visto registrado.");
}

export async function acaoComplementar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => complementarDiario(a, id, t(f, "texto")));
}

export async function acaoExcluirFoto(id: string, fotoId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => excluirFoto(a, fotoId));
}

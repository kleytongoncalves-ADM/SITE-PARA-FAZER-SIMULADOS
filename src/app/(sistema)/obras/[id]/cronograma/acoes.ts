"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  adicionarAtividade, criarCronograma, editarAtividade, gravarLinhaBase, novaVersaoCronograma, registrarAvanco, removerAtividade,
  salvarConfiguracao, type DadosAtividade,
} from "@/servicos/cronogramas";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}

async function executar(obraId: string, fn: () => Promise<unknown>, ok?: string): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath("/cronograma");
  return ok ? { ok } : {};
}

const lerAtividade = (f: FormData): DadosAtividade => ({
  codigo: t(f, "codigo"), nome: t(f, "nome"), duracao: t(f, "duracao"), predecessoras: t(f, "predecessoras"),
  itemServicoId: t(f, "itemServicoId") || null, parcela: t(f, "parcela") || "100",
});

export async function acaoCriarCronograma(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await criarCronograma(a, t(f, "contratoId"), {
      inicio: t(f, "inicio") || null, calendario: t(f, "calendario") as "corridos" | "uteis", unidadePeriodo: t(f, "unidadePeriodo") as "semana" | "mes",
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/cronograma");
  redirect(`/obras/${obraId}/cronograma?versao=${id}`);
}

export async function acaoConfiguracao(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(obraId, () => salvarConfiguracao(a, id, {
    inicio: t(f, "inicio"), calendario: t(f, "calendario") as "corridos" | "uteis", unidadePeriodo: t(f, "unidadePeriodo") as "semana" | "mes",
  }));
}

export async function acaoNovaAtividade(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(obraId, () => adicionarAtividade(a, id, lerAtividade(f)), "Atividade incluída.");
}

export async function acaoAtividade(obraId: string, id: string, atividadeId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  if (t(f, "acao") === "remover") return executar(obraId, () => removerAtividade(a, id, atividadeId));
  return executar(obraId, () => editarAtividade(a, id, atividadeId, lerAtividade(f)));
}

export async function acaoLinhaBase(obraId: string, id: string): Promise<Estado> {
  const a = await ator();
  return executar(obraId, () => gravarLinhaBase(a, id), "Linha de base gravada.");
}

export async function acaoNovaVersao(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let novo: string;
  try {
    novo = await novaVersaoCronograma(a, id, t(f, "motivo"));
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  redirect(`/obras/${obraId}/cronograma?versao=${novo}`);
}

export async function acaoAvanco(obraId: string, id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(obraId, () => registrarAvanco(a, id, t(f, "atividadeId"), {
    data: t(f, "data"), percentual: t(f, "percentual"), justificativa: t(f, "justificativa"),
  }), "Avanço registrado.");
}

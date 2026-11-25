"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { lerNumeroBr, texto } from "@/lib/decimal";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { adicionarItemComposicao, aprovarComposicao, criarComposicaoPropria, removerItemComposicao } from "@/servicos/precos";

type Estado = { erro?: string; ok?: string };
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}

export async function acaoCriarComposicao(tabelaId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await criarComposicaoPropria(a, {
      codigo: t(f, "codigo"), descricao: t(f, "descricao"), unidade: t(f, "unidade"), justificativa: t(f, "justificativa"), origemId: t(f, "origemId") || null,
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/precos");
  redirect(`/precos/composicoes/${id}${tabelaId ? `?tabela=${tabelaId}` : ""}`);
}

export async function acaoItemComposicao(composicaoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    if (t(f, "acao") === "remover") await removerItemComposicao(a, composicaoId, t(f, "itemId"));
    else {
      const ref = t(f, "refId");
      const lido = lerNumeroBr(t(f, "coeficiente"));
      if (lido == null || lido <= 0n) return { erro: "Informe o coeficiente." };
      const coef = texto(lido, 7);
      await adicionarItemComposicao(a, composicaoId, t(f, "tipo") === "composicao" ? { subcomposicaoId: ref, coeficiente: coef } : { insumoId: ref, coeficiente: coef });
    }
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/precos/composicoes/${composicaoId}`);
  return {};
}

export async function acaoAprovarComposicao(composicaoId: string): Promise<Estado> {
  const a = await ator();
  try {
    await aprovarComposicao(a, composicaoId);
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/precos", "layout");
  return { ok: "Composição aprovada." };
}

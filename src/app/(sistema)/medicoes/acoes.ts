"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  adicionarGlosa, adicionarRetencao, aprovarMedicao, atestarMedicao, cancelarMedicao, criarMedicao, devolverMedicao, registrarNotaFiscal,
  registrarPagamento, removerGlosa, removerRetencao, salvarBoletim, type TipoRetencao,
} from "@/servicos/medicoes";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
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
  revalidatePath(`/medicoes/${id}`);
  revalidatePath("/medicoes");
  revalidatePath("/pagamentos");
  return ok ? { ok } : {};
}

export async function acaoNovaMedicao(contratoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await criarMedicao(a, contratoId, {
      periodoInicio: t(f, "periodoInicio"), periodoFim: t(f, "periodoFim"), ajuste: t(f, "ajuste") === "sim", observacao: t(f, "observacao"),
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/medicoes");
  redirect(`/medicoes/${id}`);
}

export async function acaoBoletim(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const linhas = f.getAll("item").map((v) => {
    const item = String(v);
    return { itemServicoId: item, quantidade: t(f, `q_${item}`), memoria: t(f, `m_${item}`) };
  });
  return executar(id, () => salvarBoletim(a, id, {
    periodoInicio: t(f, "periodoInicio"), periodoFim: t(f, "periodoFim"), observacao: t(f, "observacao"), linhas,
  }), "Boletim salvo.");
}

export async function acaoAtestar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => atestarMedicao(a, id, t(f, "observacao")));
}

export async function acaoAprovar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => aprovarMedicao(a, id, t(f, "observacao")));
}

export async function acaoDevolver(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => devolverMedicao(a, id, t(f, "motivo")));
}

export async function acaoCancelar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => cancelarMedicao(a, id, t(f, "motivo")));
}

export async function acaoGlosa(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => adicionarGlosa(a, id, { motivo: t(f, "motivo"), valor: t(f, "valor"), itemServicoId: t(f, "itemServicoId") || null }), "Glosa registrada.");
}

export async function acaoRemoverGlosa(id: string, glosaId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => removerGlosa(a, id, glosaId));
}

export async function acaoRetencao(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => adicionarRetencao(a, id, {
    tipo: t(f, "tipo") as TipoRetencao, base: t(f, "base"), aliquota: t(f, "aliquota"), descricao: t(f, "descricao"),
  }), "Retenção registrada.");
}

export async function acaoRemoverRetencao(id: string, retencaoId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => removerRetencao(a, id, retencaoId));
}

export async function acaoNotaFiscal(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => registrarNotaFiscal(a, id, { numero: t(f, "numero"), data: t(f, "data"), valor: t(f, "valor") }), "Nota fiscal registrada.");
}

export async function acaoPagamento(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => registrarPagamento(a, id, {
    data: t(f, "data"), valor: t(f, "valor"), empenho: t(f, "empenho"), liquidacao: t(f, "liquidacao"), ordemBancaria: t(f, "ordemBancaria"),
  }), "Pagamento registrado.");
}

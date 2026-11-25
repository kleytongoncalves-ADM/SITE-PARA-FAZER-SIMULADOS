"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import {
  adicionarItemRequisicao, cancelarPedido, cancelarRequisicao, criarRequisicao, decidirRequisicao, definirMinimo, emitirPedido, enviarRequisicao,
  importarDoOrcamento, registrarCotacao, registrarMovimento, registrarRecebimento, removerItemRequisicao, salvarMaterial,
} from "@/servicos/suprimentos";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}
function revalidar(obraId?: string) {
  if (obraId) revalidatePath(`/obras/${obraId}/suprimentos`);
  revalidatePath("/suprimentos");
}

export async function acaoImportarMateriais(obraId: string): Promise<Estado> {
  try {
    const n = await importarDoOrcamento(await ator(), obraId);
    revalidar(obraId);
    return { ok: n ? `${n} ${n === 1 ? "material incluído" : "materiais incluídos"} no catálogo.` : "Os materiais do orçamento já estão no catálogo." };
  } catch (e) { return falha(e); }
}

export async function acaoSalvarMaterial(id: string | null, _: Estado, f: FormData): Promise<Estado> {
  try {
    await salvarMaterial(await ator(), id, {
      codigo: t(f, "codigo"), descricao: t(f, "descricao"), unidade: t(f, "unidade"), grupo: t(f, "grupo"), perdaPrevista: t(f, "perdaPrevista"),
      ativo: id ? f.get("ativo") === "sim" : true,
    });
    revalidatePath("/suprimentos/materiais");
    return { ok: id ? "Material atualizado." : "Material incluído." };
  } catch (e) { return falha(e); }
}

export async function acaoNovaRequisicao(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  let id: string;
  try {
    id = await criarRequisicao(await ator(), obraId, { necessidade: t(f, "necessidade"), observacao: t(f, "observacao") });
  } catch (e) { return falha(e); }
  revalidar(obraId);
  redirect(`/requisicoes/${id}`);
}

export async function acaoItemRequisicao(id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await adicionarItemRequisicao(await ator(), id, {
      materialId: t(f, "materialId"), quantidade: t(f, "quantidade"), itemServicoId: t(f, "itemServicoId") || null, justificativa: t(f, "justificativa"),
    });
    revalidatePath(`/requisicoes/${id}`);
    return {};
  } catch (e) { return falha(e); }
}

export async function acaoRemoverItemRequisicao(id: string, itemId: string): Promise<Estado> {
  try {
    await removerItemRequisicao(await ator(), itemId);
    revalidatePath(`/requisicoes/${id}`);
    return {};
  } catch (e) { return falha(e); }
}

export async function acaoTramiteRequisicao(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const passo = t(f, "passo");
  try {
    if (passo === "enviar") await enviarRequisicao(a, id);
    else if (passo === "aprovar") await decidirRequisicao(a, id, true);
    else if (passo === "recusar") await decidirRequisicao(a, id, false, t(f, "motivo"));
    else if (passo === "cancelar") await cancelarRequisicao(a, id, t(f, "motivo"));
    else return { erro: "Ação inválida." };
  } catch (e) { return falha(e); }
  revalidatePath(`/requisicoes/${id}`);
  revalidar(obraId);
  return { ok: { enviar: "Requisição enviada para aprovação.", aprovar: "Requisição aprovada.", recusar: "Requisição recusada.", cancelar: "Requisição cancelada." }[passo] };
}

export async function acaoCotacao(id: string, _: Estado, f: FormData): Promise<Estado> {
  const precos: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("preco_")) precos[k.slice(6)] = String(v);
  try {
    await registrarCotacao(await ator(), id, {
      empresaId: t(f, "empresaId"), validade: t(f, "validade") || null, prazoEntrega: t(f, "prazoEntrega"), condicaoPagamento: t(f, "condicaoPagamento"),
      frete: t(f, "frete"), observacao: t(f, "observacao"), precos,
    });
    revalidatePath(`/requisicoes/${id}`);
    return { ok: "Cotação registrada." };
  } catch (e) { return falha(e); }
}

export async function acaoEmitirPedido(requisicaoId: string, cotacaoId: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  let id: string;
  try {
    id = await emitirPedido(await ator(), cotacaoId, { itens: f.getAll("item").map(String), prazoEntrega: t(f, "prazoEntrega") || null, justificativa: t(f, "justificativa") });
  } catch (e) { return falha(e); }
  revalidatePath(`/requisicoes/${requisicaoId}`);
  revalidar(obraId);
  redirect(`/pedidos/${id}`);
}

export async function acaoRecebimento(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const itens = f.getAll("item").map(String).map((pid) => ({
    pedidoItemId: pid, quantidade: t(f, `q_${pid}`), recusada: t(f, `r_${pid}`), motivo: t(f, `m_${pid}`),
  }));
  try {
    await registrarRecebimento(await ator(), id, {
      data: t(f, "data"), notaFiscal: t(f, "notaFiscal"), notaQualidade: Number(t(f, "notaQualidade")), notaAtendimento: Number(t(f, "notaAtendimento")),
      observacao: t(f, "observacao"), itens,
    });
    revalidatePath(`/pedidos/${id}`);
    revalidar(obraId);
    return { ok: "Recebimento registrado. O material entrou no estoque da obra." };
  } catch (e) { return falha(e); }
}

export async function acaoCancelarPedido(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await cancelarPedido(await ator(), id, t(f, "motivo"));
    revalidatePath(`/pedidos/${id}`);
    revalidar(obraId);
    return { ok: "Pedido cancelado." };
  } catch (e) { return falha(e); }
}

export async function acaoMovimento(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await registrarMovimento(await ator(), obraId, {
      tipo: t(f, "tipo"), materialId: t(f, "materialId"), quantidade: t(f, "quantidade"), data: t(f, "data"), itemServicoId: t(f, "itemServicoId") || null,
      obraDestinoId: t(f, "obraDestinoId") || null, observacao: t(f, "observacao"), custoUnitario: t(f, "custoUnitario") || null,
    });
    revalidar(obraId);
    return { ok: "Movimento registrado." };
  } catch (e) { return falha(e); }
}

export async function acaoMinimo(obraId: string, materialId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await definirMinimo(await ator(), obraId, materialId, t(f, "minimo"));
    revalidar(obraId);
    return {};
  } catch (e) { return falha(e); }
}

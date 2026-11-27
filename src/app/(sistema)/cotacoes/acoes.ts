"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { FATORES, type Criterio, type Pesos } from "@/servicos/cotacao-calculo";
import {
  adicionarConvite, avaliarItem, convidarPorEmail, gerarLinkAberto, reenviarEmail, type LinhaConvite, cancelar, escolherComparadas, criarSolicitacao, encerrarAntes, enviarSolicitacao, excluirRascunho, homologar, lancarProposta, novoLink,
  prorrogar, reabrir, removerAvaliacao, removerConvite, type DadosProposta,
} from "@/servicos/cotacoes";
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
  revalidatePath(`/cotacoes/${id}`, "layout");
  revalidatePath("/cotacoes");
  return ok ? { ok } : {};
}

export async function acaoCriarSolicitacao(orcamentoId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await criarSolicitacao(a, orcamentoId, {
      titulo: t(f, "titulo"), prazo: t(f, "prazo"), localEntrega: t(f, "localEntrega"), freteIncluso: f.get("freteIncluso") === "on",
      validadeMinima: t(f, "validadeMinima"), observacao: t(f, "observacao"), criterio: t(f, "criterio") as Criterio,
      pesos: Object.fromEntries(FATORES.map((k) => [k, Number(t(f, `peso_${k}`) || 0)])) as Pesos,
      sigilo: f.get("sigilo") === "on", chaves: f.getAll("chave").map(String),
    });
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/orcamentos/${orcamentoId}`, "layout");
  redirect(`/cotacoes/${id}/fornecedores`);
}

export async function acaoConvidar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => adicionarConvite(a, id, {
    empresaId: t(f, "empresaId") || null, razaoSocial: t(f, "razaoSocial"), cnpj: t(f, "cnpj"), contato: t(f, "contato"), email: t(f, "email"),
    telefone: t(f, "telefone"), motivo: t(f, "motivo"),
  }));
}

export async function acaoConvidarPorEmail(id: string, linhas: LinhaConvite[]): Promise<Estado & { errosLinha?: Record<number, string> }> {
  const a = await ator();
  let r;
  try {
    r = await convidarPorEmail(a, id, linhas);
  } catch (e) {
    return falha(e);
  }
  if (Object.keys(r.erros).length) return { erro: "Corrija as linhas marcadas.", errosLinha: r.erros };
  revalidatePath(`/cotacoes/${id}`, "layout");
  const n = r.criados === 1 ? "1 fornecedor convidado" : `${r.criados} fornecedores convidados`;
  if (!r.aberta) return { ok: `${n}. Os e-mails saem quando a solicitação for enviada.` };
  if (r.emails.semServico) return { ok: `${n}. O envio automático de e-mail não está configurado: copie o link de cada um na lista.` };
  if (r.emails.falharam) return { ok: `${n}. ${r.emails.enviados} e-mails enviados, ${r.emails.falharam} não entregues. Confira a lista.` };
  return { ok: `${n}. Convites enviados por e-mail.` };
}

export async function acaoGerarLinkAberto(id: string, trocar: boolean): Promise<Estado> {
  const a = await ator();
  return executar(id, () => gerarLinkAberto(a, id, trocar));
}

export async function acaoReenviarEmail(id: string, conviteId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => reenviarEmail(a, id, conviteId), "E-mail reenviado.");
}

export async function acaoRemoverConvite(id: string, conviteId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => removerConvite(a, id, conviteId));
}

export async function acaoEnviar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => enviarSolicitacao(a, id, t(f, "justificativa")), "Solicitação enviada.");
}

export async function acaoExcluir(id: string, orcamentoId: string): Promise<Estado> {
  const a = await ator();
  try {
    await excluirRascunho(a, id);
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/orcamentos/${orcamentoId}`, "layout");
  redirect(`/orcamentos/${orcamentoId}/cotacoes`);
}

export async function acaoNovoLink(id: string, conviteId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => novoLink(a, id, conviteId));
}

export async function acaoProrrogar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => prorrogar(a, id, t(f, "prazo"), t(f, "justificativa")), "Prazo prorrogado.");
}

export async function acaoReabrir(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => reabrir(a, id, t(f, "prazo"), t(f, "justificativa")), "Solicitação reaberta.");
}

export async function acaoCancelar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => cancelar(a, id, t(f, "justificativa")));
}

export async function acaoEncerrar(id: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => encerrarAntes(a, id));
}

export async function acaoAvaliar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const [conviteId, materialId] = t(f, "oferta").split("|");
  return executar(id, () => avaliarItem(a, id, { conviteId, materialId, tipo: t(f, "tipo"), justificativa: t(f, "justificativa") }));
}

export async function acaoRemoverAvaliacao(id: string, conviteId: string, materialId: string): Promise<Estado> {
  const a = await ator();
  return executar(id, () => removerAvaliacao(a, id, conviteId, materialId));
}

export async function acaoEscolherComparadas(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => escolherComparadas(a, id, f.getAll("convite").map(String)), "Comparação atualizada.");
}

export async function acaoHomologar(id: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(id, () => homologar(a, id, { escolhidoConviteId: t(f, "escolhido") || null, justificativa: t(f, "justificativa") }), "Apuração homologada.");
}

/** Proposta recebida por outro meio, digitada pela equipe. */
export async function acaoLancarProposta(id: string, conviteId: string, dados: DadosProposta): Promise<Estado & { protocolo?: string }> {
  const a = await ator();
  try {
    const r = await lancarProposta(a, id, conviteId, dados);
    revalidatePath(`/cotacoes/${id}`, "layout");
    return { ok: "Proposta lançada.", protocolo: r.protocolo };
  } catch (e) {
    return falha(e);
  }
}

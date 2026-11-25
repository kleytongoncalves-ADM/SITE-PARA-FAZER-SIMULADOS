"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { abrirNc, cancelarNc, corrigirNc, modelo, registrarEnsaio, registrarInspecao, verificarNc, type Area } from "@/servicos/qualidade";
import { encerrarOcorrencia, registrarEpi, registrarOcorrencia } from "@/servicos/seguranca";

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

function revalidar(obraId: string) {
  revalidatePath(`/obras/${obraId}/qualidade`);
  revalidatePath(`/obras/${obraId}/seguranca`);
  revalidatePath(`/obras/${obraId}/diario`);
  revalidatePath("/qualidade");
  revalidatePath("/seguranca");
}

export async function acaoAbrirNc(obraId: string, area: Area, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await abrirNc(a, obraId, {
      area, titulo: t(f, "titulo"), descricao: t(f, "descricao"), local: t(f, "local"), itemServicoId: t(f, "itemServicoId") || null,
      gravidade: t(f, "gravidade"), impeditiva: f.get("impeditiva") === "sim", responsavel: t(f, "responsavel"), prazo: t(f, "prazo") || null,
    });
  } catch (e) {
    return falha(e);
  }
  revalidar(obraId);
  redirect(`/nao-conformidades/${id}`);
}

async function naNc(id: string, obraId: string, fn: () => Promise<unknown>, ok: string): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/nao-conformidades/${id}`);
  revalidar(obraId);
  return { ok };
}

export async function acaoCorrigirNc(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return naNc(id, obraId, () => corrigirNc(a, id, t(f, "correcao")), "Correção registrada.");
}

export async function acaoVerificarNc(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const aceita = t(f, "resultado") === "aceita";
  return naNc(id, obraId, () => verificarNc(a, id, aceita, t(f, "verificacao")), aceita ? "Não conformidade encerrada." : "Correção recusada.");
}

export async function acaoCancelarNc(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return naNc(id, obraId, () => cancelarNc(a, id, t(f, "motivo")), "Não conformidade cancelada.");
}

export async function acaoInspecao(obraId: string, chave: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const m = modelo(chave);
  if (!m) return { erro: "Escolha o checklist." };
  let r;
  try {
    r = await registrarInspecao(a, obraId, {
      modelo: chave, data: t(f, "data"), local: t(f, "local"), itemServicoId: t(f, "itemServicoId") || null, observacao: t(f, "observacao"),
      respostas: m.itens.map((_, i) => ({ resposta: t(f, `r${i}`), observacao: t(f, `o${i}`) })),
      abrirNcs: f.get("abrirNcs") === "sim", responsavel: t(f, "responsavel"),
    });
  } catch (e) {
    return falha(e);
  }
  revalidar(obraId);
  redirect(`/inspecoes/${r.id}`);
}

export async function acaoEnsaio(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    const r = await registrarEnsaio(a, obraId, {
      tipo: t(f, "tipo"), itemServicoId: t(f, "itemServicoId") || null, local: t(f, "local"), dataColeta: t(f, "dataColeta"), dataResultado: t(f, "dataResultado"),
      unidade: t(f, "unidade"), criterio: t(f, "criterio"), especificado: t(f, "especificado"), resultado: t(f, "resultado"), laboratorio: t(f, "laboratorio"), laudo: t(f, "laudo"),
    });
    revalidar(obraId);
    return { ok: r.aprovado ? "Ensaio aprovado." : "Ensaio reprovado. Não conformidade aberta." };
  } catch (e) {
    return falha(e);
  }
}

export async function acaoOcorrencia(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await registrarOcorrencia(a, obraId, {
      tipo: t(f, "tipo"), data: t(f, "data"), hora: t(f, "hora") || null, local: t(f, "local"), descricao: t(f, "descricao"), envolvido: t(f, "envolvido"),
      empresa: t(f, "empresa"), diasAfastamento: n(f, "diasAfastamento"), cat: t(f, "cat"), paralisacao: f.get("paralisacao") === "sim",
      horasParalisadas: n(f, "horasParalisadas"), acaoCorretiva: t(f, "acaoCorretiva"), responsavel: t(f, "responsavel"), prazo: t(f, "prazo"),
    });
  } catch (e) {
    return falha(e);
  }
  revalidar(obraId);
  redirect(`/seguranca/ocorrencias/${id}`);
}

export async function acaoEncerrarOcorrencia(id: string, obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    await encerrarOcorrencia(a, id, t(f, "encerramento"));
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/seguranca/ocorrencias/${id}`);
  revalidar(obraId);
  return { ok: "Ocorrência encerrada." };
}

export async function acaoEpi(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  try {
    const q = await registrarEpi(a, obraId, {
      data: t(f, "data"), trabalhador: t(f, "trabalhador"), funcao: t(f, "funcao"), empresa: t(f, "empresa"),
      epis: f.getAll("epi").map(String), ca: t(f, "ca"), quantidade: n(f, "quantidade") ?? 1,
    });
    revalidar(obraId);
    return { ok: q === 1 ? "Entrega registrada." : `${q} itens registrados.` };
  } catch (e) {
    return falha(e);
  }
}

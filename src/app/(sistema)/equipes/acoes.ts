"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  alocarEquipamento, alocarPessoa, apontarEquipamento, apontarHoras, encerrarAlocacao, registrarDocumentoEmpresa, registrarHabilitacao,
  registrarManutencao, salvarEquipamento, salvarPessoa,
} from "@/servicos/equipes";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

function falha(e: unknown): Estado {
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
  throw e;
}
function revalidar(obraId?: string) {
  if (obraId) revalidatePath(`/obras/${obraId}/equipes`);
  revalidatePath("/equipes");
}

export async function acaoSalvarPessoa(id: string | null, _: Estado, f: FormData): Promise<Estado> {
  let novo: string;
  try {
    novo = await salvarPessoa(await ator(), id, {
      nome: t(f, "nome"), cpf: t(f, "cpf"), funcao: t(f, "funcao"), empresaId: t(f, "empresaId") || null, custoHora: t(f, "custoHora") || null,
      ativa: id ? f.get("ativa") === "sim" : true,
    });
  } catch (e) { return falha(e); }
  revalidar();
  if (!id) redirect(`/equipes/pessoas/${novo}`);
  revalidatePath(`/equipes/pessoas/${id}`);
  return { ok: "Dados atualizados." };
}

export async function acaoHabilitacao(pessoaId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await registrarHabilitacao(await ator(), pessoaId, {
      tipo: t(f, "tipo"), descricao: t(f, "descricao"), data: t(f, "data"), validade: t(f, "validade"), cargaHoraria: t(f, "cargaHoraria") || null,
      obrigatorio: f.get("obrigatorio") === "sim",
    });
    revalidatePath(`/equipes/pessoas/${pessoaId}`);
    revalidar();
    return { ok: "Registrado." };
  } catch (e) { return falha(e); }
}

export async function acaoSalvarEquipamento(id: string | null, _: Estado, f: FormData): Promise<Estado> {
  let novo: string;
  try {
    novo = await salvarEquipamento(await ator(), id, {
      descricao: t(f, "descricao"), identificacao: t(f, "identificacao"), propriedade: t(f, "propriedade"), empresaId: t(f, "empresaId") || null,
      custoHora: t(f, "custoHora") || null, ativo: id ? f.get("ativo") === "sim" : true,
    });
  } catch (e) { return falha(e); }
  revalidar();
  if (!id) redirect(`/equipes/equipamentos/${novo}`);
  revalidatePath(`/equipes/equipamentos/${id}`);
  return { ok: "Dados atualizados." };
}

export async function acaoManutencao(equipamentoId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await registrarManutencao(await ator(), equipamentoId, {
      data: t(f, "data"), tipo: t(f, "tipo"), descricao: t(f, "descricao"), proximaRevisao: t(f, "proximaRevisao") || null, custo: t(f, "custo") || null,
    });
    revalidatePath(`/equipes/equipamentos/${equipamentoId}`);
    revalidar();
    return { ok: "Manutenção registrada." };
  } catch (e) { return falha(e); }
}

export async function acaoDocumentoEmpresa(_: Estado, f: FormData): Promise<Estado> {
  try {
    await registrarDocumentoEmpresa(await ator(), t(f, "empresaId"), {
      tipo: t(f, "tipo"), numero: t(f, "numero"), emissao: t(f, "emissao") || null, validade: t(f, "validade"), observacao: t(f, "observacao"),
    });
    revalidar();
    return { ok: "Documento registrado." };
  } catch (e) { return falha(e); }
}

export async function acaoAlocarPessoa(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await alocarPessoa(await ator(), obraId, { pessoaId: t(f, "pessoaId"), inicio: t(f, "inicio"), fim: t(f, "fim") || null, funcao: t(f, "funcao") });
    revalidar(obraId);
    return { ok: "Pessoa alocada." };
  } catch (e) { return falha(e); }
}

export async function acaoAlocarEquipamento(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await alocarEquipamento(await ator(), obraId, { equipamentoId: t(f, "equipamentoId"), inicio: t(f, "inicio"), fim: t(f, "fim") || null });
    revalidar(obraId);
    return { ok: "Equipamento alocado." };
  } catch (e) { return falha(e); }
}

export async function acaoEncerrarAlocacao(obraId: string, tipo: "pessoa" | "equipamento", id: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await encerrarAlocacao(await ator(), tipo, id, t(f, "fim"));
    revalidar(obraId);
    return {};
  } catch (e) { return falha(e); }
}

export async function acaoApontarHoras(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  const linhas = f.getAll("pessoa").map(String).map((id) => ({ pessoaId: id, normais: t(f, `n_${id}`), extras: t(f, `x_${id}`) }));
  try {
    const n = await apontarHoras(await ator(), obraId, { data: t(f, "data"), itemServicoId: t(f, "itemServicoId") || null, linhas });
    revalidar(obraId);
    return { ok: `Horas de ${n} ${n === 1 ? "pessoa apontadas" : "pessoas apontadas"}.` };
  } catch (e) { return falha(e); }
}

export async function acaoApontarEquipamento(obraId: string, _: Estado, f: FormData): Promise<Estado> {
  try {
    await apontarEquipamento(await ator(), obraId, { data: t(f, "data"), equipamentoId: t(f, "equipamentoId"), itemServicoId: t(f, "itemServicoId") || null, horas: t(f, "horas") });
    revalidar(obraId);
    return { ok: "Horas do equipamento apontadas." };
  } catch (e) { return falha(e); }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  criarObra, DadosInvalidos, editarObra, encerrarVinculo, mudarSituacao, vincular, type DadosObra,
} from "@/servicos/obras";
import { SemPermissao } from "@/servicos/permissoes";
import type { FormaExecucao, Papel, Situacao, TipoObra } from "@/servicos/rotulos";

export type Estado = { erro?: string; ok?: string; erros?: Record<string, string>; valores?: Record<string, string> };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const t = texto(f, k).replace(/\./g, "").replace(",", ".");
  return t === "" ? null : Number(t);
};
const numCoord = (f: FormData, k: string) => {
  const t = texto(f, k).replace(",", ".");
  return t === "" ? null : Number(t);
};

/** Converte os erros conhecidos em mensagem para a tela. Erros inesperados seguem adiante. */
function falha(e: unknown, valores?: Record<string, string>): Estado {
  if (e instanceof DadosInvalidos) return { erro: "Confira os campos destacados.", erros: e.erros, valores };
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message, valores };
  throw e;
}

export async function acaoSalvarObra(id: string | null, _anterior: Estado, f: FormData): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  const valores = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  const dados: DadosObra = {
    codigo: texto(f, "codigo"), nome: texto(f, "nome"),
    tipo: texto(f, "tipo") as TipoObra, formaExecucao: texto(f, "formaExecucao") as FormaExecucao,
    endereco: texto(f, "endereco"), municipio: texto(f, "municipio"), uf: texto(f, "uf"),
    latitude: numCoord(f, "latitude"), longitude: numCoord(f, "longitude"),
    areaM2: num(f, "areaM2"), extensaoM: num(f, "extensaoM"),
    fonteRecurso: texto(f, "fonteRecurso"), convenio: texto(f, "convenio"),
    processoAdministrativo: texto(f, "processoAdministrativo"), licitacao: texto(f, "licitacao"),
    artNumero: texto(f, "artNumero"), ordemServicoNumero: texto(f, "ordemServicoNumero"),
    ordemServicoData: texto(f, "ordemServicoData"), dataInicioPrevista: texto(f, "dataInicioPrevista"),
    dataFimPrevista: texto(f, "dataFimPrevista"),
  };
  let destino = id;
  try {
    if (id) await editarObra(ator, id, dados);
    else destino = await criarObra(ator, dados);
  } catch (e) {
    return falha(e, valores);
  }
  revalidatePath("/", "layout");
  redirect(`/obras/${destino}`);
}

export async function acaoMudarSituacao(obraId: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  try {
    await mudarSituacao(ator, obraId, texto(f, "para") as Situacao, texto(f, "documento"), texto(f, "justificativa"));
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Situação atualizada." };
}

export async function acaoVincular(obraId: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  try {
    await vincular(ator, obraId, texto(f, "usuarioId"), texto(f, "papel") as Papel);
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/obras/${obraId}`);
  return { ok: "Pessoa vinculada à obra." };
}

export async function acaoEncerrarVinculo(obraId: string, vinculoId: string): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  try {
    await encerrarVinculo(ator, vinculoId);
  } catch (e) {
    return falha(e);
  }
  revalidatePath(`/obras/${obraId}`);
  return { ok: "Vínculo encerrado." };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { apagarCookiePlataforma, exigirDono, gravarCookiePlataforma, tokenPlataforma } from "@/lib/sessao";
import { DadosInvalidos } from "@/servicos/obras";
import {
  alterarEmpresa, alterarFuncionario, criarEmpresa, criarFuncionario, definirEmpresaAtiva, definirFuncionarioAtivo,
  entrarPlataforma, redefinirSenha, sairPlataforma,
} from "@/servicos/plataforma";
import type { Estado } from "../(sistema)/obras/acoes";

export type EstadoEntrada = { erro?: string; email?: string };

export async function acaoEntrarPlataforma(_anterior: EstadoEntrada, f: FormData): Promise<EstadoEntrada> {
  const email = String(f.get("email") ?? "");
  const senha = String(f.get("senha") ?? "");
  if (!email.trim() || !senha) return { erro: "Informe o e-mail e a senha.", email };
  const r = await entrarPlataforma(email, senha);
  if (!r.ok) {
    return {
      erro: r.motivo === "bloqueado" ? "Muitas tentativas. O acesso foi bloqueado por 15 minutos." : "E-mail ou senha incorretos.",
      email,
    };
  }
  await gravarCookiePlataforma(r.token, r.expiraEm);
  redirect("/plataforma");
}

export async function acaoSairPlataforma() {
  await sairPlataforma(await tokenPlataforma());
  await apagarCookiePlataforma();
  redirect("/plataforma/entrar");
}

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function falha(e: unknown, valores?: Record<string, string>): Estado {
  if (e instanceof DadosInvalidos) return { erro: "Confira os campos destacados.", erros: e.erros, valores };
  if (e instanceof ErroDeRegra) return { erro: e.message, valores };
  throw e;
}

const dadosEmpresa = (f: FormData) => ({ nome: t(f, "nome"), cnpj: t(f, "cnpj"), esfera: t(f, "esfera"), uf: t(f, "uf"), municipio: t(f, "municipio") });

export async function acaoCriarEmpresa(_anterior: Estado, f: FormData): Promise<Estado> {
  const dono = await exigirDono();
  const d = dadosEmpresa(f);
  let id: string;
  try {
    id = await criarEmpresa(dono, d);
  } catch (e) {
    return falha(e, d);
  }
  revalidatePath("/plataforma");
  redirect(`/plataforma/empresas/${id}?nova=1`);
}

export async function acaoAlterarEmpresa(id: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const dono = await exigirDono();
  const d = dadosEmpresa(f);
  try {
    await alterarEmpresa(dono, id, d);
  } catch (e) {
    return falha(e, d);
  }
  revalidatePath("/plataforma", "layout");
  return { ok: "Dados da empresa salvos." };
}

export async function acaoEmpresaAtiva(id: string, ativo: boolean): Promise<Estado> {
  const dono = await exigirDono();
  try {
    await definirEmpresaAtiva(dono, id, ativo);
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/plataforma", "layout");
  return {};
}

const dadosFuncionario = (f: FormData) => ({
  nome: t(f, "nome"), email: t(f, "email"), perfil: t(f, "perfil"), registroProfissional: t(f, "registroProfissional"),
  administrador: f.get("administrador") === "on",
});

export async function acaoCriarFuncionario(orgaoId: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const dono = await exigirDono();
  const d = dadosFuncionario(f);
  // A senha nunca volta para a tela.
  const valores = { nome: d.nome, email: d.email, perfil: d.perfil, registroProfissional: d.registroProfissional };
  try {
    await criarFuncionario(dono, orgaoId, { ...d, senha: String(f.get("senha") ?? "") });
  } catch (e) {
    return falha(e, valores);
  }
  revalidatePath("/plataforma", "layout");
  return { ok: `Acesso criado para ${d.nome}. Já é possível entrar com o e-mail ${d.email.toLowerCase()} e a senha que você definiu.` };
}

export async function acaoAlterarFuncionario(orgaoId: string, usuarioId: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const dono = await exigirDono();
  const d = dadosFuncionario(f);
  try {
    await alterarFuncionario(dono, orgaoId, usuarioId, d);
  } catch (e) {
    return falha(e, { nome: d.nome, email: d.email, perfil: d.perfil, registroProfissional: d.registroProfissional });
  }
  revalidatePath("/plataforma", "layout");
  return { ok: "Alterações salvas." };
}

export async function acaoFuncionarioAtivo(orgaoId: string, usuarioId: string, ativo: boolean): Promise<Estado> {
  const dono = await exigirDono();
  try {
    await definirFuncionarioAtivo(dono, orgaoId, usuarioId, ativo);
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/plataforma", "layout");
  return {};
}

export async function acaoRedefinirSenha(orgaoId: string, usuarioId: string, _anterior: Estado, f: FormData): Promise<Estado> {
  const dono = await exigirDono();
  try {
    await redefinirSenha(dono, orgaoId, usuarioId, String(f.get("senha") ?? ""));
  } catch (e) {
    return falha(e);
  }
  return { ok: "Senha trocada. As sessões abertas dessa pessoa foram encerradas." };
}

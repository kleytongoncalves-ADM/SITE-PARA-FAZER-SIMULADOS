"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { apagarCookieFornecedor, exigirFornecedor, gravarCookieFornecedor, tokenFornecedor } from "@/lib/sessao";
import type { DadosProposta } from "@/servicos/cotacoes";
import {
  adicionarExperiencia, cadastrarFornecedor, declinarNaArea, EmpresaJaCadastrada, entrarFornecedor, enviarPropostaNaArea, marcarLidas, removerExperiencia,
  sairFornecedor, salvarAvisos, salvarDadosDaEmpresa, salvarRascunhoNaArea, situacaoDoCnpj, trocarSenhaFornecedor,
} from "@/servicos/fornecedores";
import { DadosInvalidos } from "@/servicos/obras";

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function rede() {
  const h = await headers();
  return (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
}

/** Só volta para páginas do próprio sistema que o fornecedor usa. */
function destinoSeguro(v: string) {
  return /^\/(cotacao|convite)\/[A-Za-z0-9_-]{40,50}$/.test(v) || /^\/fornecedor(\/[A-Za-z0-9/_-]*)?$/.test(v) ? v : "/fornecedor";
}

export type EstadoEntrada = { erro?: string; email?: string };

export async function acaoEntrarFornecedor(_: EstadoEntrada, f: FormData): Promise<EstadoEntrada> {
  const email = t(f, "email");
  const senha = String(f.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe o e-mail e a senha.", email };
  const r = await entrarFornecedor(email, senha);
  if (!r.ok) {
    const m = { credenciais: "E-mail ou senha incorretos.", bloqueado: "Acesso bloqueado por 15 minutos após várias tentativas.", inativo: "Acesso inativo." };
    return { erro: m[r.motivo], email };
  }
  await gravarCookieFornecedor(r.token, r.expiraEm);
  redirect(destinoSeguro(t(f, "voltar")));
}

export type EstadoCadastro = { erros?: Record<string, string>; erro?: string; jaTem?: string; valores?: Record<string, string> };

export async function acaoCadastrarFornecedor(_: EstadoCadastro, f: FormData): Promise<EstadoCadastro> {
  const campos = ["cnpj", "razaoSocial", "nomeFantasia", "telefone", "cidade", "uf", "nome", "email"] as const;
  const valores = Object.fromEntries(campos.map((k) => [k, t(f, k)])) as Record<(typeof campos)[number], string>;
  let sessao;
  try {
    sessao = await cadastrarFornecedor({ ...valores, senha: String(f.get("senha") ?? "") }, await rede());
  } catch (e) {
    if (e instanceof DadosInvalidos) return { erros: e.erros, valores };
    if (e instanceof EmpresaJaCadastrada) return { jaTem: e.emailMascarado, valores };
    if (e instanceof ErroDeRegra) return { erro: e.message, valores };
    throw e;
  }
  await gravarCookieFornecedor(sessao.token, sessao.expiraEm);
  redirect(destinoSeguro(t(f, "voltar")));
}

export async function acaoConferirCnpj(cnpj: string): Promise<{ livre: boolean; email?: string }> {
  if (cnpj.replace(/\D/g, "").length !== 14) return { livre: true };
  const s = await situacaoDoCnpj(cnpj);
  return s.livre ? { livre: true } : { livre: false, email: s.email };
}

export async function acaoSairFornecedor() {
  await sairFornecedor(await tokenFornecedor());
  await apagarCookieFornecedor();
  redirect("/login?perfil=fornecedor");
}

// ---------------------------------------------------------------------------
// Resposta da cotação dentro da área
// ---------------------------------------------------------------------------
type Retorno = { erro?: string; ok?: string };

async function executar(fn: () => Promise<unknown>, caminho?: string): Promise<Retorno> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    if (e instanceof DadosInvalidos) return { erro: Object.values(e.erros)[0] };
    throw e;
  }
  if (caminho) revalidatePath(caminho);
  return {};
}

export async function acaoSalvarNaArea(conviteId: string, d: DadosProposta): Promise<Retorno> {
  const f = await exigirFornecedor();
  return executar(() => salvarRascunhoNaArea(f, conviteId, d));
}

export async function acaoEnviarNaArea(conviteId: string, d: DadosProposta): Promise<Retorno> {
  const f = await exigirFornecedor();
  const r = await rede();
  return executar(() => enviarPropostaNaArea(f, conviteId, d, r), "/fornecedor");
}

export async function acaoDeclinarNaArea(conviteId: string, motivo: string): Promise<Retorno> {
  const f = await exigirFornecedor();
  const r = await rede();
  return executar(() => declinarNaArea(f, conviteId, motivo, r), "/fornecedor");
}

// ---------------------------------------------------------------------------
// Mensagens e Minha empresa
// ---------------------------------------------------------------------------
export async function acaoMarcarLidas(): Promise<void> {
  const f = await exigirFornecedor();
  await marcarLidas(f);
  revalidatePath("/fornecedor", "layout");
}

export type Estado = { erro?: string; ok?: string; erros?: Record<string, string> };

async function formulario(fn: () => Promise<unknown>, ok: string): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DadosInvalidos) return { erros: e.erros, erro: Object.values(e.erros)[0] };
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }
  revalidatePath("/fornecedor", "layout");
  return { ok };
}

export async function acaoSalvarEmpresa(_: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => salvarDadosDaEmpresa(forn, {
    razaoSocial: t(f, "razaoSocial"), nomeFantasia: t(f, "nomeFantasia"), telefone: t(f, "telefone"), cidade: t(f, "cidade"), uf: t(f, "uf"), nome: t(f, "nome"), email: t(f, "email"),
  }), "Dados salvos.");
}

export async function acaoSalvarAvisos(_: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => salvarAvisos(forn, {
    avisosEmail: f.get("avisosEmail") === "on", avisosWhatsapp: f.get("avisosWhatsapp") === "on", whatsapp: t(f, "whatsapp"), autorizo: f.get("autorizo") === "on",
  }), "Avisos salvos.");
}

export async function acaoTrocarSenhaFornecedor(_: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  if (String(f.get("nova") ?? "") !== String(f.get("confirmar") ?? "")) return { erro: "A confirmação não confere com a nova senha." };
  return formulario(() => trocarSenhaFornecedor(forn, String(f.get("atual") ?? ""), String(f.get("nova") ?? "")), "Senha alterada.");
}

export async function acaoAdicionarExperiencia(_: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => adicionarExperiencia(forn, {
    cliente: t(f, "cliente"), cidade: t(f, "cidade"), uf: t(f, "uf"), servico: t(f, "servico"), ano: t(f, "ano"), quantidade: t(f, "quantidade"),
  }), "Experiência incluída.");
}

export async function acaoRemoverExperiencia(id: string): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => removerExperiencia(forn, id), "");
}

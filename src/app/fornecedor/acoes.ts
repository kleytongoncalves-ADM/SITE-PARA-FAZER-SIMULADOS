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
  alterarUsuarioDaEmpresa, criarNovaSenha, criarUsuarioDaEmpresa, pedirNovaSenha, redefinirSenhaDoUsuario,
} from "@/servicos/fornecedores";
import { abrirConversaDoConvite, enviarMensagemFornecedor } from "@/servicos/comunicacao";
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

// ---------------------------------------------------------------------------
// Usuários da empresa
// ---------------------------------------------------------------------------
export async function acaoCriarUsuario(_: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => criarUsuarioDaEmpresa(forn, {
    nome: t(f, "nome"), email: t(f, "email"), cargo: t(f, "cargo"), papel: t(f, "papel"), senha: String(f.get("senha") ?? ""),
  }), "Usuário criado. Passe o e-mail e a senha para a pessoa; ela pode trocar a senha depois de entrar.");
}

export async function acaoAlterarUsuario(id: string, _: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => alterarUsuarioDaEmpresa(forn, id, { cargo: t(f, "cargo"), papel: t(f, "papel"), ativo: f.get("ativo") === "on" }), "Usuário atualizado.");
}

export async function acaoSenhaDoUsuario(id: string, _: Estado, f: FormData): Promise<Estado> {
  const forn = await exigirFornecedor();
  return formulario(() => redefinirSenhaDoUsuario(forn, id, String(f.get("senha") ?? "")), "Senha definida.");
}

// ---------------------------------------------------------------------------
// Esqueci minha senha
// ---------------------------------------------------------------------------
export async function acaoPedirNovaSenha(_: Estado, f: FormData): Promise<Estado> {
  const email = t(f, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe o e-mail de acesso." };
  try {
    await pedirNovaSenha(email, await rede());
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }
  return { ok: "Se o e-mail tiver acesso, enviamos o link para criar uma nova senha. Ele vale por 1 hora." };
}

export async function acaoCriarNovaSenha(token: string, _: Estado, f: FormData): Promise<Estado> {
  const nova = String(f.get("nova") ?? "");
  if (nova !== String(f.get("confirmar") ?? "")) return { erro: "A confirmação não confere com a nova senha." };
  try {
    await criarNovaSenha(token, nova);
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }
  redirect("/login?perfil=fornecedor&senha=nova");
}

// ---------------------------------------------------------------------------
// Conversas
// ---------------------------------------------------------------------------
export async function acaoMensagemFornecedor(conversaId: string, texto: string): Promise<Retorno> {
  const f = await exigirFornecedor();
  return executar(() => enviarMensagemFornecedor(f, conversaId, texto), `/fornecedor/conversas/${conversaId}`);
}

export async function acaoConversarComOrgao(conviteId: string): Promise<Retorno> {
  const f = await exigirFornecedor();
  let id: string;
  try {
    id = await abrirConversaDoConvite(f, conviteId);
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }
  redirect(`/fornecedor/conversas/${id}`);
}

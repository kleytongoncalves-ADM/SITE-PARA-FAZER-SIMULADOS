"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  abrirConversa, enviarMensagemContratante, informarEmailCorporativo, ligarEmailAutomatico, salvarWhatsapp, testarWhatsapp, validarCodigo,
} from "@/servicos/comunicacao";
import { SemPermissao } from "@/servicos/permissoes";

export type Estado = { erro?: string; ok?: string };
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ator = async () => comoAtor(await exigirUsuario());

async function executar(fn: () => Promise<unknown>, ok?: string, caminho = "/comunicacoes"): Promise<Estado> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
    throw e;
  }
  revalidatePath(caminho, "layout");
  return ok ? { ok } : {};
}

export async function acaoEnviarMensagem(conversaId: string, texto: string): Promise<Estado> {
  const a = await ator();
  return executar(() => enviarMensagemContratante(a, conversaId, texto));
}

export async function acaoIniciarConversa(empresaId: string): Promise<Estado> {
  const a = await ator();
  let id: string;
  try {
    id = await abrirConversa(a, { empresaId });
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message };
    throw e;
  }
  redirect(`/comunicacoes/conversas/${id}`);
}

export async function acaoInformarEmail(_: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(() => informarEmailCorporativo(a, { email: t(f, "email"), nome: t(f, "nome") }), "Enviamos um código de 6 dígitos para o e-mail informado.");
}

export async function acaoValidarCodigo(_: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(() => validarCodigo(a, t(f, "codigo")), "E-mail validado.");
}

export async function acaoLigarEmail(_: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  const ligado = t(f, "ligar") === "sim";
  return executar(() => ligarEmailAutomatico(a, ligado), ligado ? "Envio automático por e-mail ligado." : "Envio automático por e-mail desligado.");
}

export async function acaoSalvarWhatsapp(_: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(() => salvarWhatsapp(a, { numeroId: t(f, "numeroId"), token: t(f, "token"), modelo: t(f, "modelo"), ligado: f.get("ligado") === "on" }), "Configuração do WhatsApp salva.");
}

export async function acaoTestarWhatsapp(_: Estado, f: FormData): Promise<Estado> {
  const a = await ator();
  return executar(() => testarWhatsapp(a, t(f, "numero")), "Mensagem de teste enviada. Confira o celular.");
}

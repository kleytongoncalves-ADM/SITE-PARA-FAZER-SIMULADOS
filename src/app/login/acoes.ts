"use server";

import { redirect } from "next/navigation";
import { entrar, sair } from "@/servicos/auth";
import { apagarCookieSessao, gravarCookieSessao, tokenAtual } from "@/lib/sessao";

export type EstadoLogin = { erro?: string; email?: string };

export async function acaoEntrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  if (!email.trim() || !senha) return { erro: "Informe o e-mail e a senha.", email };
  const r = await entrar(email, senha);
  if (!r.ok) {
    const mensagens = {
      credenciais: "E-mail ou senha incorretos.",
      bloqueado: "Muitas tentativas. O acesso foi bloqueado por 15 minutos.",
      inativo: "Este acesso está desativado. Procure o administrador do sistema.",
    };
    return { erro: mensagens[r.motivo], email };
  }
  await gravarCookieSessao(r.token, r.expiraEm);
  redirect("/inicio");
}

export async function acaoSair() {
  await sair(await tokenAtual());
  await apagarCookieSessao();
  redirect("/login");
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usuarioDaSessao, type UsuarioLogado } from "@/servicos/auth";
import type { Ator } from "@/servicos/obras";

export const COOKIE_SESSAO = "civiobra_sessao";

export async function gravarCookieSessao(token: string, expiraEm: Date) {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function apagarCookieSessao() {
  (await cookies()).delete(COOKIE_SESSAO);
}

export async function tokenAtual() {
  return (await cookies()).get(COOKIE_SESSAO)?.value;
}

/** Usuário da requisição, lido uma vez por renderização. */
export const usuarioAtual = cache(async (): Promise<UsuarioLogado | null> => usuarioDaSessao(await tokenAtual()));

/** Garante que há alguém logado. Sem sessão válida, manda para o login. */
export async function exigirUsuario(): Promise<UsuarioLogado> {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}

export function comoAtor(u: UsuarioLogado): Ator {
  return { id: u.id, orgaoId: u.orgaoId, perfil: u.perfil, administrador: u.administrador };
}

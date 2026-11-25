import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usuarioDaSessao, type UsuarioLogado } from "@/servicos/auth";
import type { Ator } from "@/servicos/obras";
import { donoDaSessao, type Dono } from "@/servicos/plataforma";

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

// ---------------------------------------------------------------------------
// Sessão da administração da plataforma (/plataforma), separada da do sistema.
// ---------------------------------------------------------------------------

export const COOKIE_PLATAFORMA = "civiobra_plataforma";

export async function gravarCookiePlataforma(token: string, expiraEm: Date) {
  (await cookies()).set(COOKIE_PLATAFORMA, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function apagarCookiePlataforma() {
  (await cookies()).delete(COOKIE_PLATAFORMA);
}

export async function tokenPlataforma() {
  return (await cookies()).get(COOKIE_PLATAFORMA)?.value;
}

export const donoAtual = cache(async (): Promise<Dono | null> => donoDaSessao(await tokenPlataforma()));

/** Garante que quem está na área da plataforma é o dono. Sem sessão, manda para o login dela. */
export async function exigirDono(): Promise<Dono> {
  const d = await donoAtual();
  if (!d) redirect("/plataforma/entrar");
  return d;
}

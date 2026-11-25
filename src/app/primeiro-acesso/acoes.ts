"use server";

import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { gravarCookieSessao } from "@/lib/sessao";
import { entrar } from "@/servicos/auth";
import { instalar } from "@/servicos/instalacao";

export type EstadoInstalacao = { erro?: string; valores?: Record<string, string> };

export async function acaoInstalar(_anterior: EstadoInstalacao, form: FormData): Promise<EstadoInstalacao> {
  const v = (campo: string) => String(form.get(campo) ?? "");
  const valores = Object.fromEntries(["orgaoNome", "cnpj", "esfera", "uf", "municipio", "nome", "email"].map((c) => [c, v(c)]));
  if (v("senha") !== v("senha2")) return { erro: "As duas senhas não são iguais.", valores };
  try {
    await instalar(
      { orgaoNome: v("orgaoNome"), cnpj: v("cnpj"), esfera: v("esfera"), uf: v("uf"), municipio: v("municipio"), nome: v("nome"), email: v("email"), senha: v("senha") },
      v("codigo"),
    );
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { erro: erro.message, valores };
    console.error(erro);
    return { erro: "Não foi possível concluir a instalação. Tente de novo em instantes.", valores };
  }
  const r = await entrar(v("email"), v("senha"));
  if (r.ok) {
    await gravarCookieSessao(r.token, r.expiraEm);
    redirect("/inicio");
  }
  redirect("/login");
}

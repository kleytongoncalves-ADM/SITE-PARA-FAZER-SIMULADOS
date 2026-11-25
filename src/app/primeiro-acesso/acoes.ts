"use server";

import { redirect } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { gravarCookiePlataforma } from "@/lib/sessao";
import { instalar } from "@/servicos/instalacao";
import { entrarPlataforma } from "@/servicos/plataforma";

export type EstadoInstalacao = { erro?: string; valores?: Record<string, string> };

export async function acaoInstalar(_anterior: EstadoInstalacao, form: FormData): Promise<EstadoInstalacao> {
  const v = (campo: string) => String(form.get(campo) ?? "");
  const valores = { nome: v("nome"), email: v("email") };
  if (v("senha") !== v("senha2")) return { erro: "As duas senhas não são iguais.", valores };
  try {
    await instalar({ nome: v("nome"), email: v("email"), senha: v("senha") }, v("codigo"));
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { erro: erro.message, valores };
    console.error(erro);
    return { erro: "Não foi possível concluir a instalação. Tente de novo em instantes.", valores };
  }
  const r = await entrarPlataforma(v("email"), v("senha"));
  if (r.ok) {
    await gravarCookiePlataforma(r.token, r.expiraEm);
    redirect("/plataforma");
  }
  redirect("/plataforma/entrar");
}

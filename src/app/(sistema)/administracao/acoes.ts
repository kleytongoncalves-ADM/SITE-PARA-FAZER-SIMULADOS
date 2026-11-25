"use server";

import { revalidatePath } from "next/cache";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { DadosInvalidos } from "@/servicos/obras";
import { SemPermissao } from "@/servicos/permissoes";
import type { Perfil } from "@/servicos/rotulos";
import { criarUsuario, definirAtivo } from "@/servicos/usuarios";
import type { Estado } from "../obras/acoes";

function falha(e: unknown, valores?: Record<string, string>): Estado {
  if (e instanceof DadosInvalidos) return { erro: "Confira os campos destacados.", erros: e.erros, valores };
  if (e instanceof ErroDeRegra || e instanceof SemPermissao) return { erro: e.message, valores };
  throw e;
}

export async function acaoCriarUsuario(_anterior: Estado, f: FormData): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  const t = (k: string) => String(f.get(k) ?? "").trim();
  // A senha nunca volta para a tela.
  const valores = { nome: t("nome"), email: t("email"), perfil: t("perfil"), registroProfissional: t("registroProfissional") };
  try {
    await criarUsuario(ator, {
      nome: t("nome"), email: t("email"), perfil: t("perfil") as Perfil, administrador: f.get("administrador") === "on",
      registroProfissional: t("registroProfissional"), senha: String(f.get("senha") ?? ""),
    });
  } catch (e) {
    return falha(e, valores);
  }
  revalidatePath("/administracao/usuarios");
  return { ok: `${t("nome")} cadastrado.` };
}

export async function acaoDefinirAtivo(usuarioId: string, ativo: boolean): Promise<Estado> {
  const ator = comoAtor(await exigirUsuario());
  try {
    await definirAtivo(ator, usuarioId, ativo);
  } catch (e) {
    return falha(e);
  }
  revalidatePath("/administracao/usuarios");
  return {};
}

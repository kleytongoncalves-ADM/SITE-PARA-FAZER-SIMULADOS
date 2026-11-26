import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterSolicitacao } from "@/servicos/cotacoes";
import { SemPermissao } from "@/servicos/permissoes";

/** Solicitação da requisição, carregada uma vez e usada pelo layout e pelas páginas. */
export const carregarSolicitacao = cache(async (id: string) => {
  const usuario = await exigirUsuario();
  const ator = comoAtor(usuario);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return { ator, usuario, s: await obterSolicitacao(ator, id) };
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
});

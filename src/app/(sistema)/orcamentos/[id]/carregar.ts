import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterOrcamento } from "@/servicos/orcamentos";
import { pode } from "@/servicos/permissoes";

/** Orçamento da requisição, carregado uma vez e usado pelo layout e pelas páginas. */
export const carregarOrcamento = cache(async (id: string) => {
  const u = await exigirUsuario();
  const ator = comoAtor(u);
  try {
    const orcamento = await obterOrcamento(ator, id);
    const editavel = orcamento.situacao === "rascunho" && pode(ator, "orcamento.editar");
    return { ator, usuario: u, orcamento, editavel, podeAprovar: pode(ator, "orcamento.aprovar") };
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
});

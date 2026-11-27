import "server-only";
import { cache } from "react";
import { montarCena } from "@/servicos/cena-3d";
import { insumosDoOrcamento } from "@/servicos/orcamentos";
import { carregarOrcamento } from "./carregar";

/** Cena 3D do orçamento: modelos de cada item, a partir da composição congelada. */
export const carregarCena = cache(async (id: string) => {
  const { ator, orcamento } = await carregarOrcamento(id);
  const insumos = await insumosDoOrcamento(ator, id);
  return montarCena(
    orcamento.etapas.map((e) => ({
      id: e.id, ordem: e.ordem, nome: e.nome,
      itens: e.itens.map((i) => ({ id: i.id, numero: i.numero, etapaId: e.id, modo: i.modo, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade })),
    })),
    insumos,
  );
});

import type { Metadata } from "next";
import { Visualizador3D } from "@/componentes/visualizador-3d/Visualizador3D";
import { montarDeposito } from "@/servicos/cena-3d";
import { carregarCena } from "../cena";
import { carregarOrcamento } from "../carregar";
import { medidasDoOrcamento } from "@/servicos/orcamentos";
import { montarObra } from "@/servicos/obra-3d";
import { pode } from "@/servicos/permissoes";
import { projetoDoOrcamento } from "@/servicos/ifc";

export const metadata: Metadata = { title: "Orçamento em 3D" };

export default async function Vista3D({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string }> }) {
  const { id } = await params;
  const { item } = await searchParams;
  const [cena, { ator }] = await Promise.all([carregarCena(id), carregarOrcamento(id)]);
  const [medidas, projeto] = await Promise.all([medidasDoOrcamento(ator, id), projetoDoOrcamento(ator, id)]);
  const obra = montarObra(cena.map((i) => ({ itemId: i.itemId, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade })), medidas);
  return <Visualizador3D projeto={projeto} obra={obra} medidas={medidas} podeMedir={pode(ator, "orcamento.editar")} orcamentoId={id} cena={cena} modo="canteiro" deposito={montarDeposito(cena)} focoInicial={item && cena.some((i) => i.itemId === item) ? item : null} />;
}

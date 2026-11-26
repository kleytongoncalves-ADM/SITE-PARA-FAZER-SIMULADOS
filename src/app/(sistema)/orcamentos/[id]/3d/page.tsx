import type { Metadata } from "next";
import { Visualizador3D } from "@/componentes/visualizador-3d/Visualizador3D";
import { montarDeposito } from "@/servicos/cena-3d";
import { carregarCena } from "../cena";

export const metadata: Metadata = { title: "Orçamento em 3D" };

export default async function Vista3D({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string }> }) {
  const { id } = await params;
  const { item } = await searchParams;
  const cena = await carregarCena(id);
  return <Visualizador3D orcamentoId={id} cena={cena} modo="canteiro" deposito={montarDeposito(cena)} focoInicial={item && cena.some((i) => i.itemId === item) ? item : null} />;
}

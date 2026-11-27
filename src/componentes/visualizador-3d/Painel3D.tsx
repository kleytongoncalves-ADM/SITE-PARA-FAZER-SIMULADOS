"use client";

import { Box, ChevronDown } from "lucide-react";
import type { CenaItem } from "@/servicos/cena-3d";
import { usePreferencia } from "./preferencia";
import { Visualizador3D } from "./Visualizador3D";

const CHAVE = "civiobras:3d:painel";

/** Vista 3D ao lado da planilha. Fica aberta ou fechada conforme a última escolha neste navegador. */
export function Painel3D({ orcamentoId, cena }: { orcamentoId: string; cena: CenaItem[] }) {
  const [aberto, setAberto] = usePreferencia(CHAVE, true);
  const alternar = () => setAberto(!aberto);
  if (!cena.length) return null;
  if (!aberto) {
    return (
      <button type="button" className="botao botao-neutro v3d-abrir nao-imprimir" onClick={alternar} aria-expanded="false"><Box /> Vista 3D</button>
    );
  }
  return (
    <div className="v3d-painel-caixa nao-imprimir">
      <Visualizador3D orcamentoId={orcamentoId} cena={cena} modo="painel" />
      <button type="button" className="botao botao-texto botao-pequeno v3d-fechar" onClick={alternar} aria-expanded="true" title="Ocultar vista 3D" aria-label="Ocultar vista 3D"><ChevronDown /></button>
    </div>
  );
}

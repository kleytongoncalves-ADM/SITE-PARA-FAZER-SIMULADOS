"use client";

import { Printer } from "lucide-react";

export function BotaoImprimir({ rotulo = "Imprimir ou salvar PDF" }: { rotulo?: string }) {
  return <button type="button" className="botao botao-neutro" onClick={() => window.print()}><Printer /> {rotulo}</button>;
}

"use client";

import { Box } from "lucide-react";

export const EVENTO_LOCALIZAR = "civiobras:3d:localizar";

/** Botão da linha da planilha: mostra o item na vista 3D. */
export function Localizar3D({ itemId }: { itemId: string }) {
  return (
    <button type="button" className="v3d-localizar nao-imprimir" onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_LOCALIZAR, { detail: itemId }))} title="Ver no 3D" aria-label="Ver no 3D"><Box /></button>
  );
}

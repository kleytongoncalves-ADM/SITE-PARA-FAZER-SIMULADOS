"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Janela sobre a página (diálogo nativo): fecha no X, no Esc ou clicando fora. */
export function Janela({ titulo, aberta, aoFechar, largura = 520, children }: {
  titulo: string; aberta: boolean; aoFechar: () => void; largura?: number; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      className="janela"
      style={{ "--largura": `${largura}px` } as React.CSSProperties}
      onClose={aoFechar}
      onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
      aria-label={titulo}
    >
      {aberta && (
        <div className="janela-caixa">
          <div className="janela-topo">
            <h2>{titulo}</h2>
            <button type="button" className="janela-fechar" onClick={aoFechar} aria-label="Fechar"><X /></button>
          </div>
          <div className="janela-corpo">{children}</div>
        </div>
      )}
    </dialog>
  );
}

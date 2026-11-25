"use client";

import { useEffect, useState } from "react";

/** Número que conta de zero até o valor ao aparecer na tela. */
export function Contador({ valor, duracao = 900 }: { valor: number; duracao?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const tempo = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duracao;
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = tempo === 0 ? 1 : Math.min(1, (agora - inicio) / tempo);
      setN(Math.round(valor * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);
  return <span className="num">{n.toLocaleString("pt-BR")}</span>;
}

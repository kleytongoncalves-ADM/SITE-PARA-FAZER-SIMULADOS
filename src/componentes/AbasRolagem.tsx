"use client";
import { useEffect, useRef } from "react";

/** Barra de abas que rola sozinha até a aba ativa e esmaece a borda quando há abas escondidas. */
export function AbasRolagem({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ativa = el.querySelector<HTMLElement>(".aba-ativa");
    if (ativa && el.scrollWidth > el.clientWidth) el.scrollLeft = ativa.offsetLeft - (el.clientWidth - ativa.offsetWidth) / 2;
    const marcar = () => {
      el.dataset.antes = el.scrollLeft > 4 ? "sim" : "nao";
      el.dataset.depois = el.scrollLeft + el.clientWidth < el.scrollWidth - 4 ? "sim" : "nao";
    };
    marcar();
    el.addEventListener("scroll", marcar, { passive: true });
    window.addEventListener("resize", marcar);
    return () => { el.removeEventListener("scroll", marcar); window.removeEventListener("resize", marcar); };
  }, []);
  return <nav ref={ref} className="abas" aria-label={rotulo}>{children}</nav>;
}

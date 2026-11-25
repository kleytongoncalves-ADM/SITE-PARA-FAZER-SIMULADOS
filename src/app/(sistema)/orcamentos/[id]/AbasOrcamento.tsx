"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS: [string, string][] = [
  ["", "Planilha"], ["/dados", "BDI e dados"], ["/cronograma", "Cronograma"], ["/abc", "Curva ABC"], ["/nota", "Nota"], ["/versoes", "Versões"],
];

export function AbasOrcamento({ id }: { id: string }) {
  const caminho = usePathname();
  const base = `/orcamentos/${id}`;
  const ativa = (s: string) => (s === "" ? caminho === base || caminho.startsWith(`${base}/itens`) || caminho.startsWith(`${base}/muro`) : caminho.startsWith(base + s));
  return (
    <nav className="abas nao-imprimir" aria-label="Seções do orçamento">
      {ABAS.map(([s, rotulo]) => (
        <Link key={s} href={base + s} className={`aba ${ativa(s) ? "aba-ativa" : ""}`} aria-current={ativa(s) ? "page" : undefined}>{rotulo}</Link>
      ))}
    </nav>
  );
}

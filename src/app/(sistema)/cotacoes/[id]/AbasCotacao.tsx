"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS: [string, string][] = [["", "Resumo"], ["/fornecedores", "Fornecedores"], ["/comparativo", "Comparativo"], ["/apuracao", "Apuração"], ["/relatorio", "Relatório"], ["/historico", "Histórico"]];

export function AbasCotacao({ id, contagem }: { id: string; contagem: Record<string, string | undefined> }) {
  const caminho = usePathname();
  const base = `/cotacoes/${id}`;
  const ativa = (s: string) => (s === "" ? caminho === base : caminho.startsWith(base + s) || (s === "/fornecedores" && caminho.startsWith(`${base}/lancar`)));
  return (
    <nav className="abas nao-imprimir" aria-label="Seções da cotação">
      {ABAS.map(([s, rotulo]) => (
        <Link key={s} href={base + s} className={`aba ${ativa(s) ? "aba-ativa" : ""}`} aria-current={ativa(s) ? "page" : undefined}>
          {rotulo}{contagem[s] && <small className="num" style={{ marginLeft: 6, opacity: 0.65 }}>{contagem[s]}</small>}
        </Link>
      ))}
    </nav>
  );
}

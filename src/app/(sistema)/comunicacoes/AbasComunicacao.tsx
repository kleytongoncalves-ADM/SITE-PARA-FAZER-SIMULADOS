"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AbasComunicacao({ naoLidas }: { naoLidas: number; configurar?: boolean }) {
  const caminho = usePathname();
  const abas: [string, string, boolean][] = [
    ["/comunicacoes", "Conversas", caminho === "/comunicacoes" || caminho.startsWith("/comunicacoes/conversas")],
    ["/comunicacoes/contatos", "Contatos", caminho.startsWith("/comunicacoes/contatos")],
    ["/comunicacoes/historico", "Histórico de envios", caminho.startsWith("/comunicacoes/historico")],
    ["/comunicacoes/configuracao", "Envio automático", caminho.startsWith("/comunicacoes/configuracao")],
  ];
  return (
    <nav className="abas" aria-label="Seções de comunicações" style={{ marginBottom: 14 }}>
      {abas.map(([href, rotulo, ativa]) => (
        <Link key={href} href={href} className={`aba ${ativa ? "aba-ativa" : ""}`} aria-current={ativa ? "page" : undefined}>
          {rotulo}{href === "/comunicacoes" && naoLidas > 0 && <span className="contagem num" style={{ marginLeft: 6 }}>{naoLidas}</span>}
        </Link>
      ))}
    </nav>
  );
}

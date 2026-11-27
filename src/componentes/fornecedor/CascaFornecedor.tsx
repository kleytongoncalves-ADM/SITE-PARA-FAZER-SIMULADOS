"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, LayoutDashboard, LogOut, MessagesSquare, Moon, Send, Sun } from "lucide-react";
import { acaoSairFornecedor } from "@/app/fornecedor/acoes";
import { LogoHorizontal } from "@/componentes/Logo";

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

type Props = { nome: string; empresa: string; naoLidas: number; conversas: number; pendentes: number; children: React.ReactNode };

/** Moldura da área do fornecedor: menu curto, sem nada do contratante. */
export function CascaFornecedor({ nome, empresa, naoLidas, conversas, pendentes, children }: Props) {
  const caminho = usePathname();
  function alternarTema() {
    const novo = document.documentElement.dataset.tema !== "escuro";
    if (novo) document.documentElement.dataset.tema = "escuro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem("civiobra-tema", novo ? "escuro" : "claro"); } catch {}
  }
  const itens = [
    { href: "/fornecedor", rotulo: "Início", icone: LayoutDashboard, ativo: caminho === "/fornecedor" },
    { href: "/fornecedor/cotacoes", rotulo: "Cotações", icone: Send, ativo: caminho.startsWith("/fornecedor/cotacoes"), contagem: pendentes },
    { href: "/fornecedor/conversas", rotulo: "Conversas", icone: MessagesSquare, ativo: caminho.startsWith("/fornecedor/conversas"), contagem: conversas },
    { href: "/fornecedor/mensagens", rotulo: "Avisos", icone: Bell, ativo: caminho.startsWith("/fornecedor/mensagens"), contagem: naoLidas },
    { href: "/fornecedor/empresa", rotulo: "Minha empresa", icone: Building2, ativo: caminho.startsWith("/fornecedor/empresa") },
  ];
  return (
    <div className="casca-plataforma casca-fornecedor">
      <header className="vidro topo">
        <Link href="/fornecedor" aria-label="Área do fornecedor, ir para o início" style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 8, minWidth: 0 }}>
          <LogoHorizontal largura={150} />
          <span className="selo-fornecedor">Fornecedor</span>
        </Link>
        <nav className="menu-fornecedor" aria-label="Menu do fornecedor">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} className={i.ativo ? "ativo" : ""} aria-current={i.ativo ? "page" : undefined}>
              <i.icone /><span>{i.rotulo}</span>{i.contagem ? <em aria-label={`${i.contagem} novas`}>{i.contagem}</em> : null}
            </Link>
          ))}
        </nav>
        <span style={{ flex: 1 }} />
        <button className="redondo" onClick={alternarTema} aria-label="Alternar entre tema claro e escuro" title="Tema claro ou escuro">
          <Sun className="so-tema-escuro" /><Moon className="so-tema-claro" />
        </button>
        <div className="pessoa">
          <span className="avatar" aria-hidden="true">{iniciais(nome)}</span>
          <span className="pessoa-texto">
            <span className="pessoa-nome" style={{ display: "block" }}>{nome}</span>
            <span className="pessoa-perfil" style={{ display: "block" }}>{empresa}</span>
          </span>
        </div>
        <form action={acaoSairFornecedor}><button className="redondo" aria-label="Sair" title="Sair"><LogOut /></button></form>
      </header>
      <main className="painel">{children}</main>
    </div>
  );
}

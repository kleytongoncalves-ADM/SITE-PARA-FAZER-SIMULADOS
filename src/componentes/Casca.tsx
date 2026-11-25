"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen, Building2, Calculator, CalendarRange, ClipboardCheck, FileSignature, FolderOpen, HardHat, History,
  LayoutDashboard, LogOut, Menu, Moon, Plus, Ruler, Search, Sun, Tags, Truck, Users, UsersRound, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { acaoSair } from "@/app/login/acoes";
import { LogoHorizontal } from "./Logo";

type Props = {
  nome: string;
  perfil: string;
  orgao: string;
  totalObras: number;
  podeCriarObra: boolean;
  podeGerenciarUsuarios: boolean;
  podeVerAuditoria: boolean;
  children: React.ReactNode;
};

type Item = { rotulo: string; icone: LucideIcon; href?: string; etapa?: number; contagem?: number };

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function Casca(p: Props) {
  const caminho = usePathname();
  const [aberta, setAberta] = useState(false);

  // O tema mora no <html>, não no React: assim a tela não pisca ao carregar.
  function alternarTema() {
    const novo = document.documentElement.dataset.tema !== "escuro";
    if (novo) document.documentElement.dataset.tema = "escuro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem("civiobra-tema", novo ? "escuro" : "claro"); } catch {}
  }

  const grupos: { titulo: string; itens: Item[] }[] = [
    { titulo: "Visão geral", itens: [
      { rotulo: "Início", icone: LayoutDashboard, href: "/inicio" },
      { rotulo: "Obras", icone: Building2, href: "/obras", contagem: p.totalObras },
    ] },
    { titulo: "Planejar", itens: [
      { rotulo: "Orçamento", icone: Calculator, etapa: 2 },
      { rotulo: "Base de preços", icone: Tags, etapa: 2 },
      { rotulo: "Cronograma", icone: CalendarRange, etapa: 3 },
    ] },
    { titulo: "Contratar", itens: [
      { rotulo: "Contratos", icone: FileSignature, etapa: 3 },
      { rotulo: "Medições", icone: Ruler, etapa: 4 },
      { rotulo: "Pagamentos", icone: Wallet, etapa: 4 },
    ] },
    { titulo: "Executar", itens: [
      { rotulo: "Diário de obra", icone: BookOpen, etapa: 6 },
      { rotulo: "Suprimentos", icone: Truck, etapa: 7 },
      { rotulo: "Equipes", icone: UsersRound, etapa: 7 },
    ] },
    { titulo: "Controlar", itens: [
      { rotulo: "Qualidade", icone: ClipboardCheck, etapa: 6 },
      { rotulo: "Segurança", icone: HardHat, etapa: 6 },
      { rotulo: "Documentos", icone: FolderOpen, etapa: 8 },
    ] },
  ];
  const sistema: Item[] = [];
  if (p.podeGerenciarUsuarios) sistema.push({ rotulo: "Usuários", icone: Users, href: "/administracao/usuarios" });
  if (p.podeVerAuditoria) sistema.push({ rotulo: "Auditoria", icone: History, href: "/administracao/auditoria" });
  if (sistema.length) grupos.push({ titulo: "Sistema", itens: sistema });

  const ativo = (href: string) => caminho === href || caminho.startsWith(href + "/");

  return (
    <div className="casca">
      {aberta && <div className="veu" onClick={() => setAberta(false)} aria-hidden="true" />}
      <aside className="vidro lateral" data-aberta={aberta} aria-label="Módulos do sistema">
        <div className="marca">
          <Link href="/inicio" aria-label="CiviObras, ir para o início" style={{ minWidth: 0 }}>
            <LogoHorizontal largura={172} />
            <div className="marca-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4, paddingLeft: 2 }}>{p.orgao}</div>
          </Link>
          <button className="redondo so-celular" style={{ marginLeft: "auto", width: 36, height: 36 }} onClick={() => setAberta(false)} aria-label="Fechar menu">
            <X />
          </button>
        </div>
        <nav className="lateral-rolagem" onClick={() => setAberta(false)}>
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div className="grupo">{g.titulo}</div>
              {g.itens.map((i) =>
                i.href ? (
                  <Link key={i.rotulo} href={i.href} className={`item ${ativo(i.href) ? "item-ativo" : ""}`} aria-current={ativo(i.href) ? "page" : undefined}>
                    <i.icone />
                    {i.rotulo}
                    {i.contagem != null && i.contagem > 0 && <span className="contagem num">{i.contagem}</span>}
                  </Link>
                ) : (
                  <span key={i.rotulo} className="item item-futuro" title="Em breve">
                    <i.icone />
                    {i.rotulo}
                    <span className="etiqueta-etapa">Em breve</span>
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className="coluna">
        <header className="vidro topo">
          <button className="redondo so-celular" onClick={() => setAberta(true)} aria-label="Abrir menu">
            <Menu />
          </button>
          <form action="/obras" className="busca" role="search">
            <Search />
            <input name="busca" type="search" placeholder="Buscar obra" aria-label="Buscar obra" />
          </form>
          <span className="espaco" style={{ flex: 1 }} />
          <button className="redondo" onClick={alternarTema} aria-label="Alternar entre tema claro e escuro" title="Tema claro ou escuro">
            <Sun className="so-tema-escuro" />
            <Moon className="so-tema-claro" />
          </button>
          {p.podeCriarObra && (
            <Link href="/obras/nova" className="redondo redondo-destaque" aria-label="Nova obra" title="Nova obra">
              <Plus />
            </Link>
          )}
          <div className="pessoa">
            <span className="avatar" aria-hidden="true">{iniciais(p.nome)}</span>
            <span className="pessoa-texto">
              <span className="pessoa-nome" style={{ display: "block" }}>{p.nome}</span>
              <span className="pessoa-perfil" style={{ display: "block" }}>{p.perfil}</span>
            </span>
          </div>
          <form action={acaoSair}>
            <button className="redondo" aria-label="Sair do sistema" title="Sair">
              <LogOut />
            </button>
          </form>
        </header>
        <main className="painel">{p.children}</main>
      </div>
    </div>
  );
}

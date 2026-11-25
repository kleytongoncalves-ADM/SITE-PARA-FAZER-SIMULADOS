"use client";

import Link from "next/link";
import { KeyRound, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { acaoSairPlataforma } from "@/app/plataforma/acoes";
import { LogoHorizontal } from "./Logo";

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function CascaPlataforma({ nome, children }: { nome: string; children: React.ReactNode }) {
  function alternarTema() {
    const novo = document.documentElement.dataset.tema !== "escuro";
    if (novo) document.documentElement.dataset.tema = "escuro";
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem("civiobra-tema", novo ? "escuro" : "claro"); } catch {}
  }
  return (
    <div className="casca-plataforma">
      <header className="vidro topo">
        <Link href="/plataforma" aria-label="Administração da plataforma, ir para as empresas" style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 8, minWidth: 0 }}>
          <LogoHorizontal largura={150} />
          <span className="selo-plataforma"><ShieldCheck />Administração</span>
        </Link>
        <span style={{ flex: 1 }} />
        <button className="redondo" onClick={alternarTema} aria-label="Alternar entre tema claro e escuro" title="Tema claro ou escuro">
          <Sun className="so-tema-escuro" />
          <Moon className="so-tema-claro" />
        </button>
        <Link href="/plataforma/minha-conta" className="redondo" aria-label="Minha conta e troca de senha" title="Minha conta">
          <KeyRound />
        </Link>
        <div className="pessoa">
          <span className="avatar" aria-hidden="true">{iniciais(nome)}</span>
          <span className="pessoa-texto">
            <span className="pessoa-nome" style={{ display: "block" }}>{nome}</span>
            <span className="pessoa-perfil" style={{ display: "block" }}>Dono da plataforma</span>
          </span>
        </div>
        <form action={acaoSairPlataforma}>
          <button className="redondo" aria-label="Sair da administração" title="Sair">
            <LogOut />
          </button>
        </form>
      </header>
      <main className="painel">{children}</main>
    </div>
  );
}

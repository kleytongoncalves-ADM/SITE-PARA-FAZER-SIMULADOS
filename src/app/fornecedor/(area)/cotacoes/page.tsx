import type { Metadata } from "next";
import Link from "next/link";
import { CartaoCotacao } from "@/componentes/fornecedor/CartaoCotacao";
import { exigirFornecedor } from "@/lib/sessao";
import { cotacoesDoFornecedor } from "@/servicos/fornecedores";

export const metadata: Metadata = { title: "Cotações · Fornecedor" };

const FILTROS = [
  { k: "abertas", rotulo: "Aguardando resposta" },
  { k: "enviadas", rotulo: "Enviadas" },
  { k: "encerradas", rotulo: "Encerradas" },
  { k: "todas", rotulo: "Todas" },
] as const;

export default async function CotacoesDoFornecedor({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const f = await exigirFornecedor();
  const { ver = "abertas" } = await searchParams;
  const lista = await cotacoesDoFornecedor(f);
  const grupo = (k: string) => lista.filter((c) => k === "todas" ? true : k === "abertas" ? ["pendente", "rascunho"].includes(c.estado)
    : k === "enviadas" ? c.estado === "enviada" : ["encerrada", "declinada", "cancelada"].includes(c.estado));
  const mostrar = grupo(ver);
  return (
    <div className="grade">
      <div><div className="sobretitulo">Área do fornecedor</div><h1 className="titulo">Cotações</h1></div>
      <nav className="abas" aria-label="Filtrar cotações">
        {FILTROS.map((x) => (
          <Link key={x.k} href={`/fornecedor/cotacoes?ver=${x.k}`} className={`aba ${ver === x.k ? "aba-ativa" : ""}`} aria-current={ver === x.k ? "page" : undefined}>
            {x.rotulo} <span className="fraco">{grupo(x.k).length}</span>
          </Link>
        ))}
      </nav>
      {mostrar.length ? <div className="forn-cotacoes">{mostrar.map((c, i) => <CartaoCotacao key={c.conviteId} c={c} i={i} />)}</div>
        : <div className="cartao vazio"><b>Nenhuma cotação aqui</b></div>}
    </div>
  );
}

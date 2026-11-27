import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import { CartaoCotacao } from "@/componentes/fornecedor/CartaoCotacao";
import { exigirFornecedor } from "@/lib/sessao";
import { cotacoesDoFornecedor, mensagensDoFornecedor } from "@/servicos/fornecedores";

export const metadata: Metadata = { title: "Início · Fornecedor" };

export default async function InicioFornecedor() {
  const f = await exigirFornecedor();
  const [lista, mensagens] = await Promise.all([cotacoesDoFornecedor(f), mensagensDoFornecedor(f)]);
  const abertas = lista.filter((c) => c.estado === "pendente" || c.estado === "rascunho");
  const recentes = lista.filter((c) => !abertas.includes(c)).slice(0, 4);
  const novas = mensagens.filter((m) => !m.lida).slice(0, 3);
  const proximo = abertas[0];
  return (
    <div className="grade">
      <div>
        <div className="sobretitulo">Área do fornecedor</div>
        <h1 className="titulo">{f.nomeFantasia ?? f.razaoSocial}</h1>
      </div>

      {abertas.length ? (
        <div className="forn-faixa surgir">
          <b>{abertas.length === 1 ? "Você tem 1 cotação aguardando resposta" : `Você tem ${abertas.length} cotações aguardando resposta`}</b>
          <span>Prazo mais próximo: {dataHoraCurta(proximo.prazo)} · {proximo.orgao}</span>
        </div>
      ) : (
        <div className="cartao vazio surgir"><b>Nenhuma cotação aguardando resposta</b>Quando um órgão enviar uma solicitação para a sua empresa, ela aparece aqui.</div>
      )}

      {abertas.length > 0 && <div className="forn-cotacoes">{abertas.map((c, i) => <CartaoCotacao key={c.conviteId} c={c} i={i} />)}</div>}

      {novas.length > 0 && (
        <section className="cartao surgir">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 className="cartao-titulo">Mensagens novas</h2>
            <Link href="/fornecedor/mensagens" className="botao botao-texto"><Inbox /> Ver todas</Link>
          </div>
          <ul className="forn-mensagens compacta">
            {novas.map((m) => (
              <li key={m.id} className="nova"><b>{m.titulo}</b><span>{m.texto}</span><small>{dataHoraCurta(m.criadoEm)}</small></li>
            ))}
          </ul>
        </section>
      )}

      {recentes.length > 0 && (
        <section>
          <h2 style={{ margin: "6px 0 12px", fontSize: 17 }}>Respondidas e encerradas</h2>
          <div className="forn-cotacoes">{recentes.map((c, i) => <CartaoCotacao key={c.conviteId} c={c} i={i} />)}</div>
        </section>
      )}
    </div>
  );
}

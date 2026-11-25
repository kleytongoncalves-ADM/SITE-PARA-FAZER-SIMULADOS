import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Building2 } from "lucide-react";
import { dataCurta, moeda } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { painelModuloSuprimentos } from "@/servicos/suprimentos";

export const metadata: Metadata = { title: "Suprimentos" };

export default async function Suprimentos() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "suprimentos.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa os suprimentos</b></div>;
  const p = await painelModuloSuprimentos(ator);
  const estoque = p.obras.reduce((s, o) => s + o.valorEstoque, 0);
  const consumo = p.obras.reduce((s, o) => s + o.consumo, 0);
  const minimo = p.obras.reduce((s, o) => s + o.abaixoMinimo, 0);
  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo">Executar</div><h1 className="titulo">Suprimentos</h1></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/suprimentos/materiais" className="botao botao-neutro"><Boxes /> Materiais</Link>
          <Link href="/suprimentos/fornecedores" className="botao botao-neutro"><Building2 /> Fornecedores</Link>
        </div>
      </div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Valor em estoque</span><b className="num">{moeda(estoque)}</b><small>{p.obras.length} {p.obras.length === 1 ? "obra" : "obras"} em execução</small></div>
        <div className="indicador surgir"><span>Material aplicado</span><b className="num">{moeda(consumo)}</b></div>
        <div className={`indicador surgir${p.aguardando.length ? " indicador-destaque" : ""}`}><span>Requisições aguardando aprovação</span><b className="num">{p.aguardando.length}</b></div>
        <div className={`indicador surgir${p.atrasados.length || minimo ? " indicador-destaque" : ""}`}><span>Pedidos atrasados</span><b className="num">{p.atrasados.length}</b><small>{minimo} {minimo === 1 ? "material abaixo" : "materiais abaixo"} do mínimo</small></div>
      </div>

      {p.aguardando.length > 0 && (
        <section className="cartao surgir" style={{ marginBottom: 16 }}>
          <h2 className="cartao-titulo">Aguardando aprovação</h2>
          <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
            <thead><tr><th>Requisição</th><th>Obra</th><th>Solicitante</th><th>Necessário em</th><th className="dir">Itens</th></tr></thead>
            <tbody>{p.aguardando.map((r) => (
              <tr key={r.id}><td><Link href={`/requisicoes/${r.id}`} className="forte num">nº {r.numero}</Link></td><td className="num">{r.obraCodigo}</td>
                <td>{r.criadoPor ?? "—"}</td><td className="num">{dataCurta(r.necessidade)}</td><td className="dir num">{r.itens}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
      {p.atrasados.length > 0 && (
        <section className="cartao surgir" style={{ marginBottom: 16 }}>
          <h2 className="cartao-titulo">Entregas atrasadas</h2>
          <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
            <thead><tr><th>Pedido</th><th>Obra</th><th>Fornecedor</th><th>Entrega prevista</th><th className="dir">Total</th></tr></thead>
            <tbody>{p.atrasados.map((x) => (
              <tr key={x.id} className="linha-vencida"><td><Link href={`/pedidos/${x.id}`} className="forte num">nº {x.numero}</Link></td><td className="num">{x.obraCodigo}</td>
                <td>{x.fornecedor}</td><td className="num">{dataCurta(x.prazoEntrega)}</td><td className="dir num">{moeda(x.total)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {p.obras.length === 0 ? <div className="cartao vazio"><b>Nenhuma obra em execução</b></div> : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Obra</th><th className="dir">Valor em estoque</th><th className="dir">Material aplicado</th><th className="dir">Aguardando aprovação</th><th className="dir">Pedidos atrasados</th><th className="dir">Abaixo do mínimo</th></tr></thead>
            <tbody>{p.obras.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/obras/${o.id}/suprimentos`} className="forte">{o.nome}</Link><div className="fraco num">{o.codigo}</div></td>
                <td className="dir num">{moeda(o.valorEstoque)}</td><td className="dir num">{moeda(o.consumo)}</td>
                <td className="dir num">{o.aguardando || "—"}</td>
                <td className="dir num">{o.atrasados ? <span className="etiqueta et-vermelha">{o.atrasados}</span> : "—"}</td>
                <td className="dir num">{o.abaixoMinimo ? <span className="etiqueta et-laranja">{o.abaixoMinimo}</span> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

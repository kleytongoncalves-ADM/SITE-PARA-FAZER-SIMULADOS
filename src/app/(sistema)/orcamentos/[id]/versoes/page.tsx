import type { Metadata } from "next";
import Link from "next/link";
import { EtiquetaOrcamento } from "@/componentes/EtiquetaOrcamento";
import { dataHora, moeda, quantidade, unidadeMedida } from "@/lib/formato";
import { compararComAnterior, rotuloOrcamento, versoes } from "@/servicos/orcamentos";
import { carregarOrcamento } from "../carregar";

export const metadata: Metadata = { title: "Versões do orçamento" };

export default async function Versoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator } = await carregarOrcamento(id);
  const [lista, comp] = await Promise.all([versoes(ator, id), compararComAnterior(ator, id)]);
  const sinal = (v: string) => (Number(v) > 0 ? "vermelho" : Number(v) < 0 ? "verde" : "");

  return (
    <div className="grade">
      <div className="tabela-caixa">
        <table className="tabela">
          <thead><tr><th>Versão</th><th>Situação</th><th>Criada em</th><th>Aprovação</th><th className="dir">Total</th></tr></thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id}>
                <td className="num">{v.id === id ? <b>{rotuloOrcamento(v)}</b> : <Link href={`/orcamentos/${v.id}`} className="link-item">{rotuloOrcamento(v)}</Link>}</td>
                <td><EtiquetaOrcamento situacao={v.situacao} /></td>
                <td className="num">{dataHora(v.criadoEm)}</td>
                <td>{v.aprovadoEm ? `${dataHora(v.aprovadoEm)}${v.aprovadoPor ? ` · ${v.aprovadoPor}` : ""}` : "—"}</td>
                <td className="dir num forte">{moeda(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comp && (
        <section className="tabela-caixa">
          <div className="etapa-cabecalho">
            <h2 className="etapa-nome">Diferenças para a {rotuloOrcamento(comp.antes)}</h2>
            <span className={`etapa-total num ${sinal(comp.diferenca)}`}>{Number(comp.diferenca) > 0 ? "+" : ""}{moeda(comp.diferenca)}</span>
          </div>
          {comp.linhas.length === 0 ? <p className="cartao-sub" style={{ padding: "0 18px 16px" }}>Sem diferenças nos itens.</p> : (
            <table className="tabela tabela-compacta">
              <thead>
                <tr><th>Descrição</th><th>Und.</th><th className="dir">Quant. antes</th><th className="dir">Quant. agora</th><th className="dir">Total antes</th><th className="dir">Total agora</th><th className="dir">Diferença</th></tr>
              </thead>
              <tbody>
                {comp.linhas.map((l) => (
                  <tr key={l.chave}>
                    <td>{l.descricao}{!l.antes && <> <span className="etiqueta et-verde">Incluído</span></>}{!l.depois && <> <span className="etiqueta et-vermelha">Removido</span></>}</td>
                    <td>{unidadeMedida(l.unidade)}</td>
                    <td className="dir num">{l.antes ? quantidade(l.antes.quantidade) : "—"}</td>
                    <td className="dir num">{l.depois ? quantidade(l.depois.quantidade) : "—"}</td>
                    <td className="dir num">{l.antes ? moeda(l.antes.total) : "—"}</td>
                    <td className="dir num">{l.depois ? moeda(l.depois.total) : "—"}</td>
                    <td className={`dir num forte ${sinal(l.diferenca)}`}>{Number(l.diferenca) > 0 ? "+" : ""}{moeda(l.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

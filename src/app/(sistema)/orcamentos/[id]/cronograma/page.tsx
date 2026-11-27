import type { Metadata } from "next";
import { moeda, percentual } from "@/lib/formato";
import { cronogramaDo } from "@/servicos/orcamentos";
import { acaoCronograma } from "../../acoes";
import { carregarOrcamento } from "../carregar";
import { EditorCronograma } from "./EditorCronograma";

export const metadata: Metadata = { title: "Cronograma físico-financeiro" };

export default async function Cronograma({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orcamento: o, editavel } = await carregarOrcamento(id);
  const c = cronogramaDo(o);
  const rotulo = o.unidadePeriodo === "mes" ? "Mês" : "Semana";
  const periodos = Array.from({ length: o.periodos }, (_, i) => i + 1);
  const maior = Math.max(1, ...c.porPeriodo.map(Number));

  return (
    <div className="grade">
      {o.etapas.length === 0 ? <div className="cartao vazio"><b>Sem etapas</b>Lance as etapas e os itens na planilha.</div> : (
        <EditorCronograma
          key={`${o.periodos}-${o.unidadePeriodo}`}
          acao={acaoCronograma.bind(null, id)} editavel={editavel}
          etapas={o.etapas.map((e) => ({ id: e.id, ordem: e.ordem, nome: e.nome, total: e.totais.total, percentuais: e.percentuais }))}
          periodos={o.periodos} unidade={o.unidadePeriodo} inicio={o.inicio}
        />
      )}

      <section className="cartao">
        <h3 className="cartao-titulo">Desembolso previsto</h3>
        <div className="barras-rolagem">
          <div className="curva">
            {periodos.map((p, i) => (
              <div key={p} className="curva-col">
                <span className="barra-num num">{percentual(c.pctPeriodo[i], 1)}</span>
                <div className="barra-trilho"><div className="barra-valor" style={{ height: `${(Number(c.porPeriodo[i]) / maior) * 100}%`, "--i": i } as React.CSSProperties} /></div>
                <span className="barra-rotulo">{rotulo} {p}<br /><b className="num">{percentual(c.pctAcumulado[i], 1)}</b></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="tabela-caixa">
        <table className="tabela tabela-compacta">
          <thead>
            <tr><th>Etapa</th><th className="dir">Total</th>{periodos.map((p) => <th key={p} className="dir">{rotulo} {p}</th>)}</tr>
          </thead>
          <tbody>
            {o.etapas.map((e, i) => (
              <tr key={e.id}>
                <td className="forte">{e.ordem}. {e.nome}{!c.linhas[i].fechada && e.itens.length > 0 && <> <span className="etiqueta et-vermelha">{percentual(c.linhas[i].soma)}</span></>}</td>
                <td className="dir num">{moeda(e.totais.total)}</td>
                {c.linhas[i].valores.map((v, j) => <td key={j} className="dir num">{Number(v) ? moeda(v) : "—"}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="forte">No período</td><td className="dir num forte">{moeda(o.totais.total)}</td>{c.porPeriodo.map((v, j) => <td key={j} className="dir num forte">{moeda(v)}</td>)}</tr>
            <tr><td className="forte">Acumulado</td><td />{c.acumulado.map((v, j) => <td key={j} className="dir num">{moeda(v)}<br /><span className="fraco">{percentual(c.pctAcumulado[j])}</span></td>)}</tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { ComparacaoAutomatica, NotasCustoBeneficio, textoPesos } from "@/componentes/cotacao/Comparacao";
import { difPct } from "@/componentes/cotacao/Pecas";
import { quantidade, valor } from "@/lib/formato";
import { LIMITES_PADRAO, mediaMediana, ROTULO_CRITERIO_APURACAO } from "@/servicos/cotacao-calculo";
import { carregarSolicitacao } from "../carregar";
import { Fechada } from "../Fechada";
import { unidade } from "@/lib/unidade";

export const metadata: Metadata = { title: "Comparativo de preços" };

export default async function Comparativo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  const m = s.mapa;
  if (!s.precosVisiveis || !m) return <Fechada s={s} titulo="Comparativo indisponível" />;
  if (!m.fornecedores.length) return <div className="cartao vazio"><b>Nenhuma proposta recebida</b></div>;
  const fs = m.fornecedores;

  const c = s.comparacao;

  return (
    <div className="grade">
      {c && <ComparacaoAutomatica c={c} />}
      <div className="barra-acoes">
        <div className="cot-legenda">
          <span style={{ "--cor": "rgba(42,157,99,0.5)" } as React.CSSProperties}>Menor preço do item</span>
          <span style={{ "--cor": "#1f8a55" } as React.CSSProperties}>Abaixo da referência</span>
          <span style={{ "--cor": "#c76a0c" } as React.CSSProperties}>Acima da referência</span>
          <span style={{ "--cor": "#c23a3a" } as React.CSSProperties}>Preço fora do padrão ({LIMITES_PADRAO.abaixo}% abaixo ou {LIMITES_PADRAO.acima}% acima da mediana)</span>
        </div>
        <a href={`/cotacoes/${id}/excel`} className="botao botao-neutro botao-pequeno" style={{ marginLeft: "auto" }}><FileSpreadsheet /> Planilha Excel</a>
      </div>

      <div className="tabela-caixa surgir">
        <table className="tabela tabela-compacta cot-mapa">
          <thead>
            <tr>
              <th className="cot-fixa">Material</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Referência</th>
              {fs.map((f) => <th key={f.conviteId} className="dir cot-divisa" style={{ whiteSpace: "normal", minWidth: 118 }}>{f.fornecedor}</th>)}
              <th className="dir cot-divisa">Média</th><th className="dir">Mediana</th>
            </tr>
          </thead>
          <tbody>{m.linhas.map((l) => (
            <tr key={l.material.id}>
              <td className="cot-fixa"><span className="forte">{l.material.descricao}</span><div className="fraco num">{l.material.semSinapi ? "Sem código de referência" : l.material.codigo}</div></td>
              <td>{unidade(l.material.unidade)}</td>
              <td className="dir num">{quantidade(l.material.quantidade)}</td>
              <td className="dir num">{l.material.precoReferencia == null ? "—" : valor(l.material.precoReferencia)}</td>
              {l.ofertas.map((o) => o.preco == null ? <td key={o.conviteId} className="cot-divisa cot-indisponivel dir">Indisponível</td> : (
                <td key={o.conviteId} className={`dir cot-divisa ${o.menor ? "cot-menor" : ""}`} title={o.justificativa ?? undefined}>
                  <span className={`num ${o.excluida ? "cot-riscado" : ""}`}><span className="cot-marca">{valor(o.preco)}</span></span>
                  {o.difSinapi != null && <span className={`cot-dif ${o.classe}`}>{difPct(o.difSinapi)}</span>}
                  {o.discrepante && <span className="cot-alerta" title={o.discrepante === "baixo" ? "Muito abaixo dos demais preços" : "Muito acima dos demais preços"}>{o.discrepante === "baixo" ? "baixo" : "alto"}</span>}
                  <div className="fraco" style={{ fontWeight: 450 }}>{o.excluida ? (o.excluida === "nao_atende" ? "Não atende à especificação" : "Desconsiderado") : [o.marca, o.modelo].filter(Boolean).join(" · ")}</div>
                </td>
              ))}
              {(() => { const e = mediaMediana(l); return <><td className="dir num cot-divisa">{e.media == null ? "—" : valor(e.media)}</td><td className="dir num">{e.mediana == null ? "—" : valor(e.mediana)}</td></>; })()}
            </tr>
          ))}</tbody>
          <tfoot>
            <tr>
              <td className="cot-fixa">Total dos itens cotados (R$)</td><td /><td /><td className="dir num">{valor(m.totalReferencia)}</td>
              {fs.map((f) => (
                <td key={f.conviteId} className={`dir cot-divisa ${m.menorGlobal?.conviteId === f.conviteId ? "cot-menor" : ""}`}>
                  <span className="num">{valor(f.total)}</span>{f.difSinapi != null && <span className={`cot-dif ${f.classe}`}>{difPct(f.difSinapi)}</span>}
                  <div className="fraco" style={{ fontWeight: 500 }}>{f.completa ? "Todos os itens" : `${f.itensCotados} de ${f.itens} itens`}</div>
                </td>
              ))}
              <td className="cot-divisa" /><td />
            </tr>
            <tr>
              <td className="cot-fixa">Itens com o menor preço</td><td /><td /><td />
              {fs.map((f) => <td key={f.conviteId} className="dir num cot-divisa">{f.itensVencidos}<span className="fraco" style={{ fontWeight: 500 }}> · {valor(f.valorVencido)}</span></td>)}
              <td className="cot-divisa" /><td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="fraco" style={{ fontSize: 12.5 }}>
        A diferença percentual compara cada preço com a referência do orçamento. No total, a comparação usa a referência apenas dos itens que o fornecedor cotou.
      </p>
      {c && c.classificacao.length > 0 && (
        <section className="surgir">
          <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Custo-benefício</h2>
          <div className="tabela-caixa"><NotasCustoBeneficio c={c} /></div>
          <p className="fraco" style={{ fontSize: 12.5, marginTop: 10 }}>
            Nota de 0 a 100 por fator, com os pesos {c.pesosDaSolicitacao ? "fixados no envio" : "padrão do sistema"} ({textoPesos(c)}), entre as propostas que cotaram todos os itens. A marca não pontua.
            {c.pesosDaSolicitacao ? "" : ` O critério desta cotação é ${ROTULO_CRITERIO_APURACAO[s.criterio].toLowerCase()}.`}
          </p>
        </section>
      )}
    </div>
  );
}

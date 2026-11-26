import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { difPct } from "@/componentes/cotacao/Pecas";
import { quantidade, valor } from "@/lib/formato";
import { LIMITES_PADRAO } from "@/servicos/cotacao-calculo";
import { carregarSolicitacao } from "../carregar";
import { Fechada } from "../Fechada";

export const metadata: Metadata = { title: "Comparativo de preços" };

export default async function Comparativo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  const m = s.mapa;
  if (!s.precosVisiveis || !m) return <Fechada s={s} titulo="Comparativo indisponível" />;
  if (!m.fornecedores.length) return <div className="cartao vazio"><b>Nenhuma proposta recebida</b></div>;
  const fs = m.fornecedores;

  return (
    <div className="grade">
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
              <th className="cot-fixa">Material</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Referência (R$)</th>
              {fs.map((f) => <th key={f.conviteId} className="dir cot-divisa" style={{ whiteSpace: "normal", minWidth: 150 }}>{f.fornecedor}</th>)}
            </tr>
          </thead>
          <tbody>{m.linhas.map((l) => (
            <tr key={l.material.id}>
              <td className="cot-fixa"><span className="forte">{l.material.descricao}</span><div className="fraco num">{l.material.semSinapi ? "Sem código de referência" : l.material.codigo}</div></td>
              <td>{l.material.unidade}</td>
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
            </tr>
            <tr>
              <td className="cot-fixa">Itens com o menor preço</td><td /><td /><td />
              {fs.map((f) => <td key={f.conviteId} className="dir num cot-divisa">{f.itensVencidos}<span className="fraco" style={{ fontWeight: 500 }}> · {valor(f.valorVencido)}</span></td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="fraco" style={{ fontSize: 12.5 }}>
        A diferença percentual compara cada preço com a referência do orçamento. No total, a comparação usa a referência apenas dos itens que o fornecedor cotou.
      </p>
    </div>
  );
}

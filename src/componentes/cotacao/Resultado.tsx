import { moeda, percentual, quantidade, valor } from "@/lib/formato";
import { FATORES, ROTULO_FATOR, type Apuracao } from "@/servicos/cotacao-calculo";
import { unidade } from "@/lib/unidade";

const nota = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Classificação dos fornecedores de uma apuração. `rel` usa a tabela do modelo de relatório. */
export function Classificacao({ a, rel }: { a: Apuracao; rel?: boolean }) {
  const cb = a.criterio === "custo_beneficio";
  const fatores = FATORES.filter((k) => a.pesos[k] > 0);
  const porItem = a.criterio === "item";
  return (
    <table className={rel ? "rel-tabela" : "tabela tabela-compacta"}>
      <thead><tr>
        <th>Posição</th><th>Fornecedor</th><th className="dir">Itens cotados</th>{porItem && <th className="dir">Itens vencidos</th>}
        <th className="dir">{porItem ? "Valor vencido (R$)" : "Total (R$)"}</th>
        {cb && fatores.map((k) => <th key={k} className="dir">{ROTULO_FATOR[k]} ({a.pesos[k]})</th>)}
        {cb && <th className="dir">Nota final</th>}
        <th className="dir">Entrega</th><th className="dir">Pagamento</th><th className="dir">Garantia</th>
      </tr></thead>
      <tbody>{a.classificacao.map((c) => (
        <tr key={c.conviteId}>
          <td>{rel ? `${c.posicao}º` : <span className={`cot-posicao ${c.posicao === 1 ? "primeira" : ""}`}>{c.posicao}</span>}</td>
          <td className="forte">{c.fornecedor}{a.vencedor?.conviteId === c.conviteId && <span className="fraco" style={{ fontWeight: 500 }}> · vencedor</span>}</td>
          <td className="dir num">{c.itensCotados}</td>{porItem && <td className="dir num">{c.itensVencidos}</td>}
          <td className="dir num forte">{valor(porItem ? c.valorVencido : c.total)}</td>
          {cb && fatores.map((k) => <td key={k} className="dir num">{nota(c.notas?.[k])}</td>)}
          {cb && <td className="dir num forte">{nota(c.nota)}</td>}
          <td className="dir num">{c.prazoEntrega != null ? `${c.prazoEntrega} dias` : "—"}</td>
          <td className="dir num">{c.pagamentoDias != null ? `${c.pagamentoDias} dias` : "—"}</td>
          <td className="dir num">{c.garantiaMeses != null ? `${c.garantiaMeses} meses` : "—"}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

/** Vencedor de cada item, com marca, preço e economia sobre a referência. */
export function ItensApurados({ a, rel }: { a: Apuracao; rel?: boolean }) {
  return (
    <table className={rel ? "rel-tabela" : "tabela tabela-compacta"}>
      <thead><tr><th>Código</th><th>Material</th><th>Und.</th><th className="dir">Quant.</th><th>Fornecedor e marca</th><th className="dir">Preço unit.</th><th className="dir">Total (R$)</th><th className="dir">Referência (R$)</th><th className="dir">Economia (R$)</th></tr></thead>
      <tbody>{a.itens.map((i) => (
        <tr key={i.materialId}>
          <td className="num sem-quebra">{i.codigo || "—"}</td><td style={{ minWidth: 170 }}>{i.descricao}</td><td>{unidade(i.unidade)}</td><td className="dir num">{quantidade(i.quantidade)}</td>
          <td style={{ minWidth: 170 }}><span className={i.fornecedor ? "forte" : "fraco"}>{i.fornecedor ?? "Sem proposta válida"}</span>
            {i.marca && <div className={rel ? undefined : "fraco"} style={{ fontWeight: 400 }}>{[i.marca, i.modelo].filter(Boolean).join(" · ")}</div>}</td>
          <td className="dir num">{i.preco ? valor(i.preco) : "—"}</td><td className="dir num forte">{i.total ? valor(i.total) : "—"}</td>
          <td className="dir num">{i.refTotal ? valor(i.refTotal) : "—"}</td>
          <td className="dir num">{i.economia ? valor(i.economia) : "—"}</td>
        </tr>
      ))}</tbody>
      <tfoot><tr>
        <td colSpan={6} className="forte">Total</td><td className="dir num forte">{valor(a.totalResultado)}</td><td className="dir num forte">{valor(a.totalReferencia)}</td>
        <td className="dir num forte">{a.economia ? valor(a.economia) : "—"}</td>
      </tr></tfoot>
    </table>
  );
}

export const fraseEconomia = (a: Apuracao) => {
  if (a.economia == null) return "Sem preço de referência para calcular a economia.";
  const p = a.economiaPct != null ? ` (${percentual(Math.abs(a.economiaPct), 1)})` : "";
  return Number(a.economia) >= 0 ? `Economia de ${moeda(a.economia)}${p} em relação ao preço de referência dos itens apurados.`
    : `Resultado ${moeda(Math.abs(Number(a.economia)))}${p} acima do preço de referência dos itens apurados.`;
};

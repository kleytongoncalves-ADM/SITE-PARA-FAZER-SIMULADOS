import { moeda } from "@/lib/formato";
import { FATORES, ROTULO_FATOR, type Comparacao } from "@/servicos/cotacao-calculo";

const nota = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const textoPesos = (c: Comparacao) => FATORES.filter((k) => c.pesos[k] > 0).map((k) => `${ROTULO_FATOR[k].toLowerCase()} ${c.pesos[k]}`).join(", ");

/** Melhor preço e melhor custo-benefício, lado a lado. `rel` usa as peças do modelo de relatório. */
export function ComparacaoAutomatica({ c, rel }: { c: Comparacao; rel?: boolean }) {
  const itens = [
    { rotulo: "Menor preço por item", valor: c.porItem ? moeda(c.porItem.total) : "—",
      detalhe: c.porItem ? c.porItem.fornecedores.map((f) => `${f.fornecedor} (${f.itens} ${f.itens === 1 ? "item" : "itens"})`).join(" · ") : "Nenhum preço válido" },
    { rotulo: "Menor preço global", valor: c.global ? moeda(c.global.total) : "—", detalhe: c.global ? c.global.fornecedor : "Nenhum fornecedor cotou todos os itens" },
    { rotulo: "Melhor custo-benefício", valor: c.custoBeneficio ? `Nota ${nota(c.custoBeneficio.nota)}` : "—",
      detalhe: c.custoBeneficio ? `${c.custoBeneficio.fornecedor} · ${moeda(c.custoBeneficio.total)}` : "Nenhum fornecedor cotou todos os itens" },
  ];
  if (rel) {
    return (
      <div className="rel-indicadores">
        {itens.map((i) => <div key={i.rotulo} className="rel-indicador"><span>{i.rotulo}</span><b className="num">{i.valor}</b><small>{i.detalhe}</small></div>)}
      </div>
    );
  }
  return (
    <div className="indicadores" style={{ marginBottom: 0 }}>
      {itens.map((i, k) => <div key={i.rotulo} className="indicador surgir" style={{ "--i": k } as React.CSSProperties}><span>{i.rotulo}</span><b className="num">{i.valor}</b><small>{i.detalhe}</small></div>)}
    </div>
  );
}

/** Notas de custo-benefício por fornecedor. */
export function NotasCustoBeneficio({ c, rel }: { c: Comparacao; rel?: boolean }) {
  const fatores = FATORES.filter((k) => c.pesos[k] > 0);
  if (!c.classificacao.length) return null;
  return (
    <table className={rel ? "rel-tabela" : "tabela tabela-compacta"}>
      <thead><tr><th>Posição</th><th>Fornecedor</th><th className="dir">Total (R$)</th>{fatores.map((k) => <th key={k} className="dir">{ROTULO_FATOR[k]} ({c.pesos[k]})</th>)}<th className="dir">Nota final</th></tr></thead>
      <tbody>{c.classificacao.map((x) => (
        <tr key={x.conviteId}>
          <td>{x.posicao}º</td><td className="forte">{x.fornecedor}</td><td className="dir num">{Number(x.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          {fatores.map((k) => <td key={k} className="dir num">{nota(x.notas?.[k])}</td>)}<td className="dir num forte">{nota(x.nota)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

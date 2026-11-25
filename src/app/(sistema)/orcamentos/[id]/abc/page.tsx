import type { Metadata } from "next";
import Link from "next/link";
import { moeda, percentual, quantidade } from "@/lib/formato";
import { curvaAbcInsumos, curvaAbcServicos } from "@/servicos/orcamentos";
import { ROTULO_FONTE, ROTULO_TIPO_INSUMO } from "@/servicos/precos";
import { carregarOrcamento } from "../carregar";

export const metadata: Metadata = { title: "Curva ABC" };

const COR = { A: "et-vermelha", B: "et-laranja", C: "et-neutra" } as const;

function Resumo({ linhas }: { linhas: { classe: "A" | "B" | "C"; valor: string }[] }) {
  const total = linhas.reduce((s, l) => s + Number(l.valor), 0) || 1;
  const grupos = (["A", "B", "C"] as const).map((c) => {
    const g = linhas.filter((l) => l.classe === c);
    return { c, n: g.length, v: g.reduce((s, l) => s + Number(l.valor), 0) };
  });
  return (
    <div className="indicadores">
      {grupos.map((g, i) => (
        <div key={g.c} className="indicador surgir" style={{ "--i": i } as React.CSSProperties}>
          <span>Classe {g.c} · {g.n} {g.n === 1 ? "item" : "itens"}</span>
          <b className="num">{moeda(g.v)}</b>
          <small className="num">{percentual((g.v / total) * 100, 1)} do total</small>
        </div>
      ))}
    </div>
  );
}

export default async function CurvaAbc({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ver?: string }> }) {
  const { id } = await params;
  const { ver } = await searchParams;
  const { ator } = await carregarOrcamento(id);
  const insumos = ver === "insumos";

  const chips = (
    <div className="chips">
      <Link href={`/orcamentos/${id}/abc`} className={`chip ${!insumos ? "chip-ativo" : ""}`}>Serviços</Link>
      <Link href={`/orcamentos/${id}/abc?ver=insumos`} className={`chip ${insumos ? "chip-ativo" : ""}`}>Insumos</Link>
    </div>
  );

  if (insumos) {
    const { linhas } = await curvaAbcInsumos(ator, id);
    return (
      <div className="grade">
        {chips}
        {linhas.length === 0 ? <div className="cartao vazio"><b>Sem insumos</b>Lance itens com preço na planilha.</div> : (
          <>
            <Resumo linhas={linhas} />
            <div className="tabela-caixa">
              <table className="tabela tabela-compacta">
                <thead><tr><th>Classe</th><th>Código</th><th>Insumo</th><th>Tipo</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Preço</th><th className="dir">Custo</th><th className="dir">%</th><th className="dir">Acum.</th></tr></thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>
                      <td><span className={`etiqueta ${COR[l.classe]}`}>{l.classe}</span></td>
                      <td className="num fraco">{l.codigo === "COT" ? "Cotação" : l.codigo}</td>
                      <td>{l.descricao}</td>
                      <td className="fraco">{ROTULO_TIPO_INSUMO[l.tipo]}</td>
                      <td>{l.unidade}</td>
                      <td className="dir num">{quantidade(l.quantidade)}</td>
                      <td className="dir num">{l.preco ? moeda(l.preco) : "—"}</td>
                      <td className="dir num forte">{moeda(l.valor)}</td>
                      <td className="dir num">{percentual(l.percentual)}</td>
                      <td className="dir num fraco">{percentual(l.acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cartao-sub">Custos sem BDI. A quantidade é a soma de todos os serviços do orçamento.</p>
          </>
        )}
      </div>
    );
  }

  const { linhas } = await curvaAbcServicos(ator, id);
  return (
    <div className="grade">
      {chips}
      {linhas.length === 0 ? <div className="cartao vazio"><b>Sem itens</b>Lance itens com preço na planilha.</div> : (
        <>
          <Resumo linhas={linhas} />
          <div className="tabela-caixa">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Classe</th><th>Item</th><th>Código</th><th>Serviço</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Preço unit.</th><th className="dir">Total</th><th className="dir">%</th><th className="dir">Acum.</th></tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i}>
                    <td><span className={`etiqueta ${COR[l.classe]}`}>{l.classe}</span></td>
                    <td className="num">{l.numero}</td>
                    <td className="num fraco" style={{ whiteSpace: "nowrap" }}>{l.fonte === "cotacao" ? "Cotação" : `${ROTULO_FONTE[l.fonte]} ${l.codigo}`}</td>
                    <td>{l.descricao}</td>
                    <td>{l.unidade}</td>
                    <td className="dir num">{quantidade(l.quantidade)}</td>
                    <td className="dir num">{moeda(l.precoUnitario)}</td>
                    <td className="dir num forte">{moeda(l.valor)}</td>
                    <td className="dir num">{percentual(l.percentual)}</td>
                    <td className="dir num fraco">{percentual(l.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

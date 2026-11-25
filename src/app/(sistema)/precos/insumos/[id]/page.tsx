import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { mesAno, moeda, percentual } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterInsumo, ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO, type Regime } from "@/servicos/precos";

export const metadata: Metadata = { title: "Insumo" };

export default async function Insumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let i;
  try {
    i = await obterInsumo(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const porRegime = (r: Regime) => i.historico.filter((h) => h.regime === r);
  const maior = Math.max(1, ...i.historico.map((h) => Number(h.preco)));

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><Link href="/precos?ver=insumos">Base de preços</Link><span>/</span><span className="num">{ROTULO_FONTE[i.fonte]} {i.codigo}</span></div>
          <h1 className="titulo" style={{ fontSize: 24 }}>{i.descricao}</h1>
          <p className="subtitulo">{i.unidade} · {ROTULO_TIPO_INSUMO[i.tipo]}{i.grupo ? ` · ${i.grupo}` : ""}</p>
        </div>
      </div>
      {i.historico.length === 0 ? <div className="cartao vazio"><b>Sem preços registrados</b></div> : (
        <div className="grade duas-colunas">
          {(["nao_desonerado", "desonerado"] as Regime[]).filter((r) => porRegime(r).length).map((r) => {
            const h = porRegime(r);
            return (
              <section key={r} className="cartao">
                <h3 className="cartao-titulo" style={{ marginBottom: 14 }}>{ROTULO_REGIME[r]}</h3>
                <div className="curva" style={{ height: 160 }}>
                  {h.map((p, k) => (
                    <div key={p.tabelaId} className="curva-col">
                      <span className="barra-num num">{moeda(p.preco)}</span>
                      <div className="barra-trilho"><div className="barra-valor" style={{ height: `${(Number(p.preco) / maior) * 100}%`, "--i": k } as React.CSSProperties} /></div>
                      <span className="barra-rotulo">{p.uf} {mesAno(p.mes)}</span>
                    </div>
                  ))}
                </div>
                <table className="tabela tabela-compacta" style={{ marginTop: 14 }}>
                  <thead><tr><th>Mês</th><th>UF</th><th className="dir">Preço</th><th className="dir">Variação</th></tr></thead>
                  <tbody>
                    {h.map((p, k) => {
                      const ant = k > 0 && h[k - 1].uf === p.uf ? Number(h[k - 1].preco) : null;
                      const v = ant ? ((Number(p.preco) - ant) / ant) * 100 : null;
                      return (
                        <tr key={p.tabelaId}>
                          <td>{mesAno(p.mes)}</td><td>{p.uf}</td><td className="dir num forte">{moeda(p.preco)}</td>
                          <td className={`dir num ${v == null ? "" : v > 0 ? "vermelho" : v < 0 ? "verde" : ""}`}>{v == null ? "—" : `${v > 0 ? "+" : ""}${percentual(v)}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

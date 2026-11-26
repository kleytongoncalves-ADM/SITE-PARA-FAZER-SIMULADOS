import { difPct } from "@/componentes/cotacao/Pecas";
import { quantidade, valor } from "@/lib/formato";
import { unidade } from "@/lib/unidade";
import { mediaMediana, totaisMediaMediana, type Mapa } from "@/servicos/cotacao-calculo";

const sobre = (v: number | null, ref: string | null | undefined) => (v == null || ref == null || !(Number(ref) > 0) ? null : (v / Number(ref) - 1) * 100);

function Dif({ v, rel }: { v: number | null; rel?: boolean }) {
  if (v == null) return null;
  if (rel) return <><br /><span style={{ fontWeight: 400 }}>{difPct(v)}</span></>;
  return <span className={`cot-dif ${Math.abs(v) <= 1 ? "igual" : v < 0 ? "abaixo" : "acima"}`}>{difPct(v)}</span>;
}

/** Apuração de cada item: referência, menor e maior preço, média e mediana, com a diferença sobre a referência. */
export function ApuracaoPorItem({ m, rel }: { m: Mapa; rel?: boolean }) {
  const nomes = new Map(m.fornecedores.map((f) => [f.conviteId, f.fornecedor]));
  const tot = totaisMediaMediana(m);
  const refCotados = Number(m.refDosMenores) > 0 ? m.refDosMenores : null;
  return (
    <table className={rel ? "rel-tabela" : "tabela tabela-compacta"}>
      <thead><tr>
        <th>Item</th><th>Material</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Referência</th><th className="dir">Preços</th>
        <th className="dir">Menor preço</th><th className="dir">Maior preço</th><th className="dir">Média</th><th className="dir">Mediana</th>
      </tr></thead>
      <tbody>{m.linhas.map((l, i) => {
        const e = mediaMediana(l);
        const ref = l.material.semSinapi ? null : l.material.precoReferencia;
        return (
          <tr key={l.material.id}>
            <td className="num">{i + 1}</td><td>{l.material.descricao}</td><td>{unidade(l.material.unidade)}</td><td className="dir num">{quantidade(l.material.quantidade)}</td>
            <td className="dir num">{l.material.precoReferencia == null ? "—" : valor(l.material.precoReferencia)}</td>
            <td className="dir num">{e.precos}</td>
            <td className="dir num">{e.menor == null ? "—" : <><b>{valor(e.menor)}</b><Dif v={sobre(e.menor, ref)} rel={rel} />{l.menor && <div className={rel ? undefined : "fraco"} style={{ fontWeight: 400, whiteSpace: "normal" }}>{nomes.get(l.menor.conviteId)}</div>}</>}</td>
            <td className="dir num">{e.maior == null ? "—" : <>{valor(e.maior)}<Dif v={sobre(e.maior, ref)} rel={rel} /></>}</td>
            <td className="dir num">{e.media == null ? "—" : <>{valor(e.media)}<Dif v={sobre(e.media, ref)} rel={rel} /></>}</td>
            <td className="dir num">{e.mediana == null ? "—" : <>{valor(e.mediana)}<Dif v={sobre(e.mediana, ref)} rel={rel} /></>}</td>
          </tr>
        );
      })}</tbody>
      <tfoot><tr>
        <td colSpan={4}>Total dos itens cotados (R$)</td><td className="dir num">{refCotados ? valor(refCotados) : "—"}</td><td />
        <td className="dir num">{valor(m.somaMenores)}<Dif v={sobre(Number(m.somaMenores), refCotados)} rel={rel} /></td><td />
        <td className="dir num">{tot.media == null ? "—" : <>{valor(tot.media)}<Dif v={sobre(tot.media, refCotados)} rel={rel} /></>}</td>
        <td className="dir num">{tot.mediana == null ? "—" : <>{valor(tot.mediana)}<Dif v={sobre(tot.mediana, refCotados)} rel={rel} /></>}</td>
      </tr></tfoot>
    </table>
  );
}

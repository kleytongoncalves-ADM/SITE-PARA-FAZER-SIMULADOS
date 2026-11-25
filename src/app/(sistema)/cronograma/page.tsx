import type { Metadata } from "next";
import Link from "next/link";
import { EtiquetaCronograma } from "@/componentes/Etiquetas";
import { dataCurta, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { panoramaCronogramas } from "@/servicos/cronogramas";
import { pode } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Cronograma" };

function Idp({ v }: { v: number | null }) {
  if (v == null) return <span className="fraco">—</span>;
  const cls = v >= 1 ? "et-verde" : v >= 0.95 ? "et-laranja" : "et-vermelha";
  return <span className={`etiqueta ${cls}`}>{numero(v, 2)}</span>;
}

export default async function Cronogramas() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "cronograma.ver")) {
    return <div className="cartao vazio"><b>Seu perfil não acessa o cronograma</b></div>;
  }
  const lista = await panoramaCronogramas(ator);
  const comBase = lista.filter((c) => c.situacao === "linha_base");
  const atrasadas = comBase.filter((c) => c.indicadores.idp != null && c.indicadores.idp < 0.95).length;
  const estouram = lista.filter((c) => c.fimContrato && c.termino > c.fimContrato).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Planejar</div>
          <h1 className="titulo">Cronograma</h1>
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Obras com cronograma</span><b className="num">{lista.length}</b></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Com linha de base</span><b className="num">{comBase.length}</b></div>
        <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Atrasadas (IDP abaixo de 0,95)</span><b className="num">{atrasadas}</b></div>
        <div className="indicador surgir" style={{ "--i": 3 } as React.CSSProperties}><span>Término além do prazo contratual</span><b className="num">{estouram}</b></div>
      </div>

      {lista.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum cronograma</b>O cronograma é criado na obra, a partir do contrato.</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Obra</th><th>Versão</th><th>Início</th><th>Término</th><th className="dir">Previsto hoje</th><th className="dir">Executado</th><th className="dir">IDP</th><th className="dir">Críticas</th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const base = c.situacao === "linha_base";
                return (
                  <tr key={c.id}>
                    <td><Link href={`/obras/${c.obraId}/cronograma?versao=${c.id}`}><span className="forte">{c.obra.nome}</span><br /><span className="fraco num">{c.obra.codigo} · contrato {c.contratoNumero}</span></Link></td>
                    <td><EtiquetaCronograma situacao={c.situacao} /><br /><span className="fraco">versão {c.versao}</span></td>
                    <td className="num">{dataCurta(c.inicio)}</td>
                    <td className="num">{dataCurta(c.termino)}{c.fimContrato && c.termino > c.fimContrato && <><br /><span className="etiqueta et-vermelha">além do prazo</span></>}</td>
                    <td className="dir num">{base ? `${numero(c.indicadores.previstoPct, 1)}%` : "—"}</td>
                    <td className="dir num">{base ? `${numero(c.indicadores.realizadoPct, 1)}%` : "—"}</td>
                    <td className="dir">{base ? <Idp v={c.indicadores.idp} /> : "—"}</td>
                    <td className="dir num">{c.criticas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

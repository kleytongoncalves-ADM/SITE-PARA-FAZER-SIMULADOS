import type { Metadata } from "next";
import Link from "next/link";
import { dataCurta } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { ncsEmAberto } from "@/servicos/qualidade";
import { resumoSeguranca } from "@/servicos/seguranca";
import { TabelaNcs } from "../qualidade/Componentes";

export const metadata: Metadata = { title: "Segurança do trabalho" };

export default async function Seguranca() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "seguranca.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa a segurança do trabalho</b></div>;
  const [obras, ncs] = await Promise.all([resumoSeguranca(ator), ncsEmAberto(ator, "seguranca")]);
  const menor = obras.reduce<number | null>((m, o) => (o.diasSemAcidente == null ? m : m == null ? o.diasSemAcidente : Math.min(m, o.diasSemAcidente)), null);
  return (
    <>
      <div className="cabecalho"><div><div className="sobretitulo">Controlar</div><h1 className="titulo">Segurança do trabalho</h1></div></div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Obras em execução</span><b className="num">{obras.length}</b></div>
        <div className="indicador surgir"><span>Menor sequência sem acidente</span><b className="num">{menor ?? "—"}</b><small>dias</small></div>
        <div className={`indicador surgir${obras.some((o) => o.vencidas) ? " indicador-destaque" : ""}`}><span>Ações corretivas abertas</span><b className="num">{obras.reduce((s, o) => s + o.abertas, 0)}</b><small>{obras.reduce((s, o) => s + o.vencidas, 0)} vencidas</small></div>
        <div className="indicador surgir"><span>Não conformidades de segurança</span><b className="num">{ncs.length}</b></div>
      </div>
      {obras.length === 0 ? <div className="cartao vazio"><b>Nenhuma obra em execução</b></div> : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Obra</th><th className="dir">Dias sem acidente</th><th>Último acidente</th><th className="dir">Acidentes</th><th className="dir">Ações abertas</th><th className="dir">NCs</th></tr></thead>
            <tbody>
              {obras.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/obras/${o.id}/seguranca`} className="forte">{o.nome}</Link><div className="fraco num">{o.codigo}</div></td>
                  <td className="dir num forte">{o.diasSemAcidente ?? "—"}</td>
                  <td className="num">{o.ultimo ? dataCurta(o.ultimo) : "—"}</td>
                  <td className="dir num">{o.acidentes}</td>
                  <td className="dir num">{o.abertas}{o.vencidas ? <> <span className="etiqueta et-vermelha etiqueta-mini">{o.vencidas} vencidas</span></> : null}</td>
                  <td className="dir num">{o.ncs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ncs.length > 0 && <><h2 className="cartao-titulo" style={{ margin: "22px 0 12px" }}>Não conformidades de segurança em aberto</h2><TabelaNcs ncs={ncs} obra /></>}
    </>
  );
}

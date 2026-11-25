import type { Metadata } from "next";
import Link from "next/link";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import { dataCurta, dataHora } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { painelDocumentos, ROTULO_CATEGORIA } from "@/servicos/documentos";
import { pode } from "@/servicos/permissoes";
import { EtiquetaDocumento } from "./Apoio";

export const metadata: Metadata = { title: "Documentos" };

export default async function Documentos() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "documentos.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa os documentos</b></div>;
  const p = await painelDocumentos(ator);

  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo">Controlar</div><h1 className="titulo">Documentos</h1></div>
      </div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Documentos vigentes</span><b className="num">{p.total}</b><small>em {p.obras.filter((o) => o.total).length} {p.obras.filter((o) => o.total).length === 1 ? "obra" : "obras"}</small></div>
        <div className={`indicador surgir${p.vencidos ? " indicador-destaque" : ""}`}><span>Vencidos</span><b className="num">{p.vencidos}</b><small>{p.vencendo} {p.vencendo === 1 ? "vence" : "vencem"} em até 30 dias</small></div>
        <div className={`indicador surgir${p.pendentes ? " indicador-destaque" : ""}`}><span>Exigências pendentes</span><b className="num">{p.pendentes}</b><small>nas obras em execução</small></div>
        <div className="indicador surgir"><span>Obras sem ART de execução</span><b className="num">{p.semArt}</b><small>em execução ou paralisadas</small></div>
      </div>

      <div className="grade">
        <section className="cartao">
          <h2 className="cartao-titulo">Por obra</h2>
          {p.obras.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhuma obra no seu acesso.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Obra</th><th>Situação</th><th className="dir">Documentos</th><th className="dir">Vencidos</th><th className="dir">Vencendo</th><th>Faltando</th></tr></thead>
              <tbody>{p.obras.map((o) => (
                <tr key={o.id} className={o.vencidos || o.pendentes ? "linha-vencida" : ""}>
                  <td style={{ minWidth: 200 }}><Link href={`/obras/${o.id}/documentos`} className="forte">{o.codigo}</Link><div className="fraco">{o.nome}</div></td>
                  <td><EtiquetaSituacao situacao={o.situacao} /></td>
                  <td className="dir num">{o.total}</td>
                  <td className="dir num">{o.vencidos || "—"}</td>
                  <td className="dir num">{o.vencendo || "—"}</td>
                  <td>{o.faltando.length ? o.faltando.join(", ") : <span className="fraco">—</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>

        <div className="diario-colunas">
          <section className="cartao">
            <h2 className="cartao-titulo">Vencidos e a vencer</h2>
            {p.vencimentos.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhum documento vencido ou vencendo nos próximos 30 dias.</p> : (
              <ul className="lista-simples" style={{ marginTop: 10 }}>
                {p.vencimentos.map((d) => (
                  <li key={d.id}>
                    <div style={{ minWidth: 0 }}><Link href={`/documentos/${d.id}`} className="forte">{d.titulo}</Link><div className="fraco">{d.obraCodigo} · {d.tipo}</div></div>
                    <EtiquetaDocumento situacao={d.situacao} validade={d.validade} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="cartao">
            <h2 className="cartao-titulo">Enviados recentemente</h2>
            {p.recentes.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhum documento enviado.</p> : (
              <ul className="lista-simples" style={{ marginTop: 10 }}>
                {p.recentes.map((d) => (
                  <li key={d.id}>
                    <div style={{ minWidth: 0 }}><Link href={`/documentos/${d.id}`} className="forte">{d.titulo}</Link>
                      <div className="fraco">{d.obraCodigo} · {ROTULO_CATEGORIA[d.categoria]} · versão {d.versao}</div></div>
                    <span className="fraco sem-quebra">{dataHora(new Date(d.enviadoEm))}{d.validade && d.situacao === "vigente" ? ` · até ${dataCurta(d.validade)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

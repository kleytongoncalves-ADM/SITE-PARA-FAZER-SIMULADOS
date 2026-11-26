import type { Metadata } from "next";
import Link from "next/link";
import { dataHoraCurta, EtiquetaCotacao, tempoRestante } from "@/componentes/cotacao/Pecas";
import { moeda, percentual } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { painelCotacoes, ROTULO_SITUACAO_COTACAO, type SituacaoSolicitacao } from "@/servicos/cotacoes";
import { pode } from "@/servicos/permissoes";
import "@/estilos/cotacoes.css";

export const metadata: Metadata = { title: "Cotações" };

export default async function Cotacoes({ searchParams }: { searchParams: Promise<{ situacao?: string; obra?: string }> }) {
  const { situacao, obra } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "cotacao.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa as cotações</b>Peça o acesso ao administrador do sistema.</div>;
  const p = await painelCotacoes(ator, { obraId: obra, situacao });
  const geral = situacao ? await painelCotacoes(ator, { obraId: obra }) : p;
  const link = (s?: string) => `/cotacoes${[s && `situacao=${s}`, obra && `obra=${obra}`].filter(Boolean).map((x, i) => (i ? "&" : "?") + x).join("")}`;
  const emAndamento = geral.porSituacao.aberta + geral.porSituacao.encerrada;
  const respostas = p.fornecedores.filter((f) => f.convites > 0).slice(0, 8);

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Custos</div>
          <h1 className="titulo">Cotações</h1>
          <p className="subtitulo">Solicitações de preço a fornecedores, criadas a partir dos orçamentos.</p>
        </div>
      </div>

      {geral.lista.length === 0 && !obra ? (
        <div className="cartao vazio">
          <b>Nenhuma cotação</b>
          Abra um orçamento e use a aba Cotações para solicitar preços aos fornecedores.
          <Link href="/orcamentos" className="botao botao-texto">Ir para os orçamentos</Link>
        </div>
      ) : (
        <div className="grade">
          <div className="indicadores">
            <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Em andamento</span><b className="num">{emAndamento}</b><small>{geral.porSituacao.aberta} recebendo propostas · {geral.porSituacao.encerrada} aguardando apuração</small></div>
            <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Prazo em até 3 dias</span><b className="num">{geral.vencendo.length}</b><small>{geral.vencendo[0] ? `${geral.vencendo[0].titulo} · ${tempoRestante(geral.vencendo[0].prazo)}` : "Nenhuma no período"}</small></div>
            <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Apuradas</span><b className="num">{geral.porSituacao.apurada}</b><small>{geral.porSituacao.cancelada ? `${geral.porSituacao.cancelada} canceladas` : "Com resultado homologado"}</small></div>
            <div className={`indicador surgir${geral.economia > 0 ? " indicador-destaque" : ""}`} style={{ "--i": 3 } as React.CSSProperties}><span>Economia apurada</span><b className="num">{moeda(geral.economia)}</b>
              <small>{geral.referenciaApurada > 0 ? `${percentual((geral.economia / geral.referenciaApurada) * 100, 1)} sobre ${moeda(geral.referenciaApurada)} de referência` : "Sem apuração homologada"}</small></div>
          </div>

          <div className="barra-acoes">
            <div className="chips">
              <Link href={link()} className={`chip ${!situacao ? "chip-ativo" : ""}`}>Todas <small className="num">{geral.lista.length}</small></Link>
              {(Object.keys(ROTULO_SITUACAO_COTACAO) as SituacaoSolicitacao[]).filter((s) => geral.porSituacao[s] || s === situacao).map((s) => (
                <Link key={s} href={link(s)} className={`chip ${situacao === s ? "chip-ativo" : ""}`}>{ROTULO_SITUACAO_COTACAO[s]} <small className="num">{geral.porSituacao[s]}</small></Link>
              ))}
            </div>
            {p.obras.length > 1 && (
              <form action="/cotacoes" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {situacao && <input type="hidden" name="situacao" value={situacao} />}
                <select name="obra" defaultValue={obra ?? ""} className="entrada-texto" style={{ height: 36, minWidth: 200 }} aria-label="Obra">
                  <option value="">Todas as obras</option>
                  {p.obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nome}</option>)}
                </select>
                <button className="botao botao-neutro botao-pequeno" style={{ height: 36 }}>Filtrar</button>
              </form>
            )}
          </div>

          {p.lista.length === 0 ? <div className="cartao vazio"><b>Nenhuma cotação neste filtro</b></div> : (
            <div className="tabela-caixa surgir">
              <table className="tabela">
                <thead><tr><th>Nº</th><th>Solicitação</th><th>Situação</th><th>Prazo</th><th className="dir">Respostas</th><th className="dir">Referência</th><th className="dir">Resultado</th><th className="dir">Economia</th></tr></thead>
                <tbody>{p.lista.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{String(s.numero).padStart(3, "0")}</td>
                    <td style={{ minWidth: 240 }}>
                      <Link href={`/cotacoes/${s.id}`} className="forte">{s.titulo}</Link>
                      <div className="fraco"><span className="num">{s.obraCodigo}</span> · {s.obraNome}</div>
                      <div className="fraco"><Link href={`/orcamentos/${s.orcamentoId}/cotacoes`}>Orçamento {s.orcamentoNumero} v{s.orcamentoVersao}</Link> · {s.materiais} {s.materiais === 1 ? "material" : "materiais"}</div>
                    </td>
                    <td><EtiquetaCotacao situacao={s.situacao} /></td>
                    <td className="sem-quebra num">{dataHoraCurta(s.prazo)}{s.situacao === "aberta" && <div className="fraco">{tempoRestante(s.prazo)}</div>}</td>
                    <td className="dir num">{s.respondidas} de {s.convidados}</td>
                    <td className="dir num">{s.totalReferencia ? moeda(s.totalReferencia) : "—"}</td>
                    <td className="dir num forte">{s.totalResultado ? moeda(s.totalResultado) : "—"}</td>
                    <td className="dir num">{s.economia ? <>{moeda(s.economia)}{Number(s.totalReferencia) > 0 && <div className="fraco">{percentual((Number(s.economia) / Number(s.totalReferencia)) * 100, 1)}</div>}</> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {respostas.length > 0 && (
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Fornecedores consultados</h2>
              <p className="cartao-sub">Convites enviados e respostas recebidas.</p>
              <div className="tabela-caixa" style={{ marginTop: 12 }}>
                <table className="tabela tabela-compacta">
                  <thead><tr><th>Fornecedor</th><th className="dir">Convites</th><th className="dir">Respostas</th><th className="dir">Declinou</th><th style={{ width: "30%" }}>Taxa de resposta</th></tr></thead>
                  <tbody>{respostas.map((f) => {
                    const taxa = Math.round((f.respostas / f.convites) * 100);
                    return (
                      <tr key={f.id}>
                        <td className="forte">{f.razaoSocial}</td><td className="dir num">{f.convites}</td><td className="dir num">{f.respostas}</td><td className="dir num">{f.declinios}</td>
                        <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="cot-cobertura" style={{ flex: 1 }}><i style={{ width: `${taxa}%` }} /></div><span className="num fraco">{taxa}%</span></div></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

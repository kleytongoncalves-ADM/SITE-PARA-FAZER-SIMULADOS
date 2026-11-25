import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileText, Filter } from "lucide-react";
import { ColunasMensais, COR } from "@/componentes/relatorio/Graficos";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import { dataCurta, moeda, numero, percentual } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { LIMITES, painelGerencial, type Nivel } from "@/servicos/gerencial";
import { pode } from "@/servicos/permissoes";
import { ROTULO_SITUACAO, ROTULO_TIPO, TIPOS_OBRA } from "@/servicos/rotulos";
import { lerFiltros, rotuloMes, SITUACOES_FILTRO } from "./filtros";

export const metadata: Metadata = { title: "Painel gerencial" };

const NIVEL: Record<Nivel, { rotulo: string; classe: string }> = {
  vermelho: { rotulo: "Crítica", classe: "sinal-vermelho" }, amarelo: { rotulo: "Atenção", classe: "sinal-amarelo" }, verde: { rotulo: "Em dia", classe: "sinal-verde" },
};

export default async function PainelGerencial({ searchParams }: { searchParams: Promise<{ tipo?: string; unidade?: string; situacao?: string }> }) {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "gerencial.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa o painel gerencial</b></div>;
  const f = await searchParams;
  const filtros = lerFiltros(f);
  const p = await painelGerencial(ator, filtros);
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]).toString();
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
  const vencidos = p.vencimentos.filter((v) => v.vencido).length;

  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo">Visão geral</div><h1 className="titulo">Painel gerencial</h1></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/gerencial/relatorio${qs ? `?${qs}` : ""}`} className="botao botao-neutro"><FileText /> Relatório</Link>
          <a href={`/gerencial/excel${qs ? `?${qs}` : ""}`} className="botao botao-neutro"><FileSpreadsheet /> Excel</a>
        </div>
      </div>

      <form className="cartao filtros-gerencial" style={{ marginBottom: 14 }}>
        <div className="campo"><label htmlFor="f-tipo">Tipo de obra</label>
          <select id="f-tipo" name="tipo" className="entrada-texto" defaultValue={filtros.tipo ?? ""}>
            <option value="">Todos</option>{TIPOS_OBRA.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
          </select></div>
        {p.unidades.length > 0 && (
          <div className="campo"><label htmlFor="f-un">Unidade</label>
            <select id="f-un" name="unidade" className="entrada-texto" defaultValue={filtros.unidade ?? ""}>
              <option value="">Todas</option>{p.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select></div>
        )}
        <div className="campo"><label htmlFor="f-sit">Situação</label>
          <select id="f-sit" name="situacao" className="entrada-texto" defaultValue={filtros.situacao ?? ""}>
            <option value="">Da licitação ao recebimento</option>{SITUACOES_FILTRO.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
          </select></div>
        <div className="filtros-acoes">
          <button className="botao botao-primario"><Filter /> Filtrar</button>
          {qs && <Link href="/gerencial" className="botao botao-neutro">Limpar</Link>}
        </div>
      </form>

      <div className="semaforo-resumo">
        {(["vermelho", "amarelo", "verde"] as Nivel[]).map((n) => (
          <div key={n} className={`cartao semaforo-total ${NIVEL[n].classe}`}>
            <i aria-hidden="true" /><div><b className="num">{p.porNivel[n]}</b><span>{p.porNivel[n] === 1 ? "obra" : "obras"} · {NIVEL[n].rotulo.toLowerCase()}</span></div>
          </div>
        ))}
      </div>

      <div className="indicadores">
        <div className="indicador surgir"><span>Valor contratado</span><b className="num">{moeda(p.totais.contratado)}</b><small>{(() => { const k = p.obras.filter((o) => o.contratado > 0).length; return `${k} ${k === 1 ? "obra" : "obras"} com contrato`; })()}</small></div>
        <div className="indicador surgir"><span>Medido</span><b className="num">{moeda(p.totais.medido)}</b><small>{percentual(pct(p.totais.medido, p.totais.contratado), 1)} do contratado</small></div>
        <div className="indicador surgir"><span>Pago</span><b className="num">{moeda(p.totais.pago)}</b><small>{percentual(pct(p.totais.pago, p.totais.medido), 1)} do medido</small></div>
        <div className={`indicador surgir${p.totais.aPagar ? " indicador-destaque" : ""}`}><span>A pagar</span><b className="num">{moeda(p.totais.aPagar)}</b><small>medições aprovadas sem pagamento</small></div>
        <div className="indicador surgir"><span>Saldo a medir</span><b className="num">{moeda(p.totais.saldo)}</b><small>contratado menos medido</small></div>
      </div>

      <div className="grade">
        <section className="cartao">
          <h2 className="cartao-titulo">Obras</h2>
          <p className="cartao-sub">IDP: executado ÷ planejado até hoje na linha de base. Atenção abaixo de {numero(LIMITES.idpAtencao, 2)}, crítico abaixo de {numero(LIMITES.idpCritico, 2)}.</p>
          {p.obras.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhuma obra com esses filtros.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Obra</th><th>Situação</th><th className="dir">Contratado</th><th className="dir">Medido</th><th className="dir">Físico</th><th className="dir">IDP</th><th>O que pede atenção</th></tr></thead>
              <tbody>{p.obras.map((o) => (
                <tr key={o.id}>
                  <td style={{ minWidth: 200 }}>
                    <span className={`sinal ${NIVEL[o.nivel].classe}`} title={NIVEL[o.nivel].rotulo} aria-label={NIVEL[o.nivel].rotulo} />
                    <Link href={`/obras/${o.id}`} className="forte num">{o.codigo}</Link>
                    <div className="fraco">{o.nome}{o.unidade ? ` · ${o.unidade}` : ""}</div></td>
                  <td><EtiquetaSituacao situacao={o.situacao} /></td>
                  <td className="dir num">{o.contratado ? moeda(o.contratado) : "—"}</td>
                  <td className="dir num">{o.contratado ? percentual(o.executadoPct, 1) : "—"}{o.aPagar > 0 && <div className="fraco">{moeda(o.aPagar)} a pagar</div>}</td>
                  <td className="dir num">{o.realizadoPct != null ? <>{percentual(o.realizadoPct, 1)}<div className="fraco">de {percentual(o.previstoPct!, 1)}</div></> : "—"}</td>
                  <td className="dir num">{o.idp != null ? numero(o.idp, 2) : "—"}</td>
                  <td style={{ minWidth: 240 }}>{o.motivos.length === 0 ? <span className="fraco">Nada pendente</span> : (
                    <ul className="motivos">{o.motivos.map((m) => <li key={m.texto} className={m.nivel === "vermelho" ? "motivo-grave" : ""}><Link href={m.href}>{m.texto}</Link></li>)}</ul>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>

        <div className="diario-colunas">
          {p.mensal.length > 0 && (
            <section className="cartao grafico-tela">
              <ColunasMensais titulo="Medido e pago por mês (R$)" series={[{ rotulo: "Medido", cor: COR.bdi }, { rotulo: "Pago", cor: COR.maoDeObra }]}
                meses={p.mensal.map((x) => ({ rotulo: rotuloMes(x.mes), valores: [x.medido, x.pago] }))} />
            </section>
          )}
          <section className="cartao">
            <h2 className="cartao-titulo">Agenda de vencimentos</h2>
            <p className="cartao-sub">{vencidos ? `${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"} e o que vence nos próximos 60 dias.` : "O que vence nos próximos 60 dias."}</p>
            {p.vencimentos.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nada vence nos próximos 60 dias.</p> : (
              <ul className="agenda" style={{ marginTop: 10 }}>
                {p.vencimentos.map((v, i) => (
                  <li key={i} className={v.vencido ? "agenda-vencida" : ""}>
                    <span className="agenda-data num">{dataCurta(v.data)}</span>
                    <div style={{ minWidth: 0 }}><Link href={v.href} className="forte">{v.descricao}</Link><div className="fraco">{v.tipo}{v.obraCodigo ? ` · ${v.obraCodigo}` : ""}</div></div>
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

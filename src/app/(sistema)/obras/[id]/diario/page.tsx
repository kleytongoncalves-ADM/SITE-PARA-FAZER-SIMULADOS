import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Plus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta, mesAno, numero } from "@/lib/formato";
import { resumoDiarios, ROTULO_MOTIVO } from "@/servicos/campo";
import { somarDias } from "@/servicos/cpm";
import { pode } from "@/servicos/permissoes";
import { acaoAbrirDiario } from "../../../diario/acoes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Diário de obra" };

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function mesVizinho(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DiarioDaObra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const { mes } = await searchParams;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="diario" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "diario.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa o diário de obra</b></div></>;
  const r = await resumoDiarios(ator, id, mes);
  const porData = new Map(r.dias.map((d) => [d.data, d]));
  const pend = new Set(r.pendentes);
  const primeiro = `${r.mes}-01`;
  const deslocamento = new Date(`${primeiro}T12:00:00Z`).getUTCDay();
  const fim = somarDias(`${mesVizinho(r.mes, 1)}-01`, -1);
  const dias: string[] = [];
  for (let d = primeiro; d <= fim; d = somarDias(d, 1)) dias.push(d);
  const horasParadas = r.paradas.reduce((s, p) => s + p.horas, 0);

  return (
    <>
      {cab}
      <div className="indicadores">
        <div className="indicador"><span>Diários registrados</span><b className="num">{r.dias.length}</b><small>em {mesAno(primeiro)}</small></div>
        <div className={`indicador${r.totalPendentes ? " indicador-destaque" : ""}`}><span>Dias úteis sem diário</span><b className="num">{r.totalPendentes}</b><small>desde o início da obra</small></div>
        <div className="indicador"><span>Aguardando visto do fiscal</span><b className="num">{r.semVisto}</b></div>
        <div className="indicador"><span>Horas paradas</span><b className="num">{numero(horasParadas, 1)} h</b><small>{r.diasChuva} {r.diasChuva === 1 ? "dia" : "dias"} com chuva</small></div>
      </div>

      <div className="diario-mes">
        <section className="cartao" style={{ minWidth: 0 }}>
          <div className="barra-acoes">
            <Link href={`?mes=${mesVizinho(r.mes, -1)}`} className="botao botao-neutro botao-pequeno" aria-label="Mês anterior"><ChevronLeft /></Link>
            <h2 className="cartao-titulo" style={{ textTransform: "capitalize" }}>{mesAno(primeiro)}</h2>
            <Link href={`?mes=${mesVizinho(r.mes, 1)}`} className="botao botao-neutro botao-pequeno" aria-label="Próximo mês"><ChevronRight /></Link>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/obras/${id}/diario/relatorio?de=${primeiro}&ate=${fim}`} className="botao botao-neutro botao-pequeno"><FileText /> Relatório do mês</Link>
              <a href={`/obras/${id}/diario/excel?de=${primeiro}&ate=${fim}`} className="botao botao-neutro botao-pequeno"><FileSpreadsheet /> Excel</a>
            </div>
          </div>
          <div className="calendario-mes" style={{ marginTop: 14 }}>
            {SEMANA.map((s) => <div key={s} className="cab">{s}</div>)}
            {Array.from({ length: deslocamento }, (_, i) => <div key={`v${i}`} className="dia dia-fora" aria-hidden />)}
            {dias.map((d) => {
              const x = porData.get(d);
              const cls = `dia${x ? (x.situacao === "assinado" ? " dia-assinado" : " dia-rascunho") : pend.has(d) ? " dia-pendente" : ""}${d === r.hoje ? " dia-hoje" : ""}`;
              const corpo = (
                <>
                  <b className="num">{Number(d.slice(8))}</b>
                  {x && <span>nº {x.numero}{x.visto ? " · visto" : ""}</span>}
                  {x && (
                    <span className="dia-marcas">
                      {x.efetivo > 0 && <i>{x.efetivo} pess.</i>}
                      {x.chuva && <i>chuva</i>}
                      {x.horasParadas > 0 && <i>{numero(x.horasParadas, 1)} h parada</i>}
                    </span>
                  )}
                </>
              );
              return x ? <Link key={d} href={`/diario/${x.id}`} className={cls}>{corpo}</Link> : <div key={d} className={cls}>{corpo}</div>;
            })}
          </div>
          <div className="legenda-calendario">
            <span style={{ ["--c" as string]: "rgba(23,131,74,0.25)" }}>Assinado</span>
            <span style={{ ["--c" as string]: "rgba(242,140,40,0.3)" }}>Em elaboração</span>
            <span style={{ ["--c" as string]: "transparent", ["--b" as string]: "#c23a3a" }}>Dia útil sem diário</span>
          </div>
        </section>

        <div className="grade">
          {r.podeLancar && (
            <section className="cartao">
              <h2 className="cartao-titulo">{r.diarioDeHoje ? "Diário de hoje" : "Abrir diário"}</h2>
              {r.diarioDeHoje ? (
                <p className="cartao-sub" style={{ marginTop: 8 }}>
                  <Link href={`/diario/${r.diarioDeHoje.id}`} className="botao botao-primario" style={{ marginTop: 6 }}>Abrir o diário de hoje</Link>
                </p>
              ) : null}
              <FormAcao acao={acaoAbrirDiario.bind(null, id)} className="form-linha form-base" style={{ marginTop: 12 }}>
                <div className="campo"><label htmlFor="dt">Data</label><input id="dt" name="data" type="date" className="entrada-texto" max={r.hoje} defaultValue={r.diarioDeHoje ? (r.pendentes.at(-1) ?? "") : r.hoje} required /></div>
                <BotaoEnviar className={r.diarioDeHoje ? "botao botao-neutro" : "botao botao-primario"} enviando="Abrindo…"><Plus /> Abrir</BotaoEnviar>
              </FormAcao>
            </section>
          )}

          <section className="cartao">
            <h2 className="cartao-titulo">Dias parados por motivo</h2>
            {r.paradas.length === 0 ? <p className="cartao-sub">Nenhuma paralisação registrada.</p> : (
              <table className="tabela tabela-compacta" style={{ marginTop: 8 }}>
                <thead><tr><th>Motivo</th><th className="dir">Dias</th><th className="dir">Horas</th></tr></thead>
                <tbody>
                  {r.paradas.map((p) => <tr key={p.motivo}><td>{ROTULO_MOTIVO[p.motivo]}</td><td className="dir num">{p.dias}</td><td className="dir num">{numero(p.horas, 1)}</td></tr>)}
                  <tr className="linha-total"><td>Total</td><td className="dir num">{r.paradas.reduce((s, p) => s + p.dias, 0)}</td><td className="dir num">{numero(horasParadas, 1)}</td></tr>
                </tbody>
              </table>
            )}
            <p className="cartao-sub" style={{ marginTop: 10 }}>Base para justificar prorrogação de prazo em aditivo.</p>
          </section>

          <section className="cartao">
            <h2 className="cartao-titulo">Relatório do período</h2>
            <form action={`/obras/${id}/diario/relatorio`} className="form-linha form-base" style={{ marginTop: 10 }}>
              <div className="campo"><label htmlFor="de">De</label><input id="de" name="de" type="date" className="entrada-texto" defaultValue={primeiro} required /></div>
              <div className="campo"><label htmlFor="ate">Até</label><input id="ate" name="ate" type="date" className="entrada-texto" defaultValue={fim < r.hoje ? fim : r.hoje} required /></div>
              <button className="botao botao-neutro"><FileText /> Gerar</button>
            </form>
            {r.pendentes.length > 0 && (
              <p className="cartao-sub" style={{ marginTop: 10 }}>Sem diário no mês: {r.pendentes.slice(0, 8).map((d) => dataCurta(d).slice(0, 5)).join(", ")}{r.pendentes.length > 8 ? ` e mais ${r.pendentes.length - 8}` : ""}.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

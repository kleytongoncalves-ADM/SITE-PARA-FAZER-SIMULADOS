import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { BarrasHorizontais, ColunasDiarias, COR } from "@/componentes/relatorio/Graficos";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { relatorioDiario, ROTULO_CLIMA, ROTULO_CONDICAO, ROTULO_MOTIVO, ROTULO_OCORRENCIA_DIARIO } from "@/servicos/campo";
import { SemPermissao } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Relatório do diário de obra" };

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export default async function RelatorioDiario({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const u = await exigirUsuario();
  const de = q.de ?? `${hoje().slice(0, 7)}-01`;
  const ate = q.ate ?? hoje();
  let r;
  try {
    r = await relatorioDiario(comoAtor(u), id, de, ate);
  } catch (e) {
    if (e instanceof SemPermissao) notFound();
    if (e instanceof ErroDeRegra) return <div className="cartao vazio"><b>{e.message}</b><Link href={`/obras/${id}/diario`}>Voltar ao diário</Link></div>;
    throw e;
  }
  const um = de === ate;
  const periodo = um ? dataCurta(de) : `${dataCurta(de)} a ${dataCurta(ate)}`;
  const horas = r.paradas.reduce((s, p) => s + p.horas, 0);
  const comFoto = r.diarios.flatMap((d) => d.fotos.map((f) => ({ ...f, data: d.data }))).slice(0, um ? 12 : 16);
  let secao = 0;
  const n = () => ++secao;
  const pontos: string[] = [];
  if (r.diasUteisSemDiario.length) pontos.push(`${r.diasUteisSemDiario.length} ${r.diasUteisSemDiario.length === 1 ? "dia útil" : "dias úteis"} sem diário no período.`);
  if (r.diarios.length - r.assinados) pontos.push(`${r.diarios.length - r.assinados} ${r.diarios.length - r.assinados === 1 ? "diário" : "diários"} em elaboração, sem assinatura.`);
  if (r.assinados - r.vistados) pontos.push(`${r.assinados - r.vistados} ${r.assinados - r.vistados === 1 ? "diário assinado aguarda" : "diários assinados aguardam"} o visto do fiscal.`);
  if (horas) pontos.push(`${numero(horas, 1)} h de paralisação, a maior parte por ${ROTULO_MOTIVO[r.paradas[0].motivo].toLowerCase()} (${numero(r.paradas[0].horas, 1)} h).`);
  if (r.diasChuva) pontos.push(`${r.diasChuva} ${r.diasChuva === 1 ? "dia" : "dias"} com chuva registrada.`);

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${id}/diario`} className="botao botao-neutro"><ArrowLeft /> Voltar ao diário</Link>
        <a href={`/obras/${id}/diario/excel?de=${de}&ate=${ate}`} className="botao botao-neutro"><FileSpreadsheet /> Excel</a>
        <BotaoImprimir />
      </div>

      <article className="rel">
        <CabecalhoRelatorio
          orgao={u.orgaoNome}
          tipo={um ? "Diário de obra" : "Relatório do diário de obra"}
          titulo={um && r.diarios[0] ? `Diário nº ${r.diarios[0].numero} · ${periodo}` : `Diário de obra · ${periodo}`}
          subtitulo={`${r.obra.codigo} · ${r.obra.nome}`}
          selo={um && r.diarios[0] ? { texto: r.diarios[0].situacao === "assinado" ? (r.diarios[0].vistoEm ? "Assinado e vistado" : "Assinado") : "Em elaboração", cor: r.diarios[0].situacao === "assinado" ? "verde" : "laranja" } : undefined}
          dados={[
            ["Obra", `${r.obra.codigo} · ${r.obra.nome}`],
            ["Período", periodo],
            ["Diários no período", `${r.diasComDiario} de ${r.diasCorridos} ${r.diasCorridos === 1 ? "dia" : "dias"}`],
            ["Gerado", `${dataHora(new Date())} · ${u.nome}`],
          ]}
        />

        <Secao numero={n()} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Efetivo médio", valor: `${numero(r.efetivoMedio, 1)} pessoas`, detalhe: `máximo de ${r.efetivoMaximo}`, destaque: true },
            { rotulo: "Homens-dia", valor: numero(r.homensDia, 0), detalhe: "soma do efetivo diário" },
            { rotulo: "Horas paradas", valor: `${numero(horas, 1)} h`, detalhe: `${r.paradas.reduce((s, p) => s + p.dias, 0)} registros` },
            { rotulo: "Dias com chuva", valor: String(r.diasChuva) },
            { rotulo: "Assinados / vistados", valor: `${r.assinados} / ${r.vistados}`, detalhe: `de ${r.diasComDiario} diários` },
          ]} />
          {pontos.length > 0 && <ul className="rel-pontos">{pontos.map((p) => <li key={p}>{p}</li>)}</ul>}
        </Secao>

        {!um && r.diarios.length > 1 && (
          <Secao numero={n()} titulo="Efetivo e paralisações" descricao="Pessoas em campo por dia registrado e horas paradas por motivo.">
            <ColunasDiarias titulo="Efetivo diário (pessoas)" unidade="Pessoas" dias={r.diarios.map((d) => ({ rotulo: dataCurta(d.data).slice(0, 5), valor: d.totalEfetivo, destaque: d.horasParadas > 0 }))} />
            <div className="rel-duas">
              {r.efetivoPorFuncao.length > 0 && <BarrasHorizontais titulo="Homens-dia por função" unidade="h-d" itens={r.efetivoPorFuncao.slice(0, 10).map((e) => ({ rotulo: e.funcao, valor: e.homensDia }))} />}
              {r.paradas.length > 0 && <BarrasHorizontais titulo="Horas paradas por motivo" unidade="h" casas={1} cor={COR.maoDeObra} itens={r.paradas.map((p) => ({ rotulo: `${ROTULO_MOTIVO[p.motivo]} (${p.dias} ${p.dias === 1 ? "dia" : "dias"})`, valor: p.horas }))} />}
            </div>
          </Secao>
        )}

        {r.avancos.length > 0 && (
          <Secao numero={n()} titulo="Avanço físico das atividades" descricao="Percentual acumulado na linha de base do cronograma, antes e ao fim do período.">
            <table className="rel-tabela">
              <thead><tr><th>Atividade</th><th className="dir">Antes</th><th className="dir">Ao fim</th><th className="dir">No período</th></tr></thead>
              <tbody>{r.avancos.map((x) => <tr key={x.codigo}><td>{x.codigo} {x.nome}</td><td className="dir num">{numero(x.de, 1)}%</td><td className="dir num">{numero(x.ate, 1)}%</td><td className="dir num">+{numero(x.ate - x.de, 1)} p.p.</td></tr>)}</tbody>
            </table>
          </Secao>
        )}

        <Secao numero={n()} titulo={um ? "Registro do dia" : "Registros diários"} quebra={!um}>
          {r.diarios.length === 0 && <p className="fraco">Nenhum diário no período.</p>}
          {r.diarios.map((d) => (
            <div key={d.id} className="rel-diario">
              <div className="rel-diario-topo">
                <b>Nº {d.numero} · <span className="num">{dataCurta(d.data)}</span></b>
                <span>Manhã {ROTULO_CLIMA[d.climaManha].toLowerCase()} · tarde {ROTULO_CLIMA[d.climaTarde].toLowerCase()} · {ROTULO_CONDICAO[d.condicao].toLowerCase()}</span>
                <span className={d.situacao === "assinado" ? "" : "fraco"}>{d.situacao === "assinado" ? `Assinado por ${d.assinadoPor}${d.vistoEm ? ` · visto de ${d.vistoPor}` : ""}` : "Em elaboração"}</span>
              </div>
              {d.relato && <p>{d.relato}</p>}
              {d.efetivo.length > 0 && <p><b>Efetivo ({d.totalEfetivo}):</b> {d.efetivo.map((e) => `${e.quantidade} ${e.funcao.toLowerCase()}${e.empresa ? ` (${e.empresa})` : ""}`).join(", ")}.</p>}
              {d.equipamentos.length > 0 && <p><b>Equipamentos:</b> {d.equipamentos.map((e) => `${e.quantidade} ${e.descricao}${e.horas != null ? `, ${numero(e.horas, 1)} h` : ""}`).join("; ")}.</p>}
              {d.servicos.length > 0 && <p><b>Serviços:</b> {d.servicos.map((s) => `${s.descricao}${s.local ? ` (${s.local})` : ""}${s.avancoPct != null ? `, ${numero(s.avancoPct, 0)}% acumulado` : ""}`).join("; ")}.</p>}
              {d.ocorrencias.map((o) => <p key={o.id}><b>{ROTULO_OCORRENCIA_DIARIO[o.tipo]}{o.motivo ? ` · ${ROTULO_MOTIVO[o.motivo]}` : ""}{o.horas ? ` · ${numero(o.horas, 1)} h` : ""}:</b> {o.descricao}</p>)}
              {d.complementos.map((c) => <p key={c.id}><b>Complemento em {dataHora(c.em)} ({c.por}):</b> {c.texto}</p>)}
              {d.vistoObservacao && <p><b>Observação do fiscal:</b> {d.vistoObservacao}</p>}
            </div>
          ))}
        </Secao>

        {comFoto.length > 0 && (
          <Secao numero={n()} titulo="Registro fotográfico" descricao={r.fotos > comFoto.length ? `${comFoto.length} de ${r.fotos} fotos do período.` : undefined}>
            <div className="rel-fotos">
              {comFoto.map((f) => (
                <figure key={f.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/fotos/${f.id}`} alt={f.legenda ?? "Foto"} />
                  <figcaption>{dataCurta(f.data)}{f.legenda ? ` · ${f.legenda}` : ""}{f.latitude != null ? ` · ${f.latitude.toFixed(5)}, ${f.longitude!.toFixed(5)}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          </Secao>
        )}

        <Secao numero={n()} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Fonte:</b> diários de obra registrados no sistema para a obra e o período indicados.</li>
            <li><b>Efetivo médio:</b> soma do efetivo de cada diário dividida pelo número de diários. Homens-dia: soma do efetivo diário.</li>
            <li><b>Dias sem diário:</b> dias úteis (segunda a sexta, sem feriados) desde o início da obra, até a véspera da emissão.</li>
            <li><b>Avanço:</b> percentual acumulado registrado na linha de base do cronograma, por diário, medição ou lançamento manual.</li>
            <li><b>Diário assinado</b> não se altera; correções posteriores constam como complementos com data, hora e autor.</li>
          </ul>
        </Secao>

        {um && r.diarios[0] && (
          <footer className="rel-assinaturas">
            <div><span className="rel-linha-assinatura" /><b>{r.diarios[0].assinadoPor ?? "Responsável técnico"}</b><span>Responsável técnico{r.diarios[0].assinadoEm ? ` · ${dataHora(r.diarios[0].assinadoEm)}` : ""}</span></div>
            <div><span className="rel-linha-assinatura" /><b>{r.diarios[0].vistoPor ?? "Fiscal do contrato"}</b><span>Fiscal{r.diarios[0].vistoEm ? ` · ${dataHora(r.diarios[0].vistoEm)}` : ""}</span></div>
          </footer>
        )}
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${r.obra.codigo} · diário de obra ${periodo} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}

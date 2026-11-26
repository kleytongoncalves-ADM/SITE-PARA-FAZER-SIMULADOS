import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { BarrasHorizontais } from "@/componentes/relatorio/Graficos";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, numero, unidadeMedida } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { painelQualidade, ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_SITUACAO_NC, rotuloNc, type Gravidade, type SituacaoNc } from "@/servicos/qualidade";

export const metadata: Metadata = { title: "Relatório de qualidade" };
const COR_SIT: Record<SituacaoNc, string> = { aberta: "#c23a3a", corrigida: "#f28c28", encerrada: "#17834a", cancelada: "#8aa0a6" };
const COR_GRAV: Record<Gravidade, string> = { leve: "#19b6c2", moderada: "#f28c28", grave: "#c23a3a" };

export default async function RelatorioQualidade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  let p;
  try {
    p = await painelQualidade(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const situacoes = (["aberta", "corrigida", "encerrada", "cancelada"] as SituacaoNc[]).map((s) => ({ rotulo: ROTULO_SITUACAO_NC[s], valor: p.ncs.filter((n) => n.situacao === s).length, cor: COR_SIT[s] })).filter((x) => x.valor);
  const ativas = p.ncs.filter((n) => n.situacao === "aberta" || n.situacao === "corrigida");
  const gravidades = (["grave", "moderada", "leve"] as Gravidade[]).map((g) => ({ rotulo: ROTULO_GRAVIDADE[g], valor: ativas.filter((n) => n.gravidade === g).length, cor: COR_GRAV[g] }));
  const pontos: string[] = [];
  if (p.vencidas) pontos.push(`${p.vencidas} ${p.vencidas === 1 ? "não conformidade está" : "não conformidades estão"} com prazo vencido.`);
  if (p.impeditivas) pontos.push(`${p.impeditivas} ${p.impeditivas === 1 ? "não conformidade impeditiva trava" : "não conformidades impeditivas travam"} a medição de itens da planilha.`);
  if (p.aguardando) pontos.push(`${p.aguardando} ${p.aguardando === 1 ? "correção aguarda" : "correções aguardam"} a verificação do fiscal.`);
  if (p.ensaiosReprovados) pontos.push(`${p.ensaiosReprovados} de ${p.ensaios.length} ensaios reprovados.`);
  if (!pontos.length) pontos.push("Nenhuma pendência de qualidade em aberto.");
  let s = 0;
  const n = () => ++s;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${id}/qualidade`} className="botao botao-neutro"><ArrowLeft /> Voltar</Link>
        <a href={`/obras/${id}/qualidade/excel`} className="botao botao-neutro"><FileSpreadsheet /> Excel</a>
        <BotaoImprimir />
      </div>
      <article className="rel">
        <CabecalhoRelatorio orgao={u.orgaoNome} tipo="Relatório de qualidade e fiscalização" titulo={`Qualidade · ${p.obra.codigo}`} subtitulo={p.obra.nome}
          selo={{ texto: ativas.length ? `${ativas.length} em aberto` : "Sem pendências", cor: ativas.length ? (p.vencidas ? "vermelho" : "laranja") : "verde" }}
          dados={[["Obra", `${p.obra.codigo} · ${p.obra.nome}`], ["Posição em", dataHora(new Date())], ["Inspeções", String(p.inspecoes.length)], ["Ensaios", String(p.ensaios.length)]]} />

        <Secao numero={n()} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Em aberto", valor: String(ativas.length), detalhe: `${p.aguardando} aguardando verificação`, destaque: true },
            { rotulo: "Prazo vencido", valor: String(p.vencidas) },
            { rotulo: "Travando medição", valor: String(p.impeditivas) },
            { rotulo: "Tempo médio até encerrar", valor: p.tempoMedio != null ? `${numero(p.tempoMedio, 1)} dias` : "—", detalhe: `${p.encerradas} encerradas` },
            { rotulo: "Conformidade nas inspeções", valor: p.conformidade != null ? `${numero(p.conformidade, 0)}%` : "—" },
          ]} />
          <ul className="rel-pontos">{pontos.map((x) => <li key={x}>{x}</li>)}</ul>
        </Secao>

        {p.ncs.length > 0 && (
          <Secao numero={n()} titulo="Não conformidades">
            <div className="rel-duas">
              <BarrasHorizontais titulo="Por situação (todas)" unidade="" itens={situacoes} />
              <BarrasHorizontais titulo="Em aberto por gravidade" unidade="" itens={gravidades} />
            </div>
            <table className="rel-tabela">
              <thead><tr><th>NC</th><th>Descrição</th><th>Gravidade</th><th>Responsável</th><th>Prazo</th><th>Situação</th><th className="dir">Dias</th></tr></thead>
              <tbody>
                {p.ncs.map((x) => (
                  <tr key={x.id}>
                    <td className="num">{rotuloNc(x)}</td>
                    <td>{x.titulo}<div className="fraco">{[ROTULO_ORIGEM_NC[x.origem], x.local, x.itemNumero ? `item ${x.itemNumero}` : null, x.impeditiva ? "impeditiva" : null].filter(Boolean).join(" · ")}</div></td>
                    <td>{ROTULO_GRAVIDADE[x.gravidade]}</td><td>{x.responsavel}</td>
                    <td className="num">{dataCurta(x.prazo)}{x.vencida ? " (vencido)" : ""}</td>
                    <td>{ROTULO_SITUACAO_NC[x.situacao]}</td><td className="dir num">{x.diasEmAberto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {p.inspecoes.length > 0 && (
          <Secao numero={n()} titulo="Inspeções">
            <table className="rel-tabela">
              <thead><tr><th>Nº</th><th>Checklist</th><th>Data</th><th>Local</th><th className="dir">Conformes</th><th className="dir">Não conformes</th><th className="dir">Conformidade</th></tr></thead>
              <tbody>{p.inspecoes.map((i) => { const t = i.conformes + i.naoConformes; return (
                <tr key={i.id}><td className="num">{i.numero}</td><td>{i.titulo}</td><td className="num">{dataCurta(i.data)}</td><td>{i.local ?? "—"}</td><td className="dir num">{i.conformes}</td><td className="dir num">{i.naoConformes}</td><td className="dir num">{t ? Math.round((i.conformes / t) * 100) : 100}%</td></tr>
              ); })}</tbody>
            </table>
          </Secao>
        )}

        {p.ensaios.length > 0 && (
          <Secao numero={n()} titulo="Ensaios">
            <table className="rel-tabela">
              <thead><tr><th>Nº</th><th>Ensaio</th><th>Local</th><th>Resultado em</th><th className="dir">Especificado</th><th className="dir">Resultado</th><th>Situação</th></tr></thead>
              <tbody>{p.ensaios.map((e) => (
                <tr key={e.id}><td className="num">{e.numero}</td><td>{e.tipo}{e.laudo ? <div className="fraco">Laudo {e.laudo}</div> : null}</td><td>{e.local ?? "—"}</td><td className="num">{dataCurta(e.dataResultado)}</td>
                  <td className="dir num">{e.criterio === "minimo" ? "≥" : "≤"} {Number(e.especificado).toLocaleString("pt-BR")} {unidadeMedida(e.unidade)}</td><td className="dir num">{Number(e.resultado).toLocaleString("pt-BR")} {unidadeMedida(e.unidade)}</td>
                  <td>{e.aprovado ? "Aprovado" : `Reprovado${e.ncNumero ? ` · ${rotuloNc({ numero: e.ncNumero })}` : ""}`}</td></tr>
              ))}</tbody>
            </table>
          </Secao>
        )}

        <Secao numero={n()} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Fonte:</b> não conformidades, inspeções e ensaios registrados no sistema para esta obra.</li>
            <li><b>Prazo vencido:</b> não conformidade aberta ou aguardando verificação com prazo anterior a hoje.</li>
            <li><b>Impeditiva:</b> trava a medição do item da planilha até ser encerrada pelo fiscal.</li>
            <li><b>Ensaio:</b> aprovado quando o resultado atende o critério (mínimo ou máximo) especificado; o reprovado abre não conformidade grave.</li>
            <li><b>Conformidade:</b> itens conformes sobre itens avaliados nas inspeções, sem os itens que não se aplicam.</li>
          </ul>
        </Secao>
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${p.obra.codigo} · relatório de qualidade · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, FileText, Stamp, X } from "lucide-react";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import { Classificacao, fraseEconomia, ItensApurados } from "@/componentes/cotacao/Resultado";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { moeda, valor } from "@/lib/formato";
import { FATORES, ROTULO_CRITERIO_APURACAO, ROTULO_FATOR, type Apuracao } from "@/servicos/cotacao-calculo";
import { acaoAvaliar, acaoHomologar, acaoRemoverAvaliacao } from "../../acoes";
import { carregarSolicitacao } from "../carregar";
import { Fechada } from "../Fechada";

export const metadata: Metadata = { title: "Apuração da cotação" };

function Regra({ a }: { a: Apuracao }) {
  return (
    <p className="fraco" style={{ fontSize: 12.5, marginTop: 10 }}>
      {a.criterio === "item" ? "Vence cada item o menor preço unitário válido."
        : a.criterio === "global" ? "Vence o menor total entre as propostas que cotaram todos os itens."
        : `Nota de 0 a 100 por fator, ponderada pelos pesos definidos no envio: ${FATORES.filter((k) => a.pesos[k] > 0).map((k) => `${ROTULO_FATOR[k].toLowerCase()} ${a.pesos[k]}`).join(", ")}. Concorrem as propostas que cotaram todos os itens. A marca não pontua.`}
      {" "}Desempate: {a.desempate.charAt(0).toLowerCase() + a.desempate.slice(1)}
    </p>
  );
}

export default async function ApuracaoDaCotacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  const gravada = s.apuracoes[0] ?? null;
  if (!s.precosVisiveis || !s.mapa) return <Fechada s={s} titulo="Apuração indisponível" />;
  if (s.situacao === "aberta") return <div className="cartao vazio"><b>Recebimento em andamento</b>A apuração começa quando o prazo terminar ou o recebimento for encerrado.</div>;
  if (s.situacao === "cancelada" && !gravada) return <div className="cartao vazio"><b>Cotação cancelada sem apuração</b></div>;
  const previa = s.previa;
  const nomes = new Map(s.convites.map((c) => [c.id, c.razaoSocial]));
  const ofertas = s.mapa.linhas.flatMap((l) => l.ofertas.filter((o) => o.preco != null && !o.excluida).map((o) => ({ chave: `${o.conviteId}|${l.material.id}`, rotulo: `${nomes.get(o.conviteId)} · ${l.material.descricao} · R$ ${valor(o.preco)}${o.discrepante ? " · fora do padrão" : ""}` })));
  const completas = s.mapa.fornecedores.filter((f) => f.completa);
  const exigeJustificativa = s.propostas.length < 3 || s.apuracoes.length > 0;

  return (
    <div className="grade">
      {s.situacao === "encerrada" && !s.propostas.length && <div className="cartao vazio"><b>Nenhuma proposta recebida</b>Reabra o recebimento com novo prazo ou cancele a cotação.</div>}

      {s.situacao === "encerrada" && previa && (
        <>
          <div className="cot-resultado surgir">
            <span>Resultado calculado · {ROTULO_CRITERIO_APURACAO[previa.criterio]}</span>
            <b>{previa.semVencedor ?? (previa.vencedor ? `${previa.vencedor.fornecedor} · ${moeda(previa.totalResultado)}` : `${new Set(previa.itens.filter((i) => i.conviteId).map((i) => i.conviteId)).size} fornecedores · ${moeda(previa.totalResultado)}`)}</b>
            <small>{previa.semVencedor ? "Reabra o recebimento, avalie os itens ou cancele a cotação." : fraseEconomia(previa)}</small>
          </div>

          {s.propostas.length < 3 && <div className="aviso aviso-info"><CircleAlert /><span>{s.propostas.length === 1 ? "Uma proposta recebida" : "Duas propostas recebidas"}. A homologação exige justificativa.</span></div>}
          {s.mapa.discrepantes > 0 && <div className="aviso aviso-info"><CircleAlert /><span>{s.mapa.discrepantes === 1 ? "Um preço fora do padrão" : `${s.mapa.discrepantes} preços fora do padrão`}. Confira no <Link href={`/cotacoes/${id}/comparativo`} className="botao-texto">comparativo</Link> antes de homologar.</span></div>}

          <section className="surgir">
            <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Classificação</h2>
            <div className="tabela-caixa"><Classificacao a={previa} /></div>
            <Regra a={previa} />
          </section>

          <section className="surgir">
            <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Resultado por item</h2>
            <div className="tabela-caixa"><ItensApurados a={previa} /></div>
          </section>

          <div className="cot-duas">
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Avaliação técnica dos itens</h2>
              <p className="cartao-sub">Retira um preço da disputa. A justificativa fica no relatório.</p>
              {s.avaliacoes.length > 0 && (
                <ul className="lista-simples" style={{ marginBottom: 14 }}>
                  {previa.desconsiderados.map((d) => (
                    <li key={`${d.conviteId}|${d.materialId}`} style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <b>{d.fornecedor}</b> · {d.descricao}{d.preco && <span className="num"> · R$ {valor(d.preco)}</span>}
                        <div className="fraco">{d.tipo === "nao_atende" ? "Não atende à especificação" : "Preço desconsiderado"}: {d.justificativa}</div>
                      </div>
                      {s.podeApurar && (
                        <FormAcao acao={acaoRemoverAvaliacao.bind(null, id, d.conviteId, d.materialId)} mostrarOk={false}>
                          <BotaoEnviar className="botao botao-texto" enviando="…" ariaLabel="Remover avaliação" title="Remover avaliação"><X /></BotaoEnviar>
                        </FormAcao>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {s.podeApurar ? (
                <FormAcao acao={acaoAvaliar.bind(null, id)} className="cot-avaliar" style={{ marginTop: 12 }} limpar mostrarOk={false}>
                  <div className="campo" style={{ gridColumn: "span 12" }}>
                    <label htmlFor="oferta">Preço</label>
                    <select id="oferta" name="oferta" className="entrada-texto" required defaultValue=""><option value="" disabled>Escolha o fornecedor e o item</option>{ofertas.map((o) => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}</select>
                  </div>
                  <div className="campo" style={{ gridColumn: "span 5" }}>
                    <label htmlFor="tipo">Motivo</label>
                    <select id="tipo" name="tipo" className="entrada-texto" defaultValue="nao_atende"><option value="nao_atende">Não atende à especificação</option><option value="desconsiderado">Preço desconsiderado</option></select>
                  </div>
                  <div className="campo" style={{ gridColumn: "span 7" }}><label htmlFor="av-just">Justificativa</label><input id="av-just" name="justificativa" className="entrada-texto" required minLength={10} maxLength={500} /></div>
                  <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end" }}><BotaoEnviar className="botao botao-neutro" enviando="Registrando…">Registrar avaliação</BotaoEnviar></div>
                </FormAcao>
              ) : s.avaliacoes.length === 0 && <p className="fraco" style={{ marginTop: 12 }}>Nenhuma avaliação registrada.</p>}
            </section>

            <section className="cartao surgir">
              <h2 className="cartao-titulo">Homologação</h2>
              {s.podeHomologar ? (
                <FormAcao acao={acaoHomologar.bind(null, id)} confirmar="Homologar a apuração? O resultado fica registrado e não pode ser alterado.">
                  {s.criterio !== "item" && completas.length > 1 && (
                    <div className="campo" style={{ marginTop: 12 }}>
                      <label htmlFor="escolhido">Fornecedor homologado</label>
                      <select id="escolhido" name="escolhido" className="entrada-texto" defaultValue={previa.vencedor?.conviteId ?? ""}>
                        {previa.classificacao.filter((c) => completas.some((f) => f.conviteId === c.conviteId)).map((c) => <option key={c.conviteId} value={c.conviteId}>{c.posicao}º · {c.fornecedor} · {moeda(c.total)}</option>)}
                      </select>
                      <span className="dica">Escolher outro que não o primeiro classificado exige justificativa.</span>
                    </div>
                  )}
                  <div className="campo" style={{ marginTop: 12 }}>
                    <label htmlFor="ho-just">Justificativa{exigeJustificativa ? "" : " (opcional)"}</label>
                    <textarea id="ho-just" name="justificativa" className="entrada-texto" rows={3} maxLength={1000} required={exigeJustificativa} minLength={exigeJustificativa ? 10 : undefined} />
                  </div>
                  <div className="rodape-form"><BotaoEnviar enviando="Homologando…"><Stamp /> Homologar apuração</BotaoEnviar></div>
                </FormAcao>
              ) : <p className="fraco" style={{ marginTop: 12 }}>A homologação cabe à direção ou ao gestor do contrato.</p>}
            </section>
          </div>
        </>
      )}

      {s.apuracoes.map((ap, i) => (
        <details key={ap.id} className="cartao surgir" open={i === 0 && s.situacao !== "encerrada"}>
          <summary style={{ cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <b className="cartao-titulo" style={{ margin: 0 }}>Apuração nº {ap.numero}{i > 0 || s.situacao === "encerrada" ? " (substituída)" : ""}</b>
            <span className="fraco">{ROTULO_CRITERIO_APURACAO[ap.criterio]} · {moeda(ap.totalResultado)} · {ap.homologadaPor ?? "—"} em {dataHoraCurta(ap.homologadaEm)}</span>
          </summary>
          <div className="grade" style={{ marginTop: 16 }}>
            {i === 0 && s.situacao === "apurada" && (
              <div className="cot-resultado">
                <span>Resultado homologado</span>
                <b>{ap.resultado.vencedor ? ap.resultado.vencedor.fornecedor : `${new Set(ap.resultado.itens.filter((x) => x.conviteId).map((x) => x.conviteId)).size} fornecedores`} · {moeda(ap.totalResultado)}</b>
                <small>{fraseEconomia(ap.resultado)}</small>
              </div>
            )}
            {ap.justificativa && <div><b style={{ fontSize: 13 }}>Justificativa</b><p className="cot-justificativa">{ap.justificativa}</p></div>}
            <div className="tabela-caixa"><Classificacao a={ap.resultado} /></div>
            <Regra a={ap.resultado} />
            <div className="tabela-caixa"><ItensApurados a={ap.resultado} /></div>
            {ap.resultado.desconsiderados.length > 0 && (
              <ul className="lista-simples">{ap.resultado.desconsiderados.map((d) => (
                <li key={`${d.conviteId}|${d.materialId}`}><b>{d.fornecedor}</b> · {d.descricao} · {d.tipo === "nao_atende" ? "não atende à especificação" : "preço desconsiderado"}: {d.justificativa}</li>
              ))}</ul>
            )}
            <div className="barra-acoes">
              <span className="fraco num" style={{ fontSize: 12 }}>Código de conferência {ap.codigo.slice(0, 16).toUpperCase()}</span>
              {i === 0 && <Link href={`/cotacoes/${id}/relatorio`} className="botao botao-neutro botao-pequeno" style={{ marginLeft: "auto" }}><FileText /> Relatório</Link>}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

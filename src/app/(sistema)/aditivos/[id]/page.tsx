import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CircleAlert, FileSignature, FileSpreadsheet, FileText, Plus, Save, Trash2 } from "lucide-react";
import { EtiquetaAditivo } from "@/componentes/Etiquetas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, moeda, paraCampo, percentual, quantidade } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { FUNDAMENTOS, obterAditivo, rotuloAditivo } from "@/servicos/aditivos";
import { ROTULO_EXECUTOR, rotuloContrato, type Executor } from "@/servicos/contratos";
import { ROTULO_FONTE, type Fonte } from "@/servicos/precos";
import { acaoAssinarAditivo, acaoCancelarAditivo, acaoIncluirItem, acaoRemoverItem, acaoSalvarAditivo } from "../acoes";

export const metadata: Metadata = { title: "Termo aditivo" };

const sinal = (v: string | number) => {
  const n = Number(v);
  return n > 0 ? "variacao-pos" : n < 0 ? "variacao-neg" : "";
};

export default async function FichaAditivo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let d;
  try {
    d = await obterAditivo(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const k = d.contrato;
  const editar = d.podeEditar;
  const novos = d.linhas.filter((l) => l.novo);
  const alterados = d.linhas.filter((l) => Number(l.variacao) !== 0);

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/contratos">Contratos</Link><span>/</span>
            <Link href={`/obras/${k.obraId}`} className="num">{k.obraCodigo}</Link><span>/</span>
            <Link href={`/contratos/${k.id}#aditivos`}>{rotuloContrato(k)}</Link>
          </div>
          <h1 className="titulo">{rotuloAditivo(d)}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <EtiquetaAditivo situacao={d.situacao} />
            <span>{d.objeto}</span>
            <span>· {k.empresaNome ?? "Equipe própria"}</span>
          </p>
        </div>
        <div className="barra-acoes">
          <Link href={`/aditivos/${id}/termo`} className="botao botao-neutro"><FileText /> Termo</Link>
          <a href={`/aditivos/${id}/excel`} className="botao botao-neutro"><FileSpreadsheet /> Planilha Excel</a>
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Acréscimos</span><b className="num">{moeda(d.acrescimo)}</b>
          <small className="num">{percentual(d.acrescimoPct, 2)} nesta · {percentual(d.acrescimoAcumuladoPct, 2)} de {d.limiteAcrescimoPct}% no acumulado</small></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Supressões</span><b className="num">{moeda(d.supressao)}</b>
          <small className="num">{percentual(d.supressaoPct, 2)} nesta · {percentual(d.supressaoAcumuladoPct, 2)} de 25% no acumulado</small></div>
        <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Prazo de execução</span>
          <b className="num">{d.prazoNovo != null ? `${d.prazoNovo} dias` : "—"}</b>
          <small className="num">{d.prazoDias > 0 ? `+${d.prazoDias} dias · até ${dataCurta(d.fimExecucaoNovo)}` : "Sem alteração de prazo"}</small></div>
        <div className="indicador indicador-destaque surgir" style={{ "--i": 3 } as React.CSSProperties}><span>Valor do contrato</span><b className="num">{moeda(d.valorNovo)}</b>
          <small className="num">Antes {moeda(d.valorAnterior)} · {Number(d.liquido) >= 0 ? "+" : "−"}{moeda(Math.abs(Number(d.liquido)))}</small></div>
      </div>

      <div className="grade">
        {d.pendencias.length > 0 && <div className="aviso aviso-info surgir"><CircleAlert /><span>Para assinar: {d.pendencias.join(" ")}</span></div>}
        {d.situacao === "cancelado" && <div className="aviso aviso-info surgir"><Ban /><span>Cancelado: {d.canceladoMotivo}</span></div>}

        <FormAcao acao={acaoSalvarAditivo.bind(null, id, k.id)} className="grade">
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Termo</h2>
            {editar ? (
              <div className="grade-form" style={{ marginTop: 14 }}>
                <div className="campo c6"><label htmlFor="objeto">Objeto</label><input id="objeto" name="objeto" className="entrada-texto" required defaultValue={d.objeto} /></div>
                <div className="campo c6"><label htmlFor="fundamento">Fundamento legal</label>
                  <input id="fundamento" name="fundamento" className="entrada-texto" list="fundamentos" defaultValue={d.fundamento ?? ""} />
                  <datalist id="fundamentos">{FUNDAMENTOS.map((f) => <option key={f} value={f} />)}</datalist>
                </div>
                <div className="campo c12"><label htmlFor="justificativa">Justificativa técnica</label><textarea id="justificativa" name="justificativa" className="entrada-texto" rows={3} required defaultValue={d.justificativa} /></div>
                <div className="campo c3"><label htmlFor="prazoDias">Acréscimo de prazo (dias)</label><input id="prazoDias" name="prazoDias" type="number" min={0} className="entrada-texto num" defaultValue={d.prazoDias} /></div>
                <div className="campo c3"><label htmlFor="novaVigencia">Nova vigência</label><input id="novaVigencia" name="novaVigencia" type="date" className="entrada-texto" defaultValue={d.novaVigencia ?? ""} /></div>
                <div className="campo c6"><label>Vigência atual</label><p className="num" style={{ margin: "10px 0 0" }}>{dataCurta(d.vigenciaAnterior)} · execução até {dataCurta(d.fimExecucaoAnterior)}</p></div>
              </div>
            ) : (
              <dl className="dados" style={{ marginTop: 14 }}>
                <div><dt>Objeto</dt><dd>{d.objeto}</dd></div>
                <div><dt>Fundamento legal</dt><dd>{d.fundamento ?? "—"}</dd></div>
                <div style={{ gridColumn: "1 / -1" }}><dt>Justificativa técnica</dt><dd style={{ whiteSpace: "pre-wrap" }}>{d.justificativa}</dd></div>
                <div><dt>Prazo de execução</dt><dd className="num">{d.prazoAnterior} → {d.prazoNovo} dias{d.fimExecucaoNovo ? ` · até ${dataCurta(d.fimExecucaoNovo)}` : ""}</dd></div>
                <div><dt>Vigência</dt><dd className="num">{dataCurta(d.vigenciaAnterior)}{d.novaVigencia ? ` → ${dataCurta(d.novaVigencia)}` : " (sem alteração)"}</dd></div>
                {d.dataAssinatura && <div><dt>Assinatura</dt><dd className="num">{dataCurta(d.dataAssinatura)}{d.assinadoPorNome ? ` · registrado por ${d.assinadoPorNome}` : ""}{d.assinadoEm ? ` em ${dataHora(d.assinadoEm)}` : ""}</dd></div>}
              </dl>
            )}
          </section>

          <section className="surgir" style={{ minWidth: 0 }}>
            <div className="barra-acoes" style={{ marginBottom: 10 }}>
              <h2 className="cartao-titulo">Planilha do aditivo</h2>
              <span className="cartao-sub" style={{ marginLeft: "auto" }}>
                {editar ? "Informe a variação: positiva acresce, negativa suprime." : `${alterados.length} ${alterados.length === 1 ? "item alterado" : "itens alterados"}`}
              </span>
            </div>
            <div className="tabela-caixa">
              <table className="tabela tabela-compacta tabela-aditivo">
                <thead>
                  <tr><th>Item</th><th>Descrição</th><th>Und.</th><th className="dir">Preço unit.</th><th className="dir">Quant. atual</th><th className="dir">Medido</th>
                    <th className="dir">Variação</th><th className="dir">Nova quant.</th><th className="dir">Valor da variação</th><th className="dir">Novo total</th></tr>
                </thead>
                <tbody>
                  {d.etapas.map((e) => (
                    <EtapaAditivo key={e.nome} nome={e.nome} valor={e.valorVariacao}>
                      {e.linhas.map((l) => {
                        const tem = Number(l.variacao) !== 0;
                        if (!editar && !tem) return null;
                        return (
                          <tr key={l.itemServicoId} className={tem || editar ? "" : "linha-apagada"}>
                            <td className="num">{l.numero}{l.novo && <><br /><span className="etiqueta et-azul etiqueta-mini">Novo</span></>}</td>
                            <td><span className="boletim-descricao" title={l.descricao}>{l.descricao}</span></td>
                            <td>{l.unidade}</td>
                            <td className="dir num">{moeda(l.precoUnitario)}</td>
                            <td className="dir num">{quantidade(l.anterior)}</td>
                            <td className="dir num">{Number(l.medido) ? quantidade(l.medido) : "—"}</td>
                            <td className="dir num">
                              {editar ? (
                                <>
                                  <input type="hidden" name="item" value={l.itemServicoId} />
                                  <input name={`v_${l.itemServicoId}`} className="entrada-texto entrada-qtd num" inputMode="decimal" defaultValue={tem ? paraCampo(l.variacao) : ""}
                                    aria-label={`Variação do item ${l.numero}`} />
                                </>
                              ) : <b className={sinal(l.variacao)}>{Number(l.variacao) > 0 ? "+" : ""}{quantidade(l.variacao)}</b>}
                            </td>
                            <td className="dir num">{quantidade(l.nova)}</td>
                            <td className={`dir num forte ${sinal(l.valorVariacao)}`}>{tem ? moeda(l.valorVariacao) : "—"}</td>
                            <td className="dir num">{moeda(l.valorNovo)}</td>
                          </tr>
                        );
                      })}
                    </EtapaAditivo>
                  ))}
                  <tr className="linha-total"><td colSpan={8}>Acréscimos</td><td className="dir num">{moeda(d.acrescimo)}</td><td /></tr>
                  <tr className="linha-total"><td colSpan={8}>Supressões</td><td className="dir num">{Number(d.supressao) ? "−" : ""}{moeda(d.supressao)}</td><td /></tr>
                  <tr className="linha-total"><td colSpan={8}>Valor do contrato após o aditivo</td><td className="dir num">{Number(d.liquido) >= 0 ? "+" : ""}{moeda(d.liquido)}</td><td className="dir num">{moeda(d.valorNovo)}</td></tr>
                </tbody>
              </table>
            </div>
            {editar && <div className="rodape-form" style={{ marginTop: 12 }}><BotaoEnviar enviando="Salvando…"><Save /> Salvar aditivo</BotaoEnviar></div>}
          </section>
        </FormAcao>

        <div className="medicao-cartoes">
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Limites legais</h2>
            <p className="cartao-sub" style={{ marginTop: 6 }}>Lei 14.133/2021, art. 125. Acréscimos e supressões são somados separadamente.</p>
            <dl className="dados" style={{ marginTop: 12 }}>
              <div><dt>Valor inicial atualizado</dt><dd className="num">{moeda(d.base)}</dd></div>
              <div><dt>Limite de acréscimo ({d.limiteAcrescimoPct}%)</dt><dd className="num">{moeda(d.limiteAcrescimo)}</dd></div>
              <div><dt>Acréscimos acumulados</dt><dd className="num">{moeda(d.acrescimoAcumulado)} · {percentual(d.acrescimoAcumuladoPct, 2)}</dd></div>
              <div><dt>Limite de supressão (25%)</dt><dd className="num">{moeda(d.limiteSupressao)}</dd></div>
              <div><dt>Supressões acumuladas</dt><dd className="num">{moeda(d.supressaoAcumulado)} · {percentual(d.supressaoAcumuladoPct, 2)}</dd></div>
            </dl>
          </section>

          <section className="cartao surgir">
            <h2 className="cartao-titulo">Itens novos</h2>
            {novos.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhum serviço incluído.</p> : (
              <ul className="lista-simples lista-acoes" style={{ marginTop: 10 }}>
                {novos.map((l) => (
                  <li key={l.itemServicoId}>
                    <span><b className="num">{l.numero}</b> {l.descricao}<br /><span className="fraco num">{quantidade(l.variacao)} {l.unidade} × {moeda(l.precoUnitario)} · {ROTULO_FONTE[l.fonte]} · {ROTULO_EXECUTOR[l.executor]}</span></span>
                    {editar && <FormAcao acao={acaoRemoverItem.bind(null, id, k.id, l.itemServicoId)} mostrarOk={false}>
                      <BotaoEnviar className="botao botao-texto botao-pequeno" ariaLabel={`Remover item ${l.numero}`}><Trash2 /></BotaoEnviar></FormAcao>}
                  </li>
                ))}
              </ul>
            )}
            {editar && (
              <FormAcao acao={acaoIncluirItem.bind(null, id, k.id)} className="grade-form" style={{ marginTop: 14 }} limpar>
                <div className="campo c12"><label htmlFor="n-etapa">Etapa</label>
                  <select id="n-etapa" name="etapa" className="entrada-texto" defaultValue={d.etapasExistentes[0]}>
                    {d.etapasExistentes.map((e) => <option key={e} value={e}>{e}</option>)}
                    <option value="__nova">Nova etapa…</option>
                  </select>
                </div>
                <div className="campo c12"><label htmlFor="n-etapa-nova">Nome da nova etapa</label><input id="n-etapa-nova" name="etapaNova" className="entrada-texto" placeholder="Usado quando a etapa for nova" /></div>
                <div className="campo c12"><label htmlFor="n-desc">Descrição do serviço</label><input id="n-desc" name="descricao" className="entrada-texto" required /></div>
                <div className="campo c6"><label htmlFor="n-und">Unidade</label><input id="n-und" name="unidade" className="entrada-texto" required placeholder="m²" /></div>
                <div className="campo c6"><label htmlFor="n-qtd">Quantidade</label><input id="n-qtd" name="quantidade" className="entrada-texto num" inputMode="decimal" required /></div>
                <div className="campo c6"><label htmlFor="n-pu">Preço unitário</label><input id="n-pu" name="precoUnitario" className="entrada-texto num" inputMode="decimal" required /></div>
                <div className="campo c6"><label htmlFor="n-fonte">Fonte do preço</label>
                  <select id="n-fonte" name="fonte" className="entrada-texto" defaultValue="cotacao">
                    {(["sinapi", "sicro", "propria", "cotacao"] as Fonte[]).map((f) => <option key={f} value={f}>{ROTULO_FONTE[f]}</option>)}
                  </select>
                </div>
                <div className="campo c6"><label htmlFor="n-cod">Código</label><input id="n-cod" name="codigo" className="entrada-texto num" /></div>
                <div className="campo c6"><label htmlFor="n-exec">Executor</label>
                  <select id="n-exec" name="executor" className="entrada-texto" defaultValue={k.regime === "direta" ? "equipe_propria" : "contratada"} disabled={k.regime === "direta"}>
                    {(Object.keys(ROTULO_EXECUTOR) as Executor[]).map((x) => <option key={x} value={x}>{ROTULO_EXECUTOR[x]}</option>)}
                  </select>
                </div>
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Incluindo…"><Plus /> Incluir serviço</BotaoEnviar></div>
              </FormAcao>
            )}
          </section>

          {(d.podeAssinar || editar) && (
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Assinatura</h2>
              {d.podeAssinar && (
                <FormAcao acao={acaoAssinarAditivo.bind(null, id, k.id)} className="grade-form" style={{ marginTop: 12 }}
                  confirmar="Registrar a assinatura do aditivo? Depois disso, ele não pode ser alterado." mostrarOk={false}>
                  <div className="campo c12"><label htmlFor="dataAssinatura">Data de assinatura</label><input id="dataAssinatura" name="dataAssinatura" type="date" className="entrada-texto" required defaultValue={d.hoje} max={d.hoje} /></div>
                  <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><FileSignature /> Registrar assinatura</BotaoEnviar></div>
                </FormAcao>
              )}
              <details className="detalhe-acao" style={{ marginTop: 14 }}>
                <summary>Cancelar aditivo</summary>
                <FormAcao acao={acaoCancelarAditivo.bind(null, id, k.id)} className="form-linha" style={{ marginTop: 10 }} mostrarOk={false}>
                  <input name="motivo" className="entrada-texto" required placeholder="Motivo" aria-label="Motivo do cancelamento" style={{ flex: 1, minWidth: 180 }} />
                  <BotaoEnviar className="botao botao-neutro" enviando="Cancelando…"><Ban /> Cancelar</BotaoEnviar>
                </FormAcao>
              </details>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function EtapaAditivo({ nome, valor, children }: { nome: string; valor: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="linha-grupo"><td colSpan={8}>{nome}</td><td className="dir num">{Number(valor) ? moeda(valor) : ""}</td><td /></tr>
      {children}
    </>
  );
}

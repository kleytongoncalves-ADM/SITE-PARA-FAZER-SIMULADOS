import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, CircleAlert, FileSpreadsheet, FileSignature, Plus, Ruler, Save, TriangleAlert } from "lucide-react";
import { EtiquetaContrato } from "@/componentes/Etiquetas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, moeda, percentual, quantidade } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  formatarCnpj, listarEmpresas, obterContrato, pessoasDesignaveis, ROTULO_EXECUTOR, ROTULO_MODALIDADE, ROTULO_NATUREZA,
  ROTULO_REGIME_EXECUCAO, rotuloContrato, type Executor, type Modalidade,
} from "@/servicos/contratos";
import { pode } from "@/servicos/permissoes";
import { ROTULO_FONTE } from "@/servicos/precos";
import { ROTULO_PERFIL, type Perfil } from "@/servicos/rotulos";
import { acaoAssinar, acaoDesignar, acaoExecutor, acaoGarantia, acaoSalvarContrato } from "../acoes";
import { CamposContrato } from "../CamposContrato";
import { alteracoesDoContrato } from "@/servicos/aditivos";
import { Alteracoes } from "./Alteracoes";

export const metadata: Metadata = { title: "Contrato" };

export default async function FichaContrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let k;
  try {
    k = await obterContrato(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const editar = pode(ator, "contrato.editar");
  const rascunho = k.situacao === "rascunho";
  const [empresas, pessoas] = editar ? await Promise.all([listarEmpresas(ator), pessoasDesignaveis(ator)]) : [[], []];
  const alteracoes = rascunho ? null : await alteracoesDoContrato(ator, id);
  const aditivado = Number(k.acrescimos) !== 0 || Number(k.supressoes) !== 0;
  const reajustado = Number(k.valorAtual) !== Number(k.valorContratual);
  const prazoAditivo = k.prazoInicialDias != null && k.prazoExecucaoDias != null ? k.prazoExecucaoDias - k.prazoInicialDias : 0;

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/contratos">Contratos</Link><span>/</span>
            <Link href={`/obras/${k.obraId}`} className="num">{k.obraCodigo}</Link>
          </div>
          <h1 className="titulo">{rotuloContrato(k)}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <EtiquetaContrato situacao={k.situacao} />
            <span>{k.objeto}</span>
            <span>· {k.empresaNome ?? "Equipe própria"} · {ROTULO_REGIME_EXECUCAO[k.regime]}</span>
          </p>
        </div>
        <div className="barra-acoes">
          <a href={`/contratos/${id}/excel`} className="botao botao-neutro"><FileSpreadsheet /> Planilha Excel</a>
          <Link href={`/obras/${k.obraId}/cronograma`} className="botao botao-neutro"><CalendarRange /> Cronograma</Link>
          {k.situacao !== "rascunho" && pode(ator, "medicao.ver") && <Link href={`/obras/${k.obraId}/medicoes`} className="botao botao-neutro"><Ruler /> Medições</Link>}
          {rascunho && pode(ator, "contrato.assinar") && (
            <FormAcao acao={acaoAssinar.bind(null, id)} confirmar="Assinar o contrato? Depois de assinado, ele só muda por aditivo ou apostilamento." mostrarOk={false}>
              <BotaoEnviar enviando="Assinando…"><FileSignature /> Assinar contrato</BotaoEnviar>
            </FormAcao>
          )}
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Valor inicial</span><b className="num">{moeda(k.valorInicial)}</b>
          {Number(k.desconto) > 0 && <small className="num">Desconto de {percentual(k.desconto)} sobre {moeda(k.valorOrcado)}</small>}</div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Valor atual</span><b className="num">{moeda(k.valorAtual)}</b>
          {(aditivado || reajustado) && <small className="num">
            {aditivado ? `Aditivos ${Number(k.acrescimos) - Number(k.supressoes) >= 0 ? "+" : "−"}${moeda(Math.abs(Number(k.acrescimos) - Number(k.supressoes)))}` : ""}
            {aditivado && reajustado ? " · " : ""}
            {reajustado ? `reajuste ${moeda(Number(k.valorAtual) - Number(k.valorContratual))}` : ""}
          </small>}</div>
        <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Medido</span><b className="num">{moeda(k.medido)}</b>
          <small className="num">{percentual(k.executadoPct, 1)} do contrato{k.regime !== "direta" ? ` · pago ${moeda(k.pago)}` : ""}</small></div>
        <div className="indicador indicador-destaque surgir" style={{ "--i": 3 } as React.CSSProperties}><span>Saldo</span><b className="num">{moeda(k.saldo)}</b></div>
      </div>

      <div className="grade">
        {k.pendencias.length > 0 && (
          <div className="aviso aviso-info surgir"><CircleAlert /><span>Para assinar: {k.pendencias.join(" ")}</span></div>
        )}
        {k.alertas.map((a) => (
          <div key={a.texto} className={`aviso ${a.nivel === "alto" ? "aviso-erro" : "aviso-info"} surgir`}><TriangleAlert /><span>{a.texto}</span></div>
        ))}

        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Prazos</h2>
            <dl className="dados" style={{ marginTop: 14 }}>
              <div><dt>Assinatura</dt><dd className="num">{dataCurta(k.dataAssinatura)}</dd></div>
              <div><dt>Ordem de serviço</dt><dd className="num">{dataCurta(k.dataOrdemServico)}</dd></div>
              <div><dt>Prazo de execução</dt><dd className="num">{k.prazoExecucaoDias ? `${k.prazoExecucaoDias} dias` : "—"}{prazoAditivo > 0 && <span className="fraco"> ({k.prazoInicialDias} + {prazoAditivo} por aditivo)</span>}</dd></div>
              <div><dt>Fim da execução</dt><dd className="num">{dataCurta(k.fimExecucao)}</dd></div>
              <div><dt>Fim da vigência</dt><dd className="num">{dataCurta(k.vigenciaFim)}{k.vigenciaInicial && k.vigenciaFim !== k.vigenciaInicial && <span className="fraco"> (inicial {dataCurta(k.vigenciaInicial)})</span>}</dd></div>
              <div><dt>Reajuste</dt><dd className="num">{k.regime === "direta" ? "Sem reajuste" : alteracoes?.proximoReajuste ? `${k.indiceReajuste ?? "Índice a definir"} a partir de ${dataCurta(alteracoes.proximoReajuste)}` : k.dataBase ? `${k.indiceReajuste ?? "Índice a definir"} · data-base ${dataCurta(k.dataBase)}` : "Sem reajuste"}</dd></div>
            </dl>
          </section>
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Partes e limites</h2>
            <dl className="dados" style={{ marginTop: 14 }}>
              <div><dt>Contratada</dt><dd>{k.empresaNome ? <>{k.empresaNome}<br /><span className="fraco num">{formatarCnpj(k.empresaCnpj!)}</span></> : "Equipe própria"}</dd></div>
              <div><dt>Processo</dt><dd>{k.processo ?? "—"}</dd></div>
              <div><dt>Gestor do contrato</dt><dd>{k.gestorNome ?? "A designar"}</dd></div>
              <div><dt>Fiscal</dt><dd>{k.fiscalNome ?? "A designar"}</dd></div>
              <div><dt>Limite de acréscimo</dt><dd className="num">{k.limiteAditivo}% · {moeda(k.limiteAditivoValor)}{alteracoes && alteracoes.acrescimoPct > 0 && <span className="fraco"> ({percentual(alteracoes.acrescimoPct, 1)} usado)</span>}</dd></div>
              <div><dt>Natureza</dt><dd>{ROTULO_NATUREZA[k.natureza]}</dd></div>
              <div><dt>Orçamento de origem</dt><dd><Link href={`/orcamentos/${k.orcamentoId}/nota`} className="num">{k.orcamentoRotulo}</Link> · {k.orcamentoNome}</dd></div>
              {k.assinadoEm && <div><dt>Assinado no sistema</dt><dd>{k.assinadoPor} · <span className="num">{dataHora(k.assinadoEm)}</span></dd></div>}
            </dl>
            {!rascunho && editar && k.situacao === "vigente" && (
              <FormAcao acao={acaoDesignar.bind(null, id)} className="form-linha" style={{ marginTop: 16 }}>
                <select name="gestorId" className="entrada-texto" defaultValue={k.gestorId ?? ""} aria-label="Gestor do contrato" style={{ flex: 1, minWidth: 160 }}>
                  <option value="">Gestor a designar</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} · {ROTULO_PERFIL[p.perfil as Perfil]}</option>)}
                </select>
                <select name="fiscalId" className="entrada-texto" defaultValue={k.fiscalId ?? ""} aria-label="Fiscal" style={{ flex: 1, minWidth: 160 }}>
                  <option value="">Fiscal a designar</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} · {ROTULO_PERFIL[p.perfil as Perfil]}</option>)}
                </select>
                <BotaoEnviar className="botao botao-neutro" enviando="Salvando…"><Save /> Salvar designação</BotaoEnviar>
              </FormAcao>
            )}
          </section>
        </div>

        {rascunho && editar && (
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Dados do contrato</h2>
            <FormAcao acao={acaoSalvarContrato.bind(null, id)} className="grade-form" style={{ marginTop: 14 }}>
              <CamposContrato k={k} empresas={empresas} pessoas={pessoas} />
              <div className="c12 rodape-form"><BotaoEnviar enviando="Salvando…"><Save /> Salvar</BotaoEnviar></div>
            </FormAcao>
          </section>
        )}

        <section className="surgir">
          <div className="barra-acoes" style={{ marginBottom: 10 }}>
            <h2 className="cartao-titulo">Planilha contratual</h2>
            <span className="cartao-sub" style={{ marginLeft: "auto" }}>{k.itens.length} itens · {moeda(k.valorContratual)}{aditivado ? " com aditivos" : ""}</span>
          </div>
          <div className="tabela-caixa">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Item</th><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Preço unit.</th><th className="dir">Total</th><th>Executor</th></tr></thead>
              <tbody>
                {k.etapas.map((e) => (
                  <EtapaPlanilha key={e.nome} nome={e.nome} total={e.total}>
                    {e.itens.map((i) => (
                      <tr key={i.id}>
                        <td className="num">{i.numero}{(i.incluidoPorAditivo || i.alteradoPorAditivo) && <><br /><span className="etiqueta et-azul etiqueta-mini">{i.incluidoPorAditivo ? "Incluído" : "Aditivado"}</span></>}</td>
                        <td className="num">{i.codigo ?? "—"}<br /><span className="fraco">{ROTULO_FONTE[i.fonte]}</span></td>
                        <td>{i.descricao}</td>
                        <td>{i.unidade}</td>
                        <td className="dir num">{quantidade(i.quantidade)}</td>
                        <td className="dir num">{moeda(i.precoUnitario)}</td>
                        <td className="dir num forte">{moeda(i.total)}</td>
                        <td>
                          {rascunho && editar && k.regime !== "direta" ? (
                            <FormAcao acao={acaoExecutor.bind(null, id, i.id)} className="form-linha" mostrarOk={false}>
                              <select name="executor" className="entrada-texto" defaultValue={i.executor} aria-label={`Executor do item ${i.numero}`} style={{ height: 32, fontSize: 12.5 }}>
                                {(Object.keys(ROTULO_EXECUTOR) as Executor[]).map((x) => <option key={x} value={x}>{ROTULO_EXECUTOR[x]}</option>)}
                              </select>
                              <BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="…" ariaLabel={`Salvar executor do item ${i.numero}`}><Save /></BotaoEnviar>
                            </FormAcao>
                          ) : ROTULO_EXECUTOR[i.executor]}
                        </td>
                      </tr>
                    ))}
                  </EtapaPlanilha>
                ))}
                <tr className="linha-total"><td colSpan={6}>{aditivado ? "Valor do contrato com aditivos" : "Valor do contrato"}</td><td className="dir num">{moeda(k.valorContratual)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        </section>

        {alteracoes && <Alteracoes d={alteracoes} />}

        <section className="cartao surgir">
          <h2 className="cartao-titulo">Garantias</h2>
          {k.garantias.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhuma garantia registrada.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 12 }}>
              <table className="tabela tabela-compacta">
                <thead><tr><th>Modalidade</th><th>Instituição</th><th>Documento</th><th>Início</th><th>Vencimento</th><th className="dir">Valor</th></tr></thead>
                <tbody>
                  {k.garantias.map((g) => (
                    <tr key={g.id}>
                      <td>{ROTULO_MODALIDADE[g.modalidade]}</td><td>{g.instituicao ?? "—"}</td><td>{g.documento ?? "—"}</td>
                      <td className="num">{dataCurta(g.inicio)}</td><td className="num">{dataCurta(g.vencimento)}</td><td className="dir num">{moeda(g.valor)}</td>
                    </tr>
                  ))}
                  <tr className="linha-total"><td colSpan={5}>Total ({percentual(k.garantiaPct)} do contrato)</td><td className="dir num">{moeda(k.garantiaTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {editar && (k.situacao === "rascunho" || k.situacao === "vigente") && (
            <FormAcao acao={acaoGarantia.bind(null, id)} className="grade-form" style={{ marginTop: 16 }} limpar>
              <div className="campo c3"><label htmlFor="modalidade">Modalidade</label>
                <select id="modalidade" name="modalidade" className="entrada-texto" defaultValue="seguro_garantia">
                  {(Object.keys(ROTULO_MODALIDADE) as Modalidade[]).map((m) => <option key={m} value={m}>{ROTULO_MODALIDADE[m]}</option>)}
                </select>
              </div>
              <div className="campo c3"><label htmlFor="valor">Valor (R$)</label><input id="valor" name="valor" className="entrada-texto num" inputMode="decimal" required placeholder={(Number(k.valorInicial) * 0.05).toFixed(2).replace(".", ",")} /></div>
              <div className="campo c3"><label htmlFor="inicio">Início</label><input id="inicio" name="inicio" type="date" className="entrada-texto" required defaultValue={k.dataAssinatura ?? ""} /></div>
              <div className="campo c3"><label htmlFor="vencimento">Vencimento</label><input id="vencimento" name="vencimento" type="date" className="entrada-texto" required defaultValue={k.vigenciaFim ?? ""} /></div>
              <div className="campo c6"><label htmlFor="instituicao">Seguradora ou banco</label><input id="instituicao" name="instituicao" className="entrada-texto" /></div>
              <div className="campo c6"><label htmlFor="documento">Apólice ou documento</label><input id="documento" name="documento" className="entrada-texto" /></div>
              <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><Plus /> Registrar garantia</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>
      </div>
    </>
  );
}

function EtapaPlanilha({ nome, total, children }: { nome: string; total: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="linha-grupo"><td colSpan={6}>{nome}</td><td className="dir num">{moeda(total)}</td><td /></tr>
      {children}
    </>
  );
}

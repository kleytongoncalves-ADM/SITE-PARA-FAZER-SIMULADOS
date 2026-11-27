import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, FileText, PenLine, Plus, ShieldCheck, Stamp, Trash2, Users } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { EnviarFoto, Galeria } from "@/componentes/Fotos";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import {
  CLIMAS, CONDICOES, FUNCOES_SUGERIDAS, MOTIVOS, obterDiario, ROTULO_CLIMA, ROTULO_CONDICAO, ROTULO_MOTIVO, ROTULO_OCORRENCIA_DIARIO,
} from "@/servicos/campo";
import { enviosDoDiario } from "@/servicos/diario-campo";
import { SemPermissao } from "@/servicos/permissoes";
import {
  acaoAdicionarLinha, acaoAssinarDiario, acaoComplementar, acaoExcluirFoto, acaoRemoverLinha, acaoRepetirAnterior, acaoTrazerEquipe, acaoSalvarDiario, acaoVistoDiario,
} from "../acoes";

export const metadata: Metadata = { title: "Diário de obra" };

const diaSemana = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

function Remover({ acao, rotulo }: { acao: () => Promise<{ erro?: string }>; rotulo: string }) {
  return (
    <FormAcao acao={acao} mostrarOk={false}>
      <BotaoEnviar className="botao botao-texto" ariaLabel={rotulo} title={rotulo}><Trash2 /></BotaoEnviar>
    </FormAcao>
  );
}

export default async function DiarioDoDia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = comoAtor(await exigirUsuario());
  let d;
  try {
    d = await obterDiario(a, id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const envios = await enviosDoDiario(a, id);
  const ed = d.podeEditar;
  const caminho = `/diario/${id}`;

  return (
    <div className="grade diario">
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/obras">Obras</Link><span>/</span><Link href={`/obras/${d.obra.id}/diario`} className="num">{d.obra.codigo}</Link><span>/</span><span>Diário</span>
          </div>
          <h1 className="titulo">Diário nº {d.numero} · <span className="num">{dataCurta(d.data)}</span></h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span className={`etiqueta ${d.situacao === "assinado" ? "et-verde" : "et-laranja"}`}>{d.situacao === "assinado" ? "Assinado" : "Em elaboração"}</span>
            {d.vistoEm && <span className="etiqueta et-azul">Visto do fiscal</span>}
            <span>{diaSemana(d.data).replace(/^./, (c) => c.toUpperCase())}</span><span>· {d.obra.nome}</span>
          </p>
        </div>
        <div className="barra-acoes">
          {d.anterior ? <Link href={`/diario/${d.anterior}`} className="botao botao-neutro botao-pequeno" aria-label="Diário anterior"><ChevronLeft /> Anterior</Link> : null}
          {d.proximo ? <Link href={`/diario/${d.proximo}`} className="botao botao-neutro botao-pequeno" aria-label="Próximo diário">Próximo <ChevronRight /></Link> : null}
          <Link href={`/obras/${d.obra.id}/diario/relatorio?de=${d.data}&ate=${d.data}`} className="botao botao-neutro botao-pequeno"><FileText /> PDF</Link>
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador"><span>Efetivo</span><b className="num">{d.totalEfetivo}</b><small>{d.totalEfetivo === 1 ? "pessoa" : "pessoas"}</small></div>
        <div className="indicador"><span>Equipamentos</span><b className="num">{d.equipamentos.reduce((s, e) => s + e.quantidade, 0)}</b></div>
        <div className="indicador"><span>Serviços</span><b className="num">{d.servicos.length}</b></div>
        <div className={`indicador${d.horasParadas ? " indicador-destaque" : ""}`}><span>Horas paradas</span><b className="num">{numero(d.horasParadas, 1)} h</b></div>
      </div>

      <div className="diario-colunas">
        <div className="grade">
          <section className="cartao">
            <h2 className="cartao-titulo">Condições do dia</h2>
            {ed ? (
              <FormAcao acao={acaoSalvarDiario.bind(null, id)} className="grade-form" style={{ marginTop: 12 }} mostrarOk={false}>
                <div className="campo c4"><label htmlFor="cm">Clima pela manhã</label>
                  <select id="cm" name="climaManha" className="entrada-texto" defaultValue={d.climaManha}>{CLIMAS.map((c) => <option key={c} value={c}>{ROTULO_CLIMA[c]}</option>)}</select></div>
                <div className="campo c4"><label htmlFor="ct">Clima à tarde</label>
                  <select id="ct" name="climaTarde" className="entrada-texto" defaultValue={d.climaTarde}>{CLIMAS.map((c) => <option key={c} value={c}>{ROTULO_CLIMA[c]}</option>)}</select></div>
                <div className="campo c4"><label htmlFor="cond">Condição de trabalho</label>
                  <select id="cond" name="condicao" className="entrada-texto" defaultValue={d.condicao}>{CONDICOES.map((c) => <option key={c} value={c}>{ROTULO_CONDICAO[c]}</option>)}</select></div>
                <div className="campo c12"><label htmlFor="rel">Relato do dia</label>
                  <textarea id="rel" name="relato" className="entrada-texto" rows={4} defaultValue={d.relato ?? ""} placeholder="Frentes de serviço, orientações dadas, entregas de material" /></div>
                <div className="c12 rodape-form"><BotaoEnviar enviando="Salvando…">Salvar</BotaoEnviar></div>
              </FormAcao>
            ) : (
              <>
                <dl className="lista-dados" style={{ marginTop: 10 }}>
                  <div><dt>Clima pela manhã</dt><dd>{ROTULO_CLIMA[d.climaManha]}</dd></div>
                  <div><dt>Clima à tarde</dt><dd>{ROTULO_CLIMA[d.climaTarde]}</dd></div>
                  <div><dt>Condição de trabalho</dt><dd>{ROTULO_CONDICAO[d.condicao]}</dd></div>
                </dl>
                {d.relato && <p className="texto-relato">{d.relato}</p>}
              </>
            )}
          </section>

          <section className="cartao">
            <div className="barra-acoes">
              <h2 className="cartao-titulo">Efetivo</h2>
              {ed && (!d.efetivo.length || !d.equipamentos.length) && (d.alocados > 0 || d.anterior) && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {d.alocados > 0 && (
                    <FormAcao acao={acaoTrazerEquipe.bind(null, id)} mostrarOk={false}>
                      <BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Trazendo…"><Users /> Trazer equipe alocada</BotaoEnviar>
                    </FormAcao>
                  )}
                  {d.anterior && (
                    <FormAcao acao={acaoRepetirAnterior.bind(null, id)} mostrarOk={false}>
                      <BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Copiando…"><Copy /> Repetir do dia anterior</BotaoEnviar>
                    </FormAcao>
                  )}
                </div>
              )}
            </div>
            {d.efetivo.length > 0 && (
              <table className="tabela tabela-compacta" style={{ marginTop: 8 }}>
                <thead><tr><th>Função</th><th>Empresa</th><th className="dir">Pessoas</th>{ed && <th />}</tr></thead>
                <tbody>
                  {d.efetivo.map((e) => (
                    <tr key={e.id}><td className="forte">{e.funcao}</td><td>{e.empresa ?? "—"}</td><td className="dir num">{e.quantidade}</td>
                      {ed && <td className="dir"><Remover acao={acaoRemoverLinha.bind(null, id, "efetivo", e.id)} rotulo={`Remover ${e.funcao}`} /></td>}</tr>
                  ))}
                  <tr className="linha-total"><td colSpan={2}>Total</td><td className="dir num">{d.totalEfetivo}</td>{ed && <td />}</tr>
                </tbody>
              </table>
            )}
            {ed && (
              <FormAcao acao={acaoAdicionarLinha.bind(null, id, "efetivo")} className="grade-form form-diario" mostrarOk={false} limpar>
                <div className="campo c5"><label htmlFor="ef-f">Função</label><input id="ef-f" name="funcao" list="funcoes" className="entrada-texto" required />
                  <datalist id="funcoes">{FUNCOES_SUGERIDAS.map((f) => <option key={f} value={f} />)}</datalist></div>
                <div className="campo c4"><label htmlFor="ef-e">Empresa</label><input id="ef-e" name="empresa" className="entrada-texto" defaultValue={d.efetivo.at(-1)?.empresa ?? ""} /></div>
                <div className="campo c3"><label htmlFor="ef-q">Pessoas</label><input id="ef-q" name="quantidade" type="number" min={1} className="entrada-texto num" defaultValue={1} required /></div>
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Incluindo…"><Plus /> Incluir</BotaoEnviar></div>
              </FormAcao>
            )}
            {!ed && !d.efetivo.length && <p className="cartao-sub">Sem efetivo registrado.</p>}
          </section>

          <section className="cartao">
            <h2 className="cartao-titulo">Equipamentos</h2>
            {d.equipamentos.length > 0 && (
              <table className="tabela tabela-compacta" style={{ marginTop: 8 }}>
                <thead><tr><th>Equipamento</th><th className="dir">Qtd.</th><th className="dir">Horas</th>{ed && <th />}</tr></thead>
                <tbody>
                  {d.equipamentos.map((e) => (
                    <tr key={e.id}><td className="forte">{e.descricao}</td><td className="dir num">{e.quantidade}</td><td className="dir num">{e.horas != null ? numero(e.horas, 1) : "—"}</td>
                      {ed && <td className="dir"><Remover acao={acaoRemoverLinha.bind(null, id, "equipamento", e.id)} rotulo={`Remover ${e.descricao}`} /></td>}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {ed && (
              <FormAcao acao={acaoAdicionarLinha.bind(null, id, "equipamento")} className="grade-form form-diario" mostrarOk={false} limpar>
                <div className="campo c6"><label htmlFor="eq-d">Equipamento</label><input id="eq-d" name="descricao" className="entrada-texto" required placeholder="Retroescavadeira" /></div>
                <div className="campo c3"><label htmlFor="eq-q">Qtd.</label><input id="eq-q" name="quantidade" type="number" min={1} className="entrada-texto num" defaultValue={1} /></div>
                <div className="campo c3"><label htmlFor="eq-h">Horas</label><input id="eq-h" name="horas" inputMode="decimal" className="entrada-texto num" /></div>
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Incluindo…"><Plus /> Incluir</BotaoEnviar></div>
              </FormAcao>
            )}
            {!ed && !d.equipamentos.length && <p className="cartao-sub">Sem equipamentos registrados.</p>}
          </section>
        </div>

        <div className="grade">
          <section className="cartao">
            <h2 className="cartao-titulo">Serviços executados</h2>
            {d.servicos.length > 0 && (
              <ul className="lista-diario">
                {d.servicos.map((s) => (
                  <li key={s.id}>
                    <div style={{ minWidth: 0 }}>
                      <b>{s.descricao}</b>
                      <span>{[s.local, s.atividadeCodigo && s.descricao.indexOf(s.atividadeCodigo) !== 0 ? `Atividade ${s.atividadeCodigo}` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                    {s.avancoPct != null && <span className="etiqueta et-azul num">{numero(s.avancoPct, 0)}% acumulado</span>}
                    {ed && <Remover acao={acaoRemoverLinha.bind(null, id, "servico", s.id)} rotulo="Remover serviço" />}
                  </li>
                ))}
              </ul>
            )}
            {ed && (
              <FormAcao acao={acaoAdicionarLinha.bind(null, id, "servico")} className="grade-form form-diario" mostrarOk={false} limpar>
                {d.atividades.length > 0 && (
                  <div className="campo c12"><label htmlFor="sv-a">Atividade do cronograma</label>
                    <select id="sv-a" name="atividadeId" className="entrada-texto" defaultValue="">
                      <option value="">Sem vínculo com o cronograma</option>
                      {d.atividades.map((x) => <option key={x.id} value={x.id}>{x.codigo} {x.nome} · {numero(x.avanco, 0)}%</option>)}
                    </select></div>
                )}
                <div className="campo c12"><label htmlFor="sv-d">Descrição</label><input id="sv-d" name="descricao" className="entrada-texto" placeholder={d.atividades.length ? "Em branco, usa o nome da atividade" : ""} required={!d.atividades.length} /></div>
                <div className="campo c8"><label htmlFor="sv-l">Local</label><input id="sv-l" name="local" className="entrada-texto" placeholder="Bloco, eixo, trecho" /></div>
                {d.atividades.length > 0 && <div className="campo c4"><label htmlFor="sv-p">Avanço acumulado (%)</label><input id="sv-p" name="avancoPct" inputMode="decimal" className="entrada-texto num" /></div>}
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Incluindo…"><Plus /> Incluir</BotaoEnviar></div>
              </FormAcao>
            )}
            {!ed && !d.servicos.length && <p className="cartao-sub">Sem serviços registrados.</p>}
          </section>

          <section className="cartao">
            <h2 className="cartao-titulo">Ocorrências, visitas e paralisações</h2>
            {d.ocorrencias.length > 0 && (
              <ul className="lista-diario">
                {d.ocorrencias.map((o) => (
                  <li key={o.id}>
                    <div style={{ minWidth: 0 }}>
                      <b>{ROTULO_OCORRENCIA_DIARIO[o.tipo]}{o.motivo ? ` · ${ROTULO_MOTIVO[o.motivo]}` : ""}{o.horas ? ` · ${numero(o.horas, 1)} h` : ""}</b>
                      <span>{o.descricao}</span>
                      {o.ocorrenciaSegurancaId && <Link href={`/seguranca/ocorrencias/${o.ocorrenciaSegurancaId}`} className="botao-texto" style={{ padding: 0 }}>Ver ocorrência de segurança</Link>}
                    </div>
                    <span className={`etiqueta ${o.tipo === "paralisacao" ? "et-vermelha" : o.tipo === "visita" ? "et-azul" : "et-neutra"}`}>{ROTULO_OCORRENCIA_DIARIO[o.tipo]}</span>
                    {ed && !o.ocorrenciaSegurancaId && <Remover acao={acaoRemoverLinha.bind(null, id, "ocorrencia", o.id)} rotulo="Remover registro" />}
                  </li>
                ))}
              </ul>
            )}
            {ed && (
              <FormAcao acao={acaoAdicionarLinha.bind(null, id, "ocorrencia")} className="grade-form form-diario" mostrarOk={false} limpar>
                <div className="campo c4"><label htmlFor="oc-t">Tipo</label>
                  <select id="oc-t" name="subtipo" className="entrada-texto" defaultValue="ocorrencia">
                    <option value="ocorrencia">Ocorrência</option><option value="visita">Visita</option><option value="paralisacao">Paralisação</option>
                  </select></div>
                <div className="campo c5"><label htmlFor="oc-m">Motivo da paralisação</label>
                  <select id="oc-m" name="motivo" className="entrada-texto" defaultValue=""><option value="">—</option>{MOTIVOS.map((m) => <option key={m} value={m}>{ROTULO_MOTIVO[m]}</option>)}</select></div>
                <div className="campo c3"><label htmlFor="oc-h">Horas paradas</label><input id="oc-h" name="horas" inputMode="decimal" className="entrada-texto num" /></div>
                <div className="campo c12"><label htmlFor="oc-d">Descrição</label><input id="oc-d" name="descricao" className="entrada-texto" required /></div>
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Incluindo…"><Plus /> Incluir</BotaoEnviar></div>
              </FormAcao>
            )}
            {!ed && !d.ocorrencias.length && <p className="cartao-sub">Sem ocorrências.</p>}
          </section>

          <section className="cartao">
            <h2 className="cartao-titulo">Fotos</h2>
            <Galeria fotos={d.fotos} excluir={ed ? acaoExcluirFoto.bind(null, id) : undefined} />
            {ed && <div style={{ marginTop: 12 }}><EnviarFoto obraId={d.obra.id} alvo={{ diarioId: id }} caminho={caminho} /></div>}
            {!ed && !d.fotos.length && <p className="cartao-sub">Sem fotos.</p>}
          </section>
        </div>
      </div>

      <section className="cartao">
        <h2 className="cartao-titulo">Assinaturas</h2>
        <div className="assinaturas-diario">
          <div>
            <span>Responsável técnico</span>
            {d.assinadoEm ? <b>{d.assinadoPor} · <span className="num">{dataHora(d.assinadoEm)}</span></b> : <b className="fraco">Pendente</b>}
          </div>
          <div>
            <span>Visto do fiscal</span>
            {d.vistoEm ? <b>{d.vistoPor} · <span className="num">{dataHora(d.vistoEm)}</span></b> : <b className="fraco">Pendente</b>}
            {d.vistoObservacao && <small>{d.vistoObservacao}</small>}
          </div>
        </div>
        {d.podeAssinar && (
          <FormAcao acao={acaoAssinarDiario.bind(null, id)} confirmar="Depois de assinado, o diário só recebe complementos. Assinar?" style={{ marginTop: 12 }}>
            <BotaoEnviar enviando="Assinando…"><PenLine /> Assinar diário</BotaoEnviar>
          </FormAcao>
        )}
        {d.podeVisto && (
          <FormAcao acao={acaoVistoDiario.bind(null, id)} className="form-linha" style={{ marginTop: 12 }}>
            <input name="observacao" className="entrada-texto" style={{ flex: 1, minWidth: 200 }} placeholder="Observação do fiscal (opcional)" aria-label="Observação do fiscal" />
            <BotaoEnviar enviando="Registrando…"><Stamp /> Dar visto</BotaoEnviar>
          </FormAcao>
        )}
        {envios.length > 0 && (
          <>
            <h3 className="subtitulo-secao">Lançado em campo sem internet</h3>
            <ul className="lista-diario">
              {envios.map((e, i) => (
                <li key={i}><div>
                  <b>{e.por} · {e.comoComplemento ? "complemento" : `${e.linhas} ${e.linhas === 1 ? "linha" : "linhas"}`}{e.assinou ? " · assinado no envio" : ""}</b>
                  <span className="num">Registrado no aparelho {dataHora(e.registradoEm)} · recebido {dataHora(e.recebidoEm)}</span>
                </div></li>
              ))}
            </ul>
          </>
        )}
        {(d.complementos.length > 0 || d.podeComplementar) && (
          <>
            <h3 className="subtitulo-secao">Complementos</h3>
            {d.complementos.length > 0 && (
              <ul className="lista-diario">
                {d.complementos.map((c) => <li key={c.id}><div><b style={{ whiteSpace: "pre-line" }}>{c.texto}</b><span className="num">{c.por} · {dataHora(c.em)}</span></div></li>)}
              </ul>
            )}
            {d.podeComplementar && (
              <FormAcao acao={acaoComplementar.bind(null, id)} className="form-linha" style={{ marginTop: 10 }} mostrarOk={false} limpar>
                <input name="texto" className="entrada-texto" style={{ flex: 1, minWidth: 200 }} required placeholder="Registro feito depois da assinatura" aria-label="Complemento" />
                <BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><ShieldCheck /> Registrar complemento</BotaoEnviar>
              </FormAcao>
            )}
          </>
        )}
      </section>
    </div>
  );
}

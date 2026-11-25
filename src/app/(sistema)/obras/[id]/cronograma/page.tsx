import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CopyPlus, FileSignature, FileSpreadsheet, Lock, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { CurvaSComparada } from "@/componentes/CurvaSComparada";
import { EtiquetaCronograma } from "@/componentes/Etiquetas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { Gantt } from "@/componentes/Gantt";
import { dataCurta, dataHora, moeda, numero } from "@/lib/formato";
import { periodos } from "@/servicos/cpm";
import { cronogramasDaObra, obterCronograma } from "@/servicos/cronogramas";
import { pode } from "@/servicos/permissoes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";
import { acaoAtividade, acaoAvanco, acaoConfiguracao, acaoCriarCronograma, acaoLinhaBase, acaoNovaAtividade, acaoNovaVersao } from "./acoes";

export const metadata: Metadata = { title: "Cronograma da obra" };

const pct = (v: number | null | undefined, casas = 1) => (v == null ? "—" : `${numero(v, casas)}%`);

export default async function CronogramaDaObra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versao?: string }> }) {
  const { id } = await params;
  const { versao } = await searchParams;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="cronograma" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "cronograma.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa o cronograma</b></div></>;

  const { lista, semCronograma } = await cronogramasDaObra(ator, id);
  const editar = pode(ator, "cronograma.editar");
  const escolhido = lista.find((c) => c.id === versao) ?? lista.find((c) => c.situacao === "linha_base") ?? lista[0];

  const formCriar = editar && semCronograma.length > 0 && (
    <section className="cartao surgir">
      <h2 className="cartao-titulo">Novo cronograma</h2>
      <FormAcao acao={acaoCriarCronograma.bind(null, id)} className="grade-form" style={{ marginTop: 14 }}>
        <div className="campo c6"><label htmlFor="contratoId">Contrato</label>
          <select id="contratoId" name="contratoId" className="entrada-texto" required>
            {semCronograma.map((k) => <option key={k.id} value={k.id}>{k.rotulo}{k.situacao === "rascunho" ? " (em elaboração)" : ""}</option>)}
          </select>
        </div>
        <div className="campo c2"><label htmlFor="inicio">Início</label><input id="inicio" name="inicio" type="date" className="entrada-texto" /></div>
        <div className="campo c2"><label htmlFor="calendario">Dias</label>
          <select id="calendario" name="calendario" className="entrada-texto" defaultValue="uteis"><option value="uteis">Úteis</option><option value="corridos">Corridos</option></select>
        </div>
        <div className="campo c2"><label htmlFor="unidadePeriodo">Períodos</label>
          <select id="unidadePeriodo" name="unidadePeriodo" className="entrada-texto" defaultValue="semana"><option value="semana">Semanas</option><option value="mes">Meses</option></select>
        </div>
        <div className="c12 rodape-form"><BotaoEnviar enviando="Gerando…"><Plus /> Gerar a partir da planilha contratual</BotaoEnviar></div>
      </FormAcao>
    </section>
  );

  if (!escolhido) {
    return (
      <>
        {cab}
        <div className="grade">
          {formCriar || (
            <div className="cartao vazio"><b>Nenhum cronograma</b>
              {pode(ator, "contrato.editar") ? <Link href="/contratos/novo" className="botao botao-texto">Cadastrar contrato</Link> : "O cronograma é criado a partir do contrato da obra."}
            </div>
          )}
        </div>
      </>
    );
  }

  const c = await obterCronograma(ator, escolhido.id);
  const rascunho = c.situacao === "rascunho";
  const base = c.situacao === "linha_base";
  const podeEditar = rascunho && editar;
  const lista2 = periodos(c.inicio, [c.termino, c.fimContrato ?? c.termino].sort().at(-1)!, c.unidadePeriodo);
  const estoura = c.fimContrato && c.termino > c.fimContrato;
  const ultimosAvancos = c.atividades.flatMap((a) => a.avancos.map((v) => ({ ...v, codigo: a.codigo, nome: a.nome }))).sort((x, y) => (x.data < y.data ? 1 : -1)).slice(0, 8);

  return (
    <>
      {cab}
      <div className="grade">
        <div className="barra-acoes">
          <div className="chips">
            {lista.map((v) => (
              <Link key={v.id} href={`/obras/${id}/cronograma?versao=${v.id}`} className={`chip ${v.id === c.id ? "chip-ativo" : ""}`}>
                Versão {v.versao} <small>{v.situacao === "linha_base" ? "linha de base" : v.situacao === "rascunho" ? "em elaboração" : "substituída"}</small>
              </Link>
            ))}
          </div>
          <div className="barra-acoes" style={{ marginLeft: "auto" }}>
            <Link href={`/contratos/${c.contratoId}`} className="botao botao-neutro"><FileSignature /> Contrato {c.contratoNumero}</Link>
            <a href={`/obras/${id}/cronograma/excel?versao=${c.id}`} className="botao botao-neutro"><FileSpreadsheet /> Excel</a>
            {rascunho && pode(ator, "cronograma.linha_base") && (
              <FormAcao acao={acaoLinhaBase.bind(null, id, c.id)} confirmar="Gravar a linha de base? Depois dela, o cronograma só muda por nova versão." mostrarOk={false}>
                <BotaoEnviar enviando="Gravando…" className="botao botao-primario"><Lock /> Gravar linha de base</BotaoEnviar>
              </FormAcao>
            )}
          </div>
        </div>

        <div className="indicadores">
          <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}>
            <span>Início · Término</span><b className="num">{dataCurta(c.inicio)} · {dataCurta(c.termino)}</b>
            <small className="num">{c.prazoDias} dias {c.calendario === "uteis" ? "úteis" : "corridos"} · {c.diasCorridos} dias corridos</small>
          </div>
          <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}>
            <span>Caminho crítico</span><b className="num">{c.criticas} de {c.atividades.length}</b><small>atividades sem folga</small>
          </div>
          <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}>
            <span>Avanço físico hoje</span><b className="num">{base ? pct(c.indicadores.realizadoPct) : "—"}</b>
            <small className="num">{base ? `previsto ${pct(c.indicadores.previstoPct)}` : "após a linha de base"}</small>
          </div>
          <div className={`indicador surgir ${base && c.indicadores.idp != null && c.indicadores.idp < 0.95 ? "" : "indicador-destaque"}`} style={{ "--i": 3 } as React.CSSProperties}>
            <span>Desempenho de prazo (IDP)</span><b className="num">{base && c.indicadores.idp != null ? numero(c.indicadores.idp, 2) : "—"}</b>
            <small>{base ? (c.indicadores.idp == null ? "obra não iniciada" : c.indicadores.idp >= 1 ? "no prazo ou adiantada" : c.indicadores.idp >= 0.95 ? "atraso leve" : "atrasada") : "após a linha de base"}{base && c.atrasadas > 0 ? ` · ${c.atrasadas} atividade${c.atrasadas > 1 ? "s" : ""} atrasada${c.atrasadas > 1 ? "s" : ""}` : ""}</small>
          </div>
        </div>

        {c.pendencias.length > 0 && <div className="aviso aviso-info"><CircleAlert /><span>Para gravar a linha de base: {c.pendencias.join(" ")}</span></div>}
        {estoura && <div className="aviso aviso-erro"><TriangleAlert /><span>O término previsto ({dataCurta(c.termino)}) passa do fim do prazo contratual ({dataCurta(c.fimContrato)}).</span></div>}

        <section className="surgir">
          <div className="barra-acoes" style={{ marginBottom: 10 }}>
            <h2 className="cartao-titulo">Cronograma</h2>
            <span style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
              <EtiquetaCronograma situacao={c.situacao} />
              {c.linhaBaseEm && <span className="cartao-sub">por {c.linhaBasePor} em <span className="num">{dataHora(c.linhaBaseEm)}</span></span>}
            </span>
          </div>
          <Gantt atividades={c.atividades} inicio={c.inicio} termino={c.termino} periodos={lista2} hoje={c.hoje} fimContrato={c.fimContrato} mostrarAvanco={!rascunho} />
          {c.motivo && <p className="cartao-sub" style={{ marginTop: 8 }}>Motivo da versão {c.versao}: {c.motivo}</p>}
        </section>

        <section className="cartao surgir">
          <h2 className="cartao-titulo">Curva S física e financeira</h2>
          <CurvaSComparada titulo="Avanço acumulado previsto e realizado" pontos={c.curva.map((p) => ({ rotulo: p.rotulo, previsto: p.previsto, previstoPct: p.previstoPct, realizadoPct: p.realizadoPct }))} />
          <div className="tabela-caixa" style={{ marginTop: 12 }}>
            <table className="tabela tabela-compacta">
              <thead><tr><th>Período</th><th>Datas</th><th className="dir">Previsto (R$)</th><th className="dir">Previsto acum.</th><th className="dir">Realizado (R$)</th><th className="dir">Realizado acum.</th></tr></thead>
              <tbody>
                {c.curva.map((p) => (
                  <tr key={p.indice}>
                    <td>{p.rotulo}</td><td className="num">{dataCurta(p.inicio)} a {dataCurta(p.fim)}</td>
                    <td className="dir num">{moeda(p.previsto)}</td><td className="dir num">{pct(p.previstoPct)}</td>
                    <td className="dir num">{p.realizado == null ? "—" : moeda(p.realizado)}</td><td className="dir num">{pct(p.realizadoPct)}</td>
                  </tr>
                ))}
                <tr className="linha-total"><td colSpan={2}>Total</td><td className="dir num">{moeda(c.indicadores.total)}</td><td className="dir num">100,0%</td><td className="dir num">{base ? moeda(c.indicadores.va) : "—"}</td><td className="dir num">{base ? pct(c.indicadores.realizadoPct) : "—"}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {podeEditar && (
          <>
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Atividades</h2>
              <p className="cartao-sub" style={{ marginTop: 4 }}>Predecessoras: código e tipo (TI, II, TT, IT), com defasagem em dias. Exemplo: 1.2; 1.3II+2.</p>
              <div className="atividades-edicao">
                <div className="atividade-linha atividade-cabecalho" aria-hidden="true">
                  <span>Código</span><span>Atividade</span><span>Dias</span><span>Predecessoras</span><span>Item da planilha</span><span>Parcela %</span><span />
                </div>
                {[...c.atividades].sort((x, y) => x.ordem - y.ordem).map((a) => (
                  <FormAcao key={a.id} acao={acaoAtividade.bind(null, id, c.id, a.id)} className="atividade-linha" mostrarOk={false}>
                    <input name="codigo" className="entrada-texto num" defaultValue={a.codigo} aria-label="Código" required />
                    <input name="nome" className="entrada-texto" defaultValue={a.nome} aria-label="Atividade" required />
                    <input name="duracao" type="number" min={0} className="entrada-texto num" defaultValue={a.duracao} aria-label="Duração em dias" required />
                    <input name="predecessoras" className="entrada-texto num" defaultValue={a.predecessorasTexto} aria-label="Predecessoras" />
                    <select name="itemServicoId" className="entrada-texto" defaultValue={a.itemServicoId ?? ""} aria-label="Item da planilha">
                      <option value="">Sem item (marco ou apoio)</option>
                      {c.itensContrato.map((i) => <option key={i.id} value={i.id}>{i.numero} · {i.descricao}</option>)}
                    </select>
                    <input name="parcela" className="entrada-texto num" inputMode="decimal" defaultValue={numero(Number(a.parcela), 2)} aria-label="Parcela do item" />
                    <span className="atividade-acoes">
                      <BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="…" name="acao" value="salvar" ariaLabel={`Salvar ${a.codigo}`} title="Salvar"><Save /></BotaoEnviar>
                      <BotaoEnviar className="botao botao-texto botao-pequeno" enviando="…" name="acao" value="remover" ariaLabel={`Remover ${a.codigo}`} title="Remover"><Trash2 /></BotaoEnviar>
                    </span>
                  </FormAcao>
                ))}
                <FormAcao acao={acaoNovaAtividade.bind(null, id, c.id)} className="atividade-linha atividade-nova" limpar mostrarOk={false}>
                  <input name="codigo" className="entrada-texto num" placeholder="1.10" aria-label="Código" required />
                  <input name="nome" className="entrada-texto" placeholder="Nova atividade" aria-label="Atividade" required />
                  <input name="duracao" type="number" min={0} className="entrada-texto num" placeholder="1" aria-label="Duração em dias" required />
                  <input name="predecessoras" className="entrada-texto num" placeholder="1.9" aria-label="Predecessoras" />
                  <select name="itemServicoId" className="entrada-texto" defaultValue="" aria-label="Item da planilha">
                    <option value="">Sem item (marco ou apoio)</option>
                    {c.itensContrato.map((i) => <option key={i.id} value={i.id}>{i.numero} · {i.descricao}</option>)}
                  </select>
                  <input name="parcela" className="entrada-texto num" inputMode="decimal" defaultValue="100" aria-label="Parcela do item" />
                  <span className="atividade-acoes"><BotaoEnviar className="botao botao-primario botao-pequeno" enviando="…" ariaLabel="Incluir atividade" title="Incluir"><Plus /></BotaoEnviar></span>
                </FormAcao>
              </div>
            </section>

            <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <section className="cartao surgir">
                <h2 className="cartao-titulo">Distribuição dos itens</h2>
                <div className="tabela-caixa" style={{ marginTop: 12 }}>
                  <table className="tabela tabela-compacta">
                    <thead><tr><th>Item</th><th>Descrição</th><th className="dir">Valor</th><th className="dir">Distribuído</th></tr></thead>
                    <tbody>
                      {c.itensContrato.map((i) => (
                        <tr key={i.id}>
                          <td className="num">{i.numero}</td><td>{i.descricao}</td><td className="dir num">{moeda(i.total)}</td>
                          <td className="dir">{i.distribuido === 100 ? <span className="num">100%</span> : <span className="etiqueta et-laranja">{numero(i.distribuido, 2)}%</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="cartao surgir">
                <h2 className="cartao-titulo">Calendário</h2>
                <FormAcao acao={acaoConfiguracao.bind(null, id, c.id)} className="grade-form" style={{ marginTop: 14 }} mostrarOk={false}>
                  <div className="campo c12"><label htmlFor="cfg-inicio">Início</label><input id="cfg-inicio" name="inicio" type="date" className="entrada-texto" defaultValue={c.inicio} required /></div>
                  <div className="campo c6"><label htmlFor="cfg-cal">Dias</label>
                    <select id="cfg-cal" name="calendario" className="entrada-texto" defaultValue={c.calendario}><option value="uteis">Úteis (sem fins de semana e feriados)</option><option value="corridos">Corridos</option></select>
                  </div>
                  <div className="campo c6"><label htmlFor="cfg-per">Períodos</label>
                    <select id="cfg-per" name="unidadePeriodo" className="entrada-texto" defaultValue={c.unidadePeriodo}><option value="semana">Semanas</option><option value="mes">Meses</option></select>
                  </div>
                  <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Recalculando…"><Save /> Salvar e recalcular</BotaoEnviar></div>
                </FormAcao>
              </section>
            </div>
          </>
        )}

        {base && (
          <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            {pode(ator, "cronograma.avanco") && (
              <section className="cartao surgir">
                <h2 className="cartao-titulo">Registrar avanço</h2>
                <FormAcao acao={acaoAvanco.bind(null, id, c.id)} className="grade-form" style={{ marginTop: 14 }} limpar>
                  <div className="campo c12"><label htmlFor="av-at">Atividade</label>
                    <select id="av-at" name="atividadeId" className="entrada-texto" required>
                      {c.atividades.filter((a) => a.duracao > 0 && a.avancoAtual < 100).map((a) => (
                        <option key={a.id} value={a.id}>{a.codigo} · {a.nome} ({numero(a.avancoAtual, 0)}% executado)</option>
                      ))}
                    </select>
                  </div>
                  <div className="campo c6"><label htmlFor="av-data">Data</label><input id="av-data" name="data" type="date" className="entrada-texto" defaultValue={c.hoje} max={c.hoje} required /></div>
                  <div className="campo c6"><label htmlFor="av-pct">Executado acumulado (%)</label><input id="av-pct" name="percentual" className="entrada-texto num" inputMode="decimal" required /></div>
                  <div className="campo c12"><label htmlFor="av-just">Justificativa</label><input id="av-just" name="justificativa" className="entrada-texto" required placeholder="Conferência em campo, boletim, foto" /></div>
                  <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><Plus /> Registrar</BotaoEnviar></div>
                </FormAcao>
              </section>
            )}
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Avanço por atividade</h2>
              <div className="tabela-caixa" style={{ marginTop: 12 }}>
                <table className="tabela tabela-compacta">
                  <thead><tr><th>Atividade</th><th className="dir">Peso</th><th className="dir">Previsto hoje</th><th className="dir">Executado</th></tr></thead>
                  <tbody>
                    {c.atividades.filter((a) => a.duracao > 0).map((a) => (
                      <tr key={a.id}>
                        <td><span className="num">{a.codigo}</span> · {a.nome}</td>
                        <td className="dir num">{pct(a.peso, 2)}</td>
                        <td className="dir num">{pct(a.previstoHoje, 0)}</td>
                        <td className="dir">{a.atrasada ? <span className="etiqueta et-vermelha">{pct(a.avancoAtual, 0)}</span> : <span className="num">{pct(a.avancoAtual, 0)}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ultimosAvancos.length > 0 && (
                <>
                  <h3 className="cartao-sub" style={{ marginTop: 16, fontWeight: 650 }}>Últimos registros</h3>
                  <ul className="lista-simples">
                    {ultimosAvancos.map((v, i) => (
                      <li key={i}><b className="num">{dataCurta(v.data)}</b> · {v.codigo} {v.nome}: {numero(v.percentual, 0)}% · {v.justificativa}{v.por ? ` (${v.por})` : ""}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}

        {base && pode(ator, "cronograma.linha_base") && !lista.some((v) => v.situacao === "rascunho") && (
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Nova versão do cronograma</h2>
            <FormAcao acao={acaoNovaVersao.bind(null, id, c.id)} className="form-linha" style={{ marginTop: 12 }}>
              <input name="motivo" className="entrada-texto" placeholder="Motivo (aditivo de prazo, paralisação, replanejamento)" aria-label="Motivo" required style={{ flex: 1, minWidth: 240 }} />
              <BotaoEnviar className="botao botao-neutro" enviando="Criando…"><CopyPlus /> Criar versão</BotaoEnviar>
            </FormAcao>
          </section>
        )}

        {formCriar}
      </div>
    </>
  );
}

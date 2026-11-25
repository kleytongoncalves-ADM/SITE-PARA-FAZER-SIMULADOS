import type { Metadata } from "next";
import Link from "next/link";
import { BrickWall, CircleAlert, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { moeda, quantidade } from "@/lib/formato";
import { buscarComposicoes, buscarInsumos, ROTULO_FONTE, ROTULO_TIPO_INSUMO, type TipoInsumo } from "@/servicos/precos";
import { acaoAdicionarItem, acaoEtapa, acaoNovaEtapa } from "../acoes";
import { carregarOrcamento } from "./carregar";

export const metadata: Metadata = { title: "Orçamento" };

type Busca = { incluir?: string; busca?: string; etapa?: string; tipo?: string };

export default async function Planilha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busca> }) {
  const { id } = await params;
  const q = await searchParams;
  const { ator, orcamento: o, editavel } = await carregarOrcamento(id);
  const incluir = editavel && o.etapas.length ? (q.incluir as "composicao" | "insumo" | "cotacao" | undefined) : undefined;
  const etapaPadrao = q.etapa && o.etapas.some((e) => e.id === q.etapa) ? q.etapa : o.etapas.at(-1)?.id;

  const resultadosComp = incluir === "composicao" && q.busca ? await buscarComposicoes(ator, { tabelaId: o.tabelaId, busca: q.busca, regra: o.arredondamento }) : [];
  const resultadosIns = incluir === "insumo" && q.busca ? await buscarInsumos(ator, { tabelaId: o.tabelaId, busca: q.busca, tipo: (q.tipo || "") as TipoInsumo | "" }) : [];
  const linkIncluir = (modo: string) => `/orcamentos/${id}?incluir=${modo}${etapaPadrao ? `&etapa=${etapaPadrao}` : ""}`;

  const seletorEtapa = (
    <select name="etapaId" className="entrada-texto" defaultValue={etapaPadrao} aria-label="Etapa" style={{ height: 36, fontSize: 13 }}>
      {o.etapas.map((e) => <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>)}
    </select>
  );

  return (
    <div className="grade">
      {o.pendencias.length > 0 && o.situacao === "rascunho" && (
        <div className="aviso aviso-info surgir"><CircleAlert /><span>Para aprovar: {o.pendencias.join(" ")}</span></div>
      )}

      {editavel && (
        <div className="barra-acoes surgir">
          {o.etapas.length > 0 && (
            <>
              <Link href={linkIncluir("composicao")} className={`botao ${incluir ? "botao-neutro" : "botao-primario"}`}><Plus /> Incluir item</Link>
              <Link href={`/orcamentos/${id}/muro`} className="botao botao-neutro"><BrickWall /> Assistente de muro</Link>
            </>
          )}
          <FormAcao acao={acaoNovaEtapa.bind(null, id)} className="form-linha" mostrarOk={false} limpar>
            <input name="nome" className="entrada-texto" placeholder={o.etapas.length ? "Nova etapa" : "Nome da primeira etapa"} aria-label="Nome da etapa" required style={{ height: 42, width: 220 }} />
            <BotaoEnviar className="botao botao-neutro" enviando="Criando…"><Plus /> Etapa</BotaoEnviar>
          </FormAcao>
        </div>
      )}

      {incluir && (
        <section className="cartao surgir">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <h2 className="cartao-titulo">Incluir item</h2>
            <div className="chips">
              <Link href={linkIncluir("composicao")} className={`chip ${incluir === "composicao" ? "chip-ativo" : ""}`}>Por serviço</Link>
              <Link href={linkIncluir("insumo")} className={`chip ${incluir === "insumo" ? "chip-ativo" : ""}`}>Por material</Link>
              <Link href={linkIncluir("cotacao")} className={`chip ${incluir === "cotacao" ? "chip-ativo" : ""}`}>Por cotação</Link>
              <Link href={`/orcamentos/${id}`} className="chip">Fechar</Link>
            </div>
          </div>

          {incluir !== "cotacao" && (
            <form className="form-linha" action={`/orcamentos/${id}`}>
              <input type="hidden" name="incluir" value={incluir} />
              {etapaPadrao && <input type="hidden" name="etapa" value={etapaPadrao} />}
              <div className="busca-campo">
                <Search />
                <input name="busca" type="search" defaultValue={q.busca} autoFocus placeholder={incluir === "composicao" ? "Código ou descrição do serviço" : "Código ou descrição do material"} aria-label="Buscar" />
              </div>
              {incluir === "insumo" && (
                <select name="tipo" className="entrada-texto" defaultValue={q.tipo ?? ""} aria-label="Tipo" style={{ width: 170 }}>
                  <option value="">Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO_INSUMO) as TipoInsumo[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_INSUMO[t]}</option>)}
                </select>
              )}
              <button className="botao botao-neutro">Buscar</button>
            </form>
          )}

          {incluir === "composicao" && q.busca && (
            resultadosComp.length === 0 ? <p className="cartao-sub" style={{ marginTop: 12 }}>Nenhum serviço encontrado.</p> : (
              <div className="lista-resultados">
                {resultadosComp.map((k) => (
                  <div key={k.id} className="resultado">
                    <div className="resultado-texto">
                      <span className="fraco num">{ROTULO_FONTE[k.fonte]} {k.codigo} · {k.unidade}{!k.aprovada && " · aguardando aprovação"}</span>
                      <Link href={`/precos/composicoes/${k.id}?tabela=${o.tabelaId}`} className="forte">{k.descricao}</Link>
                    </div>
                    <b className="num resultado-preco">{k.custo ? moeda(k.custo) : <span className="etiqueta et-vermelha">Sem preço</span>}</b>
                    <FormAcao acao={acaoAdicionarItem.bind(null, id)} className="form-linha" mostrarOk={false}>
                      <input type="hidden" name="tipo" value="composicao" />
                      <input type="hidden" name="refId" value={k.id} />
                      {seletorEtapa}
                      <input name="quantidade" className="entrada-texto num" inputMode="decimal" placeholder={`Qtd. (${k.unidade})`} aria-label="Quantidade" required style={{ width: 110, height: 36 }} />
                      <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="…" ariaLabel={`Incluir ${k.codigo}`}><Plus /></BotaoEnviar>
                    </FormAcao>
                  </div>
                ))}
              </div>
            )
          )}

          {incluir === "insumo" && q.busca && (
            resultadosIns.length === 0 ? <p className="cartao-sub" style={{ marginTop: 12 }}>Nenhum material encontrado.</p> : (
              <div className="lista-resultados">
                {resultadosIns.map((i) => (
                  <div key={i.id} className="resultado">
                    <div className="resultado-texto">
                      <span className="fraco num">{ROTULO_FONTE[i.fonte]} {i.codigo} · {i.unidade} · {ROTULO_TIPO_INSUMO[i.tipo]}</span>
                      <Link href={`/precos/insumos/${i.id}`} className="forte">{i.descricao}</Link>
                    </div>
                    <b className="num resultado-preco">{i.preco ? moeda(i.preco) : <span className="etiqueta et-vermelha">Sem preço</span>}</b>
                    <FormAcao acao={acaoAdicionarItem.bind(null, id)} className="form-linha" mostrarOk={false}>
                      <input type="hidden" name="tipo" value="insumo" />
                      <input type="hidden" name="refId" value={i.id} />
                      {seletorEtapa}
                      <input name="quantidade" className="entrada-texto num" inputMode="decimal" placeholder={`Qtd. (${i.unidade})`} aria-label="Quantidade" required style={{ width: 110, height: 36 }} />
                      <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="…" ariaLabel={`Incluir ${i.codigo}`}><Plus /></BotaoEnviar>
                    </FormAcao>
                  </div>
                ))}
              </div>
            )
          )}

          {incluir === "cotacao" && (
            <FormAcao acao={acaoAdicionarItem.bind(null, id)} className="grade-form" limpar>
              <input type="hidden" name="tipo" value="cotacao" />
              <div className="campo c8"><label htmlFor="descricao">Descrição</label><input id="descricao" name="descricao" className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="unidade">Unidade</label><input id="unidade" name="unidade" className="entrada-texto" required placeholder="UN" /></div>
              <div className="campo c2"><label htmlFor="qtdc">Quantidade</label><input id="qtdc" name="quantidade" className="entrada-texto num" inputMode="decimal" required /></div>
              <div className="campo c4"><label htmlFor="etapac">Etapa</label>
                <select id="etapac" name="etapaId" className="entrada-texto" defaultValue={etapaPadrao}>{o.etapas.map((e) => <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>)}</select>
              </div>
              <div className="campo c4"><label htmlFor="tipoInsumo">Tipo</label>
                <select id="tipoInsumo" name="tipoInsumo" className="entrada-texto" defaultValue="material">
                  {(Object.keys(ROTULO_TIPO_INSUMO) as TipoInsumo[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_INSUMO[t]}</option>)}
                </select>
              </div>
              <div className="campo c4"><label htmlFor="criterio">Preço adotado</label>
                <select id="criterio" name="criterio" className="entrada-texto" defaultValue="mediana">
                  <option value="mediana">Mediana das cotações</option><option value="media">Média das cotações</option><option value="menor">Menor cotação</option>
                </select>
              </div>
              <div className="campo c12"><label htmlFor="justificativa">Justificativa</label><input id="justificativa" name="justificativa" className="entrada-texto" required placeholder="Motivo de o item não estar na base oficial" /></div>
              <div className="c12"><BotaoEnviar enviando="Incluindo…"><Plus /> Incluir e registrar cotações</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>
      )}

      {o.etapas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhuma etapa</b>{editavel ? "Crie a primeira etapa para lançar os itens." : null}</div>
      ) : (
        o.etapas.map((e, n) => (
          <section key={e.id} className="tabela-caixa surgir" style={{ "--i": n } as React.CSSProperties}>
            <div className="etapa-cabecalho">
              <span className="etapa-numero num">{e.ordem}</span>
              {editavel ? (
                <FormAcao acao={acaoEtapa.bind(null, id, e.id)} className="form-linha etapa-nome" mostrarOk={false}>
                  <input name="nome" defaultValue={e.nome} className="entrada-invisivel" aria-label="Nome da etapa" required />
                  <BotaoEnviar className="botao botao-texto botao-pequeno" enviando="…" ariaLabel="Renomear etapa" title="Renomear"><Pencil /></BotaoEnviar>
                  {e.itens.length === 0 && <BotaoEnviar className="botao botao-texto botao-pequeno" name="acao" value="remover" ariaLabel="Excluir etapa" title="Excluir etapa"><Trash2 /></BotaoEnviar>}
                </FormAcao>
              ) : <h2 className="etapa-nome">{e.nome}</h2>}
              <span className="etapa-total num">{moeda(e.totais.total)}</span>
            </div>
            {e.itens.length === 0 ? (
              <p className="cartao-sub" style={{ padding: "0 18px 16px" }}>Sem itens.{editavel && <> <Link className="botao-texto" href={`/orcamentos/${id}?incluir=composicao&etapa=${e.id}`}>Incluir item</Link></>}</p>
            ) : (
              <table className="tabela tabela-compacta">
                <thead>
                  <tr><th>Item</th><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Custo unit.</th><th className="dir">Preço unit.</th><th className="dir">Total</th></tr>
                </thead>
                <tbody>
                  {e.itens.map((i) => (
                    <tr key={i.id}>
                      <td className="num">{i.numero}</td>
                      <td className="num fraco" style={{ whiteSpace: "nowrap" }}>{i.fonte === "cotacao" ? "Cotação" : `${ROTULO_FONTE[i.fonte]} ${i.codigo}`}</td>
                      <td><Link href={`/orcamentos/${id}/itens/${i.id}`} className="link-item">{i.descricao}</Link>
                        {i.semPreco && <> <span className="etiqueta et-vermelha">Sem preço</span></>}
                        {i.tipoBdi === "fornecimento" && <> <span className="etiqueta et-roxa">BDI fornecimento</span></>}
                      </td>
                      <td>{i.unidade}</td>
                      <td className="dir num">{quantidade(i.quantidade)}</td>
                      <td className="dir num">{i.semPreco ? "—" : moeda(i.custoUnitario)}</td>
                      <td className="dir num">{i.semPreco ? "—" : moeda(i.precoUnitario)}</td>
                      <td className="dir num forte">{i.semPreco ? "—" : moeda(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))
      )}
    </div>
  );
}

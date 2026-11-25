import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta, moeda, paraCampo, quantidade, valor } from "@/lib/formato";
import { insumosDoItem, ROTULO_CRITERIO, ROTULO_MODO } from "@/servicos/orcamentos";
import { ROTULO_FONTE, ROTULO_TIPO_INSUMO } from "@/servicos/precos";
import { acaoCotacao, acaoEditarItem, acaoRemoverItem } from "../../../acoes";
import { carregarOrcamento } from "../../carregar";

export const metadata: Metadata = { title: "Item do orçamento" };

export default async function ItemOrcamento({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const { ator, orcamento: o, editavel } = await carregarOrcamento(id);
  const item = o.etapas.flatMap((e) => e.itens).find((i) => i.id === itemId);
  if (!item) notFound();
  const insumos = await insumosDoItem(ator, id, itemId);
  const etapa = o.etapas.find((e) => e.id === item.etapaId)!;
  const d = (rotulo: string, v: React.ReactNode) => (<div><dt>{rotulo}</dt><dd>{v || "—"}</dd></div>);

  return (
    <div className="grade">
      <div>
        <Link href={`/orcamentos/${id}`} className="botao botao-texto" style={{ paddingLeft: 0 }}><ArrowLeft /> Planilha</Link>
        <h2 className="titulo" style={{ fontSize: 22, marginTop: 4 }}><span className="num" style={{ color: "var(--destaque)" }}>{item.numero}</span> {item.descricao}</h2>
        <p className="subtitulo">{etapa.nome} · {ROTULO_MODO[item.modo]} · {item.fonte === "cotacao" ? "Cotação de mercado" : `${ROTULO_FONTE[item.fonte]} ${item.codigo}`}</p>
      </div>

      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", alignItems: "start" }}>
        <section className="cartao surgir">
          <h3 className="cartao-titulo" style={{ marginBottom: 14 }}>Valores</h3>
          <dl className="dados">
            {d("Quantidade", <span className="num">{quantidade(item.quantidade)} {item.unidade}</span>)}
            {d("Custo unitário", item.semPreco ? <span className="etiqueta et-vermelha">Sem preço</span> : <span className="num">{moeda(item.custoUnitario)}</span>)}
            {d("Preço unitário com BDI", <span className="num">{item.semPreco ? "—" : moeda(item.precoUnitario)}</span>)}
            {d("Total com BDI", <span className="num">{item.semPreco ? "—" : moeda(item.total)}</span>)}
            {d("Material", <span className="num">{moeda(item.materialTotal)}</span>)}
            {d("Mão de obra", <span className="num">{moeda(item.maoDeObraTotal)}</span>)}
            {d("Equipamento", <span className="num">{moeda(item.equipamentoTotal)}</span>)}
            {d("BDI aplicado", item.tipoBdi === "fornecimento" ? `Fornecimento (${valor(o.bdiFornecimentoPct)}%)` : `Obra (${valor(o.bdiObraPct)}%)`)}
          </dl>
          {item.justificativa && <p className="cartao-sub" style={{ marginTop: 14 }}><b>Justificativa:</b> {item.justificativa}</p>}
        </section>

        <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
          <h3 className="cartao-titulo" style={{ marginBottom: 14 }}>Quantidade e memória de cálculo</h3>
          {editavel ? (
            <FormAcao acao={acaoEditarItem.bind(null, id, itemId)} style={{ display: "grid", gap: 12 }}>
              <div className="campo"><label htmlFor="quantidade">Quantidade ({item.unidade})</label>
                <input id="quantidade" name="quantidade" className="entrada-texto num" inputMode="decimal" defaultValue={paraCampo(item.quantidade)} required /></div>
              <div className="campo"><label htmlFor="memoria">Memória de cálculo</label>
                <textarea id="memoria" name="memoria" className="entrada-texto" defaultValue={item.memoria ?? ""} placeholder="10,00 x 2,00 m, duas faces" /></div>
              <div className="campo"><label htmlFor="tipoBdi">BDI</label>
                <select id="tipoBdi" name="tipoBdi" className="entrada-texto" defaultValue={item.tipoBdi}>
                  <option value="obra">Obra ({valor(o.bdiObraPct)}%)</option>
                  <option value="fornecimento">Fornecimento de materiais e equipamentos ({valor(o.bdiFornecimentoPct)}%)</option>
                </select></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <BotaoEnviar enviando="Salvando…"><Save /> Salvar</BotaoEnviar>
              </div>
            </FormAcao>
          ) : (
            <p className="cartao-sub" style={{ whiteSpace: "pre-wrap" }}>{item.memoria || "Sem memória de cálculo."}</p>
          )}
          {editavel && (
            <FormAcao acao={acaoRemoverItem.bind(null, id, itemId)} confirmar={`Excluir o item ${item.numero}?`} style={{ marginTop: 12 }}>
              <BotaoEnviar className="botao botao-neutro" enviando="Excluindo…"><Trash2 /> Excluir item</BotaoEnviar>
            </FormAcao>
          )}
        </section>
      </div>

      {item.modo === "cotacao" && (
        <section className="cartao surgir" style={{ "--i": 2 } as React.CSSProperties}>
          <h3 className="cartao-titulo">Cotações</h3>
          <p className="cartao-sub" style={{ marginBottom: 12 }}>Preço adotado: {ROTULO_CRITERIO[item.criterioCotacao ?? "mediana"].toLowerCase()} de no mínimo três cotações.</p>
          {item.cotacoes.length > 0 && (
            <div className="tabela-caixa" style={{ boxShadow: "none", marginBottom: 14 }}>
              <table className="tabela tabela-compacta">
                <thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Data</th><th>Validade</th><th className="dir">Valor</th>{editavel && <th />}</tr></thead>
                <tbody>
                  {item.cotacoes.map((c) => (
                    <tr key={c.id}>
                      <td className="forte">{c.fornecedor}</td><td className="num">{c.cnpj ?? "—"}</td><td className="num">{dataCurta(c.data)}</td>
                      <td className="num">{dataCurta(c.validade)}</td><td className="dir num">{moeda(c.valor)}</td>
                      {editavel && (
                        <td className="dir">
                          <FormAcao acao={acaoCotacao.bind(null, id, itemId)} mostrarOk={false}>
                            <input type="hidden" name="cotacaoId" value={c.id} />
                            <BotaoEnviar className="botao botao-texto botao-pequeno" name="acao" value="remover" ariaLabel={`Excluir cotação de ${c.fornecedor}`}><Trash2 /></BotaoEnviar>
                          </FormAcao>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editavel && (
            <FormAcao acao={acaoCotacao.bind(null, id, itemId)} className="grade-form" limpar>
              <div className="campo c4"><label htmlFor="fornecedor">Fornecedor</label><input id="fornecedor" name="fornecedor" className="entrada-texto" required /></div>
              <div className="campo c3"><label htmlFor="cnpj">CNPJ</label><input id="cnpj" name="cnpj" className="entrada-texto num" /></div>
              <div className="campo c2"><label htmlFor="valor">Valor</label><input id="valor" name="valor" className="entrada-texto num" inputMode="decimal" required /></div>
              <div className="campo c3"><label htmlFor="data">Data</label><input id="data" name="data" type="date" className="entrada-texto" required /></div>
              <div className="campo c3"><label htmlFor="validade">Validade</label><input id="validade" name="validade" type="date" className="entrada-texto" /></div>
              <div className="c12"><BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><Plus /> Registrar cotação</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>
      )}

      <section className="tabela-caixa surgir" style={{ "--i": 3 } as React.CSSProperties}>
        <div className="etapa-cabecalho"><h3 className="etapa-nome">Composição analítica</h3><span className="cartao-sub">Preços da data-base, congelados no orçamento</span></div>
        <table className="tabela tabela-compacta">
          <thead><tr><th>Código</th><th>Insumo</th><th>Tipo</th><th>Und.</th><th className="dir">Coeficiente</th><th className="dir">Preço</th><th className="dir">Custo</th></tr></thead>
          <tbody>
            {insumos.map((l) => (
              <tr key={l.id}>
                <td className="num fraco">{l.codigo}</td><td>{l.descricao}</td><td>{ROTULO_TIPO_INSUMO[l.tipo]}</td><td>{l.unidade}</td>
                <td className="dir num">{valor(l.coeficiente, 7)}</td>
                <td className="dir num">{l.preco == null ? <span className="etiqueta et-vermelha">Sem preço</span> : moeda(l.preco)}</td>
                <td className="dir num">{l.preco == null ? "—" : moeda(Number(l.coeficiente) * Number(l.preco))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={6} className="dir forte">Custo unitário ({o.arredondamento === "truncar" ? "truncado" : "arredondado"})</td><td className="dir num forte">{item.semPreco ? "—" : moeda(item.custoUnitario)}</td></tr></tfoot>
        </table>
      </section>
    </div>
  );
}

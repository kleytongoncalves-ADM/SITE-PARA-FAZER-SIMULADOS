import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CopyPlus, FileSpreadsheet, Stamp, XCircle } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataExtenso, mesAno, moeda, percentual, quantidade, valor } from "@/lib/formato";
import { PARCELAS_BDI, ROTULO_PARCELA, ROTULO_TIPO_BDI } from "@/servicos/calculo";
import { cronogramaDo, curvaAbcServicos, insumosDoOrcamento, rotuloOrcamento } from "@/servicos/orcamentos";
import { ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO } from "@/servicos/precos";
import { pode } from "@/servicos/permissoes";
import { acaoAprovar, acaoCancelar, acaoNovaVersao } from "../../acoes";
import { carregarOrcamento } from "../carregar";

export const metadata: Metadata = { title: "Nota do orçamento" };

export default async function Nota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, usuario, orcamento: o, podeAprovar } = await carregarOrcamento(id);
  const [abc, analitica] = await Promise.all([curvaAbcServicos(ator, id), insumosDoOrcamento(ator, id)]);
  const crono = cronogramaDo(o);
  const rotuloPeriodo = o.unidadePeriodo === "mes" ? "Mês" : "Sem.";
  const periodos = Array.from({ length: o.periodos }, (_, i) => i + 1);
  const temFornecimento = o.etapas.some((e) => e.itens.some((i) => i.tipoBdi === "fornecimento"));
  const numeroNota = o.nota ? `${String(o.nota.numero).padStart(4, "0")}/${o.nota.ano}` : null;
  const itens = o.etapas.flatMap((e) => e.itens);

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <BotaoImprimir />
        <a href={`/orcamentos/${id}/excel`} className="botao botao-neutro"><FileSpreadsheet /> Planilha Excel</a>
        {o.situacao === "rascunho" && podeAprovar && (
          <FormAcao acao={acaoAprovar.bind(null, id)} confirmar="Aprovar o orçamento e emitir a nota? Depois de aprovado, ele não pode ser alterado.">
            <BotaoEnviar enviando="Aprovando…"><Stamp /> Aprovar e emitir nota</BotaoEnviar>
          </FormAcao>
        )}
        {o.situacao !== "rascunho" && pode(ator, "orcamento.editar") && (
          <FormAcao acao={acaoNovaVersao.bind(null, id)}>
            <BotaoEnviar className="botao botao-neutro" enviando="Criando…"><CopyPlus /> Nova versão</BotaoEnviar>
          </FormAcao>
        )}
        {(o.situacao === "rascunho" || o.situacao === "aprovado") && podeAprovar && (
          <FormAcao acao={acaoCancelar.bind(null, id)} confirmar="Cancelar este orçamento?">
            <BotaoEnviar className="botao botao-texto" enviando="Cancelando…"><XCircle /> Cancelar orçamento</BotaoEnviar>
          </FormAcao>
        )}
      </div>

      {o.situacao === "rascunho" && o.pendencias.length > 0 && (
        <div className="aviso aviso-info nao-imprimir"><CircleAlert /><span>Para aprovar: {o.pendencias.join(" ")} <Link href={`/orcamentos/${id}`} className="botao-texto">Ir para a planilha</Link></span></div>
      )}

      <article className="nota">
        <header className="nota-topo">
          <div>
            <span className="nota-orgao">{usuario.orgaoNome}</span>
            <h2 className="nota-titulo">{numeroNota ? `Nota de orçamento nº ${numeroNota}` : "Orçamento em elaboração"}</h2>
            <span className="fraco">{o.obraCodigo} · {o.obraNome}</span>
          </div>
          <dl className="nota-dados">
            <div><dt>Orçamento</dt><dd className="num">{rotuloOrcamento(o)} · {o.nome}</dd></div>
            <div><dt>Data-base</dt><dd>{ROTULO_FONTE[o.fonte]} {o.uf} {mesAno(o.mes)}</dd></div>
            <div><dt>Regime</dt><dd>{ROTULO_REGIME[o.regime]}</dd></div>
            <div><dt>Totais</dt><dd>{o.arredondamento === "truncar" ? "Truncados" : "Arredondados"} em 2 casas</dd></div>
            <div><dt>Tipo de obra (BDI)</dt><dd>{ROTULO_TIPO_BDI[o.tipoObraBdi]}</dd></div>
            {o.aprovadoEm && <div><dt>Aprovado</dt><dd>{dataExtenso(o.aprovadoEm)}{o.aprovadoPor ? `, ${o.aprovadoPor}` : ""}</dd></div>}
          </dl>
        </header>

        {o.fonte === "demonstracao" && <p className="nota-alerta">Preços da base de demonstração. Não usar para contratação.</p>}

        <section>
          <h3 className="nota-secao">Resumo por etapa</h3>
          <table className="tabela tabela-compacta">
            <thead><tr><th>Etapa</th><th className="dir">Material</th><th className="dir">Mão de obra</th><th className="dir">Equipamento</th><th className="dir">Custo direto</th><th className="dir">BDI</th><th className="dir">Total</th><th className="dir">%</th></tr></thead>
            <tbody>
              {o.etapas.map((e) => (
                <tr key={e.id}>
                  <td>{e.ordem}. {e.nome}</td>
                  <td className="dir num">{moeda(e.totais.material)}</td>
                  <td className="dir num">{moeda(e.totais.maoDeObra)}</td>
                  <td className="dir num">{moeda(e.totais.equipamento)}</td>
                  <td className="dir num">{moeda(e.totais.custo)}</td>
                  <td className="dir num">{moeda(e.totais.bdi)}</td>
                  <td className="dir num forte">{moeda(e.totais.total)}</td>
                  <td className="dir num fraco">{percentual(Number(o.totais.total) ? (Number(e.totais.total) / Number(o.totais.total)) * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="forte">Total</td>
                <td className="dir num forte">{moeda(o.totais.material)}</td>
                <td className="dir num forte">{moeda(o.totais.maoDeObra)}</td>
                <td className="dir num forte">{moeda(o.totais.equipamento)}</td>
                <td className="dir num forte">{moeda(o.totais.custo)}</td>
                <td className="dir num forte">{moeda(o.totais.bdi)}</td>
                <td className="dir num forte">{moeda(o.totais.total)}</td>
                <td className="dir num">100,00%</td>
              </tr>
            </tfoot>
          </table>
          <div className="nota-total">
            <span>Valor global</span><b className="num">{moeda(o.totais.total)}</b>
          </div>
        </section>

        <section className="nota-duas">
          <div>
            <h3 className="nota-secao">BDI {temFornecimento ? "de obra" : ""} · {percentual(o.bdiObraPct)}</h3>
            <table className="tabela tabela-compacta">
              <tbody>{PARCELAS_BDI.map((p) => <tr key={p}><td>{ROTULO_PARCELA[p]}</td><td className="dir num">{percentual(o.bdiObra[p])}</td></tr>)}</tbody>
            </table>
          </div>
          {temFornecimento ? (
            <div>
              <h3 className="nota-secao">BDI de fornecimento · {percentual(o.bdiFornecimentoPct)}</h3>
              <table className="tabela tabela-compacta">
                <tbody>{PARCELAS_BDI.map((p) => <tr key={p}><td>{ROTULO_PARCELA[p]}</td><td className="dir num">{percentual(o.bdiFornecimento[p])}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div>
              <h3 className="nota-secao">Encargos sociais</h3>
              <table className="tabela tabela-compacta">
                <tbody>
                  <tr><td>Horista</td><td className="dir num">{o.encargosHorista ? percentual(o.encargosHorista) : "Conforme a base"}</td></tr>
                  <tr><td>Mensalista</td><td className="dir num">{o.encargosMensalista ? percentual(o.encargosMensalista) : "Conforme a base"}</td></tr>
                </tbody>
              </table>
              <p className="fraco" style={{ fontSize: 12, marginTop: 8 }}>BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)] − 1, Acórdão TCU 2.622/2013.</p>
            </div>
          )}
        </section>

        <section>
          <h3 className="nota-secao">Planilha orçamentária</h3>
          <table className="tabela tabela-compacta">
            <thead><tr><th>Item</th><th>Fonte</th><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Custo unit.</th><th className="dir">Preço unit.</th><th className="dir">Total</th></tr></thead>
            <tbody>
              {o.etapas.map((e) => [
                <tr key={e.id} className="nota-linha-etapa"><td className="num">{e.ordem}</td><td colSpan={7}>{e.nome}</td><td className="dir num">{moeda(e.totais.total)}</td></tr>,
                ...e.itens.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.numero}</td>
                    <td className="fraco">{ROTULO_FONTE[i.fonte]}</td>
                    <td className="num">{i.codigo ?? "—"}</td>
                    <td>{i.descricao}{i.memoria && <div className="fraco nota-memoria">{i.memoria}</div>}</td>
                    <td>{i.unidade}</td>
                    <td className="dir num">{quantidade(i.quantidade)}</td>
                    <td className="dir num">{i.semPreco ? "—" : moeda(i.custoUnitario)}</td>
                    <td className="dir num">{i.semPreco ? "—" : moeda(i.precoUnitario)}</td>
                    <td className="dir num">{i.semPreco ? "—" : moeda(i.total)}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </section>

        {abc.linhas.length > 0 && (
          <section>
            <h3 className="nota-secao">Curva ABC de serviços</h3>
            <table className="tabela tabela-compacta">
              <thead><tr><th>Classe</th><th>Item</th><th>Descrição</th><th className="dir">Total</th><th className="dir">%</th><th className="dir">Acum.</th></tr></thead>
              <tbody>
                {abc.linhas.map((l, i) => (
                  <tr key={i}><td>{l.classe}</td><td className="num">{l.numero}</td><td>{l.descricao}</td><td className="dir num">{moeda(l.valor)}</td><td className="dir num">{percentual(l.percentual)}</td><td className="dir num">{percentual(l.acumulado)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h3 className="nota-secao">Cronograma físico-financeiro</h3>
          <div className="nota-rolagem">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Etapa</th>{periodos.map((p) => <th key={p} className="dir">{rotuloPeriodo} {p}</th>)}</tr></thead>
              <tbody>
                {o.etapas.map((e, i) => (
                  <tr key={e.id}><td>{e.ordem}. {e.nome}</td>{crono.linhas[i].valores.map((v, j) => <td key={j} className="dir num">{Number(v) ? valor(v) : "—"}</td>)}</tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="forte">No período</td>{crono.porPeriodo.map((v, j) => <td key={j} className="dir num forte">{valor(v)}</td>)}</tr>
                <tr><td className="forte">Acumulado</td>{crono.pctAcumulado.map((v, j) => <td key={j} className="dir num">{percentual(v, 1)}</td>)}</tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="nota-quebra">
          <h3 className="nota-secao">Composições analíticas</h3>
          {itens.filter((i) => (analitica.get(i.id)?.length ?? 0) > 0).map((i) => (
            <div key={i.id} className="nota-analitica">
              <p className="forte"><span className="num">{i.numero}</span> · {i.codigo ? `${ROTULO_FONTE[i.fonte]} ${i.codigo} · ` : ""}{i.descricao} ({i.unidade})</p>
              <table className="tabela tabela-compacta">
                <thead><tr><th>Código</th><th>Insumo</th><th>Tipo</th><th>Und.</th><th className="dir">Coef.</th><th className="dir">Preço</th><th className="dir">Parcial</th></tr></thead>
                <tbody>
                  {analitica.get(i.id)!.map((l) => (
                    <tr key={l.id}>
                      <td className="num">{l.codigo}</td><td>{l.descricao}</td><td className="fraco">{ROTULO_TIPO_INSUMO[l.tipo]}</td><td>{l.unidade}</td>
                      <td className="dir num">{valor(l.coeficiente, 4)}</td>
                      <td className="dir num">{l.preco == null ? "—" : moeda(l.preco)}</td>
                      <td className="dir num">{l.preco == null ? "—" : moeda(Number(l.coeficiente) * Number(l.preco))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={6} className="forte">Custo unitário</td><td className="dir num forte">{i.semPreco ? "—" : moeda(i.custoUnitario)}</td></tr></tfoot>
              </table>
            </div>
          ))}
        </section>

        <footer className="nota-assinaturas">
          <div>
            <span className="nota-linha-assinatura" />
            <b>{o.responsavelTecnico || "Responsável técnico"}</b>
            <span className="fraco">{[o.registroProfissional, o.art ? `ART/RRT ${o.art}` : null].filter(Boolean).join(" · ") || "Registro profissional e ART/RRT"}</span>
          </div>
          <div>
            <span className="nota-linha-assinatura" />
            <b>{o.aprovadoPor || "Aprovação"}</b>
            <span className="fraco">{o.aprovadoEm ? dataExtenso(o.aprovadoEm) : "Data"}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

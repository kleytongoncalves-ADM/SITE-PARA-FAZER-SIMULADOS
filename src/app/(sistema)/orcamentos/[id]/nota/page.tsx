import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CopyPlus, FileSpreadsheet, Stamp, XCircle } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { BarraComposicao, COR, CurvaS, Pareto, Participacao } from "@/componentes/relatorio/Graficos";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { dataCurta, dataHora, dataLonga, mesAno, moeda, percentual, quantidade, valor, unidadeMedida } from "@/lib/formato";
import { PARCELAS_BDI, ROTULO_PARCELA, ROTULO_TIPO_BDI } from "@/servicos/calculo";
import { cronogramaDo, curvaAbcServicos, insumosDoOrcamento, ROTULO_SITUACAO_ORC, rotuloOrcamento } from "@/servicos/orcamentos";
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
  const n = (v: string | null | undefined) => Number(v ?? 0);
  const art = o.art ? (/^\s*(ART|RRT)\b/i.test(o.art) ? o.art.trim() : `ART/RRT ${o.art.trim()}`) : null;

  // Resumo executivo: só fatos tirados dos números do orçamento.
  const resumo: string[] = [];
  const custo = n(o.totais.custo);
  if (custo > 0) {
    const pc = (v: string) => percentual((n(v) / custo) * 100, 1);
    resumo.push(`Valor global de ${moeda(o.totais.total)}: custo direto de ${moeda(o.totais.custo)} mais BDI de ${percentual(o.bdiObraPct)} (${moeda(o.totais.bdi)}).`);
    resumo.push(`O custo direto se divide em material ${pc(o.totais.material)}, mão de obra ${pc(o.totais.maoDeObra)} e equipamento ${pc(o.totais.equipamento)}.`);
    const maiorEtapa = [...o.etapas].sort((a, b) => n(b.totais.total) - n(a.totais.total))[0];
    if (o.etapas.length > 1 && maiorEtapa) resumo.push(`A etapa de maior valor é ${maiorEtapa.ordem}. ${maiorEtapa.nome}, com ${moeda(maiorEtapa.totais.total)} (${percentual((n(maiorEtapa.totais.total) / n(o.totais.total)) * 100, 1)} do total).`);
    const a = abc.linhas.filter((l) => l.classe === "A");
    if (a.length) resumo.push(`${a.length} de ${abc.linhas.length} itens (classe A) concentram ${percentual(a.reduce((s, l) => s + n(l.percentual), 0), 1)} do valor. O maior é ${a[0].numero} ${a[0].descricao.toLowerCase()}, com ${moeda(a[0].valor)}.`);
    const pico = crono.porPeriodo.reduce((m, v, k) => (n(v) > n(crono.porPeriodo[m]) ? k : m), 0);
    if (n(crono.porPeriodo[pico]) > 0) resumo.push(`Maior desembolso no período ${pico + 1} do cronograma: ${moeda(crono.porPeriodo[pico])}.`);
  } else resumo.push("Orçamento sem itens com preço.");
  if (o.semPreco) resumo.push(o.semPreco === 1 ? "Há 1 item sem preço, fora dos totais." : `Há ${o.semPreco} itens sem preço, fora dos totais.`);

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

      <article className="rel">
        <CabecalhoRelatorio
          orgao={usuario.orgaoNome}
          tipo="Nota de orçamento"
          titulo={numeroNota ? `Nº ${numeroNota}` : "Em elaboração"}
          subtitulo={`${o.obraCodigo} · ${o.obraNome}`}
          selo={{ texto: ROTULO_SITUACAO_ORC[o.situacao], cor: o.situacao === "aprovado" ? "verde" : o.situacao === "rascunho" ? "laranja" : o.situacao === "cancelado" ? "vermelho" : "neutro" }}
          dados={[
            ["Orçamento", `${rotuloOrcamento(o)} · ${o.nome}`],
            ["Data-base", `${ROTULO_FONTE[o.fonte]} ${o.uf} ${mesAno(o.mes)}`],
            ["Regime", ROTULO_REGIME[o.regime]],
            ["Tipo de obra (BDI)", ROTULO_TIPO_BDI[o.tipoObraBdi]],
            ["Totais", `${o.arredondamento === "truncar" ? "Truncados" : "Arredondados"} em 2 casas`],
            ["Responsável técnico", o.responsavelTecnico ? `${o.responsavelTecnico}${o.registroProfissional ? ` · ${o.registroProfissional}` : ""}` : null],
            ["ART/RRT", art],
            ["Aprovação", o.aprovadoEm ? `${dataHora(o.aprovadoEm)}${o.aprovadoPor ? ` · ${o.aprovadoPor}` : ""}` : "Pendente"],
          ]}
        />

        {o.fonte === "demonstracao" && <p className="rel-alerta">Preços da base de demonstração, ilustrativos. Não usar para contratação.</p>}

        <Secao numero={1} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Valor global com BDI", valor: moeda(o.totais.total), destaque: true },
            { rotulo: "Custo direto", valor: moeda(o.totais.custo) },
            { rotulo: `BDI de obra · ${percentual(o.bdiObraPct)}`, valor: moeda(o.totais.bdi) },
            { rotulo: "Itens e etapas", valor: `${itens.length} itens`, detalhe: `${o.etapas.length} ${o.etapas.length === 1 ? "etapa" : "etapas"}` },
            { rotulo: "Prazo previsto", valor: `${o.periodos} ${o.unidadePeriodo === "mes" ? (o.periodos === 1 ? "mês" : "meses") : (o.periodos === 1 ? "semana" : "semanas")}`, detalhe: o.inicio ? `início ${dataCurta(o.inicio)}` : undefined },
          ]} />
          <ul className="rel-pontos">{resumo.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Secao>

        <Secao numero={2} titulo="Composição do valor" descricao="Custo direto separado por natureza, mais o BDI aplicado sobre ele.">
          <BarraComposicao titulo="Formação do valor global (R$)" fatias={[
            { rotulo: "Material", valor: n(o.totais.material), cor: COR.material },
            { rotulo: "Mão de obra", valor: n(o.totais.maoDeObra), cor: COR.maoDeObra },
            { rotulo: "Equipamento", valor: n(o.totais.equipamento), cor: COR.equipamento },
            { rotulo: "BDI", valor: n(o.totais.bdi), cor: COR.bdi },
          ]} />
          <div className="rel-duas">
            <div>
              <h4 className="rel-sub">BDI de obra · {percentual(o.bdiObraPct)}</h4>
              <table className="rel-tabela">
                <tbody>{PARCELAS_BDI.map((p) => <tr key={p}><td>{ROTULO_PARCELA[p]}</td><td className="dir num">{percentual(o.bdiObra[p])}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              {temFornecimento ? (
                <>
                  <h4 className="rel-sub">BDI de fornecimento · {percentual(o.bdiFornecimentoPct)}</h4>
                  <table className="rel-tabela">
                    <tbody>{PARCELAS_BDI.map((p) => <tr key={p}><td>{ROTULO_PARCELA[p]}</td><td className="dir num">{percentual(o.bdiFornecimento[p])}</td></tr>)}</tbody>
                  </table>
                </>
              ) : (
                <>
                  <h4 className="rel-sub">Encargos sociais</h4>
                  <table className="rel-tabela">
                    <tbody>
                      <tr><td>Horista</td><td className="dir num">{o.encargosHorista ? percentual(o.encargosHorista) : "Conforme a base"}</td></tr>
                      <tr><td>Mensalista</td><td className="dir num">{o.encargosMensalista ? percentual(o.encargosMensalista) : "Conforme a base"}</td></tr>
                    </tbody>
                  </table>
                  <p className="rel-nota-formula">BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)] − 1 · Acórdão TCU 2.622/2013</p>
                </>
              )}
            </div>
          </div>
        </Secao>

        <Secao numero={3} titulo="Resumo por etapa">
          <table className="rel-tabela">
            <thead><tr><th>Etapa</th><th className="dir">Material</th><th className="dir">Mão de obra</th><th className="dir">Equipamento</th><th className="dir">Custo direto</th><th className="dir">BDI</th><th className="dir">Total (R$)</th><th>Participação</th></tr></thead>
            <tbody>
              {o.etapas.map((e) => (
                <tr key={e.id}>
                  <td className="forte">{e.ordem}. {e.nome}</td>
                  <td className="dir num">{valor(e.totais.material)}</td>
                  <td className="dir num">{valor(e.totais.maoDeObra)}</td>
                  <td className="dir num">{valor(e.totais.equipamento)}</td>
                  <td className="dir num">{valor(e.totais.custo)}</td>
                  <td className="dir num">{valor(e.totais.bdi)}</td>
                  <td className="dir num forte">{valor(e.totais.total)}</td>
                  <td><Participacao pct={n(o.totais.total) ? (n(e.totais.total) / n(o.totais.total)) * 100 : 0} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="dir num">{valor(o.totais.material)}</td><td className="dir num">{valor(o.totais.maoDeObra)}</td><td className="dir num">{valor(o.totais.equipamento)}</td>
                <td className="dir num">{valor(o.totais.custo)}</td><td className="dir num">{valor(o.totais.bdi)}</td><td className="dir num">{valor(o.totais.total)}</td><td><Participacao pct={100} barra={false} /></td>
              </tr>
            </tfoot>
          </table>
        </Secao>

        <Secao numero={4} titulo="Planilha orçamentária" descricao="Preço unitário = custo unitário × (1 + BDI). Valores em reais.">
          <table className="rel-tabela rel-tabela-planilha rel-fixa">
            <colgroup><col style={{ width: "6%" }} /><col style={{ width: "12%" }} /><col /><col style={{ width: "6%" }} /><col style={{ width: "8%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /></colgroup>
            <thead><tr><th>Item</th><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Quant.</th><th className="dir">Custo unit.</th><th className="dir">Preço unit.</th><th className="dir">Total</th></tr></thead>
            <tbody>
              {o.etapas.map((e) => [
                <tr key={e.id} className="rel-linha-etapa"><td className="num">{e.ordem}</td><td colSpan={6}>{e.nome}</td><td className="dir num">{valor(e.totais.total)}</td></tr>,
                ...e.itens.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.numero}</td>
                    <td className="num">{i.fonte === "cotacao" ? "—" : i.codigo}<div className="rel-memoria rel-cod-fonte">{ROTULO_FONTE[i.fonte]}</div></td>
                    <td>{i.descricao}{i.memoria && <div className="rel-memoria">{i.memoria}</div>}</td>
                    <td>{unidadeMedida(i.unidade)}</td>
                    <td className="dir num">{quantidade(i.quantidade)}</td>
                    <td className="dir num">{i.semPreco ? "—" : valor(i.custoUnitario)}</td>
                    <td className="dir num">{i.semPreco ? "—" : valor(i.precoUnitario)}</td>
                    <td className="dir num forte">{i.semPreco ? "—" : valor(i.total)}</td>
                  </tr>
                )),
              ])}
            </tbody>
            <tfoot><tr><td colSpan={7}>Valor global</td><td className="dir num">{moeda(o.totais.total)}</td></tr></tfoot>
          </table>
        </Secao>

        {abc.linhas.length > 0 && (
          <Secao numero={5} titulo="Curva ABC de serviços" descricao="Itens em ordem de valor. Classe A: itens que somam os primeiros 80% do valor; B: até 95%; C: o restante.">
            <Pareto titulo="Valor por item (R$) e acumulado (%)" itens={abc.linhas.map((l) => ({ rotulo: l.numero, valor: n(l.valor), acumulado: n(l.acumulado), classe: l.classe }))} />
            <table className="rel-tabela rel-fixa">
              <colgroup><col style={{ width: "8%" }} /><col style={{ width: "7%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} /></colgroup>
              <thead><tr><th>Classe</th><th>Item</th><th>Descrição</th><th className="dir">Total (R$)</th><th className="dir">%</th><th className="dir">Acumulado</th></tr></thead>
              <tbody>
                {abc.linhas.map((l, i) => (
                  <tr key={i}><td><span className={`rel-classe rel-classe-${l.classe}`}>{l.classe}</span></td><td className="num">{l.numero}</td><td>{l.descricao}</td><td className="dir num">{valor(l.valor)}</td><td className="dir num">{percentual(l.percentual)}</td><td className="dir num">{percentual(l.acumulado)}</td></tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        <Secao numero={6} titulo="Cronograma físico-financeiro" descricao={`Distribuição do valor com BDI por ${o.unidadePeriodo === "mes" ? "mês" : "semana"}.`}>
          <CurvaS titulo="Desembolso por período (R$) e acumulado (%)" periodos={periodos.map((p, k) => ({ rotulo: `${rotuloPeriodo} ${p}`, valor: n(crono.porPeriodo[k]), acumulado: n(crono.pctAcumulado[k]) }))} />
          <div className="rel-rolagem">
            <table className="rel-tabela">
              <thead><tr><th>Etapa</th>{periodos.map((p) => <th key={p} className="dir">{rotuloPeriodo} {p}</th>)}</tr></thead>
              <tbody>
                {o.etapas.map((e, i) => (
                  <tr key={e.id}><td className="forte">{e.ordem}. {e.nome}</td>{crono.linhas[i].valores.map((v, j) => <td key={j} className="dir num">{n(v) ? valor(v) : "—"}</td>)}</tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>No período</td>{crono.porPeriodo.map((v, j) => <td key={j} className="dir num">{valor(v)}</td>)}</tr>
                <tr><td>Acumulado</td>{crono.pctAcumulado.map((v, j) => <td key={j} className="dir num">{percentual(v, 1)}</td>)}</tr>
              </tfoot>
            </table>
          </div>
        </Secao>

        <Secao numero={7} titulo="Composições analíticas" quebra descricao="Insumos e coeficientes de cada item, com os preços congelados na data-base do orçamento.">
          {itens.filter((i) => (analitica.get(i.id)?.length ?? 0) > 0).map((i) => (
            <div key={i.id} className="rel-analitica">
              <p><b className="num">{i.numero}</b><span>{i.descricao}</span><small>{i.codigo ? `${ROTULO_FONTE[i.fonte]} ${i.codigo} · ` : ""}{unidadeMedida(i.unidade)}</small></p>
              <table className="rel-tabela rel-fixa">
                <colgroup><col style={{ width: "11%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "7%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /></colgroup>
                <thead><tr><th>Código</th><th>Insumo</th><th>Tipo</th><th>Und.</th><th className="dir">Coeficiente</th><th className="dir">Preço (R$)</th><th className="dir">Parcial (R$)</th></tr></thead>
                <tbody>
                  {analitica.get(i.id)!.map((l) => (
                    <tr key={l.id}>
                      <td className="num">{l.codigo}</td><td>{l.descricao}</td><td className="fraco">{ROTULO_TIPO_INSUMO[l.tipo]}</td><td>{unidadeMedida(l.unidade)}</td>
                      <td className="dir num">{valor(l.coeficiente, 4)}</td>
                      <td className="dir num">{l.preco == null ? "—" : valor(l.preco)}</td>
                      <td className="dir num">{l.preco == null ? "—" : valor(Number(l.coeficiente) * Number(l.preco))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={6}>Custo unitário</td><td className="dir num">{i.semPreco ? "—" : valor(i.custoUnitario)}</td></tr></tfoot>
              </table>
            </div>
          ))}
        </Secao>

        <Secao numero={8} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Base de preços:</b> {ROTULO_FONTE[o.fonte]}, {o.uf}, {mesAno(o.mes)}, {ROTULO_REGIME[o.regime].toLowerCase()}. Preços congelados no momento do lançamento de cada item.</li>
            <li><b>Custo unitário:</b> soma de coeficiente × preço de cada insumo, com as composições auxiliares abertas até o insumo.</li>
            <li><b>BDI:</b> fórmula do Acórdão TCU 2.622/2013, faixas de referência para {ROTULO_TIPO_BDI[o.tipoObraBdi].toLowerCase()}.</li>
            <li><b>Arredondamento:</b> valores {o.arredondamento === "truncar" ? "truncados" : "arredondados"} em 2 casas decimais em cada item.</li>
            {itens.some((i) => i.fonte === "cotacao") && <li><b>Cotações:</b> no mínimo três por item, com o critério indicado em cada um (média, mediana ou menor preço).</li>}
          </ul>
        </Secao>

        <footer className="rel-assinaturas">
          <div>
            <span className="rel-linha-assinatura" />
            <b>{o.responsavelTecnico || "Responsável técnico"}</b>
            <span>{[o.registroProfissional, art].filter(Boolean).join(" · ") || "Registro profissional e ART/RRT"}</span>
          </div>
          <div>
            <span className="rel-linha-assinatura" />
            <b>{o.aprovadoPor || "Aprovação"}</b>
            <span>{o.aprovadoEm ? dataLonga(o.aprovadoEm) : "Data"}</span>
          </div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${usuario.orgaoNome} · Nota ${numeroNota ?? "em elaboração"} · gerada em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BarraComposicao, COR } from "@/componentes/relatorio/Graficos";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, dataLonga, moeda, percentual, quantidade, valor } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { formatarCnpj, rotuloContrato } from "@/servicos/contratos";
import { obterMedicao, ROTULO_PAGAMENTO, ROTULO_RETENCAO, ROTULO_SITUACAO_MEDICAO, ROTULO_TRAMITE, rotuloMedicao } from "@/servicos/medicoes";

export const metadata: Metadata = { title: "Boletim de medição" };

export default async function Boletim({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  let m;
  try {
    m = await obterMedicao(comoAtor(usuario), id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const n = Number;
  const direta = m.regime === "direta";
  const medidas = m.linhas.filter((l) => n(l.nesta) !== 0);
  const valorContrato = n(m.valorInicial);
  const anterior = n(m.acumuladoContrato) - n(m.bruto);
  const saldo = valorContrato - n(m.acumuladoContrato);
  const rotuloK = rotuloContrato({ numero: m.contratoNumero, regime: m.regime });
  const selo = { rascunho: "laranja", atestada: "neutro", aprovada: "verde", cancelada: "vermelho" } as const;

  // Resumo executivo: só fatos tirados do boletim.
  const resumo: string[] = [];
  if (medidas.length) {
    resumo.push(`${medidas.length} ${medidas.length === 1 ? "item medido" : "itens medidos"} no período de ${dataCurta(m.periodoInicio)} a ${dataCurta(m.periodoFim)}, somando ${moeda(m.bruto)}.`);
    const maior = [...medidas].sort((a, b) => n(b.valorNesta) - n(a.valorNesta))[0];
    if (medidas.length > 1) resumo.push(`O item de maior valor é ${maior.numero} ${maior.descricao.toLowerCase()}, com ${moeda(maior.valorNesta)} (${percentual((n(maior.valorNesta) / n(m.bruto)) * 100, 1)} da medição).`);
    resumo.push(`Com esta medição, o contrato chega a ${moeda(m.acumuladoContrato)} medidos, ${percentual(m.acumuladoPct, 1)} do valor contratado. Saldo de ${moeda(saldo)}.`);
    if (m.previstoPeriodo != null) {
      const d = n(m.bruto) - m.previstoPeriodo;
      resumo.push(`A linha de base do cronograma previa ${moeda(m.previstoPeriodo)} para o período. A medição ficou ${Math.abs(d) < 0.005 ? "igual ao previsto" : `${d > 0 ? "acima" : "abaixo"} em ${moeda(Math.abs(d))}`}.`);
    }
    if (n(m.glosa) > 0) resumo.push(`Glosas de ${moeda(m.glosa)} e retenções de ${moeda(m.retencao)}. Valor líquido de ${moeda(m.liquido)}.`);
    else if (n(m.retencao) > 0) resumo.push(`Retenções de ${moeda(m.retencao)}. Valor líquido de ${moeda(m.liquido)}.`);
  } else resumo.push("Boletim sem itens medidos.");

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/medicoes/${id}`} className="botao botao-neutro"><ArrowLeft /> Voltar à medição</Link>
        <BotaoImprimir />
        <a href={`/medicoes/${id}/excel`} className="botao botao-neutro"><FileSpreadsheet /> Planilha Excel</a>
      </div>

      <article className="rel">
        <CabecalhoRelatorio
          orgao={usuario.orgaoNome}
          tipo="Boletim de medição"
          titulo={rotuloMedicao(m)}
          subtitulo={`${m.obraCodigo} · ${m.obraNome}`}
          selo={{ texto: ROTULO_SITUACAO_MEDICAO[m.situacao], cor: selo[m.situacao] }}
          dados={[
            ["Contrato", `${rotuloK}${m.processo ? ` · processo ${m.processo}` : ""}`],
            ["Contratada", m.empresaNome ? `${m.empresaNome} · CNPJ ${formatarCnpj(m.empresaCnpj!)}` : "Equipe própria"],
            ["Objeto", m.objeto],
            ["Período", `${dataCurta(m.periodoInicio)} a ${dataCurta(m.periodoFim)}`],
            ["Fiscal", m.fiscalNome],
            ["Gestor do contrato", m.gestorNome],
            ["Atestação", m.atestadaEm ? `${dataHora(m.atestadaEm)} · ${m.atestadaPorNome}` : "Pendente"],
            ["Aprovação", m.aprovadaEm ? `${dataHora(m.aprovadaEm)} · ${m.aprovadaPorNome}` : "Pendente"],
          ]}
        />

        {m.ajuste && <p className="rel-alerta">Medição de ajuste: {m.observacao}</p>}

        <Secao numero={1} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Valor medido no período", valor: moeda(m.bruto), destaque: true },
            { rotulo: "Glosas", valor: moeda(m.glosa) },
            { rotulo: "Retenções", valor: moeda(m.retencao) },
            { rotulo: direta ? "Valor apropriado" : "Líquido a pagar", valor: moeda(m.liquido), detalhe: m.situacaoPagamento ? ROTULO_PAGAMENTO[m.situacaoPagamento] : undefined },
            { rotulo: "Acumulado no contrato", valor: percentual(m.acumuladoPct, 1), detalhe: moeda(m.acumuladoContrato) },
          ]} />
          <ul className="rel-pontos">{resumo.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Secao>

        <Secao numero={2} titulo="Execução financeira do contrato" descricao="Valor do contrato dividido entre o medido antes, esta medição e o saldo.">
          <BarraComposicao titulo="Valor do contrato (R$)" coluna="Parcela" rotuloTotal="Valor do contrato" fatias={[
            { rotulo: "Medições anteriores", valor: Math.max(0, anterior), cor: COR.bdi },
            { rotulo: "Esta medição", valor: Math.max(0, n(m.bruto)), cor: COR.maoDeObra },
            { rotulo: "Saldo", valor: Math.max(0, saldo), cor: "#c9d6da" },
          ]} />
          {m.previstoPeriodo != null && (
            <table className="rel-tabela" style={{ marginTop: 10 }}>
              <tbody>
                <tr><td>Previsto no período pela linha de base</td><td className="dir num">{moeda(m.previstoPeriodo)}</td></tr>
                <tr><td>Medido no período</td><td className="dir num">{moeda(m.bruto)}</td></tr>
                <tr><td>Previsto acumulado até {dataCurta(m.periodoFim)}</td><td className="dir num">{moeda(m.previstoAcumulado)}</td></tr>
                <tr><td>Medido acumulado</td><td className="dir num">{moeda(m.acumuladoContrato)}</td></tr>
              </tbody>
            </table>
          )}
        </Secao>

        <Secao numero={3} titulo="Planilha de medição" descricao="Quantidades em unidades do contrato. Valor = quantidade medida × preço unitário contratual.">
          <table className="rel-tabela rel-tabela-planilha rel-fixa">
            <colgroup>
              <col style={{ width: "5%" }} /><col /><col style={{ width: "5%" }} /><col style={{ width: "11%" }} /><col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} /><col style={{ width: "11%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} />
            </colgroup>
            <thead><tr><th>Item</th><th>Descrição</th><th>Und.</th><th className="dir">Contratado</th><th className="dir">Anterior</th><th className="dir">Nesta</th><th className="dir">Acumulado</th><th className="dir">Preço unit.</th><th className="dir">Valor</th></tr></thead>
            <tbody>
              {m.etapas.flatMap((e) => {
                const linhas = e.linhas.filter((l) => n(l.nesta) !== 0);
                if (!linhas.length) return [];
                return [
                  <tr key={e.nome} className="rel-linha-etapa"><td colSpan={8}>{e.nome}</td><td className="dir num">{valor(e.valorNesta)}</td></tr>,
                  ...linhas.map((l) => (
                    <tr key={l.itemServicoId}>
                      <td className="num">{l.numero}</td>
                      <td>{l.descricao}{l.memoria && <div className="rel-memoria">Memória: {l.memoria}</div>}</td>
                      <td>{l.unidade}</td>
                      <td className="dir num">{quantidade(l.contratado)}</td>
                      <td className="dir num">{quantidade(l.anterior)}</td>
                      <td className="dir num forte">{quantidade(l.nesta)}</td>
                      <td className="dir num">{quantidade(l.acumulado)}<div className="rel-memoria">{percentual(l.pctAcumulado, 1)}</div></td>
                      <td className="dir num">{valor(l.precoUnitario)}</td>
                      <td className="dir num forte">{valor(l.valorNesta)}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
            <tfoot><tr><td colSpan={8}>Valor medido no período (R$)</td><td className="dir num">{valor(m.bruto)}</td></tr></tfoot>
          </table>
        </Secao>

        <Secao numero={4} titulo={direta ? "Demonstrativo do valor" : "Demonstrativo do valor a pagar"}>
          <div className="rel-duas">
            <div>
            <table className="rel-tabela">
              <tbody>
                <tr><td>Valor medido</td><td className="dir num">{moeda(m.bruto)}</td></tr>
                {m.glosas.map((g) => <tr key={g.id}><td>(−) Glosa: {g.motivo}{g.itemNumero ? ` (item ${g.itemNumero})` : ""}</td><td className="dir num">{moeda(g.valor)}</td></tr>)}
                <tr className="rel-linha-etapa"><td>Valor da nota fiscal</td><td className="dir num">{moeda(n(m.bruto) - n(m.glosa))}</td></tr>
                {m.retencoes.map((r) => (
                  <tr key={r.id}><td>(−) {ROTULO_RETENCAO[r.tipo]}{r.descricao ? ` · ${r.descricao}` : ""}: {percentual(r.aliquota)} sobre {moeda(r.base)}</td><td className="dir num">{moeda(r.valor)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td>{direta ? "Valor apropriado" : "Líquido a pagar à contratada"}</td><td className="dir num">{moeda(m.liquido)}</td></tr></tfoot>
            </table>
            </div>
            {!direta && (
              <div>
              <table className="rel-tabela">
                <thead><tr><th>Pagamento</th><th>Empenho</th><th className="dir">Valor</th></tr></thead>
                <tbody>
                  {m.notas.map((x) => <tr key={x.id}><td colSpan={2}>Nota fiscal {x.numero} · {dataCurta(x.data)}</td><td className="dir num">{moeda(x.valor)}</td></tr>)}
                  {m.pagamentos.map((p) => <tr key={p.id}><td className="num">{dataCurta(p.data)}{p.ordemBancaria ? ` · ${p.ordemBancaria}` : ""}</td><td>{p.empenho}</td><td className="dir num">{moeda(p.valor)}</td></tr>)}
                  {m.pagamentos.length === 0 && <tr><td colSpan={3} className="fraco">Nenhum pagamento registrado.</td></tr>}
                </tbody>
                <tfoot><tr><td colSpan={2}>Falta pagar</td><td className="dir num">{moeda(m.aPagar)}</td></tr></tfoot>
              </table>
              </div>
            )}
          </div>
        </Secao>

        <Secao numero={5} titulo="Tramitação">
          <table className="rel-tabela">
            <thead><tr><th>Etapa</th><th>Responsável</th><th>Data e hora</th><th>Observação</th></tr></thead>
            <tbody>{m.tramites.map((t, i) => <tr key={i}><td>{ROTULO_TRAMITE[t.acao] ?? t.acao}</td><td>{t.por ?? "—"}</td><td className="num">{dataHora(new Date(t.em))}</td><td>{t.observacao ?? ""}</td></tr>)}</tbody>
          </table>
        </Secao>

        <Secao numero={6} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Quantidades:</b> lançadas sobre a planilha contratual, com memória de cálculo por item. O acumulado de cada item não passa da quantidade contratada.</li>
            <li><b>Preços:</b> preço unitário do contrato, com valores {m.arredondamento === "truncar" ? "truncados" : "arredondados"} em 2 casas, a mesma regra do orçamento de origem.</li>
            <li><b>Previsto:</b> valor distribuído igualmente pelos dias de trabalho de cada atividade da linha de base do cronograma.</li>
            {!direta && <li><b>Retenções:</b> base e alíquota informadas na medição, conforme a legislação aplicável ao contrato.</li>}
          </ul>
        </Secao>

        <footer className="rel-assinaturas">
          <div>
            <span className="rel-linha-assinatura" />
            <b>{m.atestadaPorNome ?? m.fiscalNome ?? "Fiscal do contrato"}</b>
            <span>Fiscal · {m.atestadaEm ? dataLonga(m.atestadaEm) : "Data"}</span>
          </div>
          <div>
            <span className="rel-linha-assinatura" />
            <b>{m.aprovadaPorNome ?? m.gestorNome ?? "Gestor do contrato"}</b>
            <span>Gestor do contrato · {m.aprovadaEm ? dataLonga(m.aprovadaEm) : "Data"}</span>
          </div>
          {!direta && (
            <div>
              <span className="rel-linha-assinatura" />
              <b>{m.empresaNome}</b>
              <span>Representante da contratada</span>
            </div>
          )}
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${usuario.orgaoNome} · ${rotuloK} · ${rotuloMedicao(m)} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}

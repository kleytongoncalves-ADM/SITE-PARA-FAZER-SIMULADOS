import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BarraComposicao, COR, Participacao } from "@/componentes/relatorio/Graficos";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, moeda, percentual, quantidade, valor } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterAditivo, ROTULO_SITUACAO_ADITIVO, rotuloAditivo } from "@/servicos/aditivos";
import { formatarCnpj, ROTULO_NATUREZA, rotuloContrato } from "@/servicos/contratos";

export const metadata: Metadata = { title: "Termo aditivo" };

export default async function TermoAditivo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  let d;
  try {
    d = await obterAditivo(comoAtor(usuario), id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const k = d.contrato;
  const n = Number;
  const rotuloK = rotuloContrato(k);
  const alterados = d.etapas.map((e) => ({ ...e, linhas: e.linhas.filter((l) => n(l.variacao) !== 0) })).filter((e) => e.linhas.length);
  const novos = d.linhas.filter((l) => l.novo);
  const acrescidos = d.linhas.filter((l) => !l.novo && n(l.variacao) > 0);
  const suprimidos = d.linhas.filter((l) => n(l.variacao) < 0);
  const temValor = n(d.acrescimo) !== 0 || n(d.supressao) !== 0;
  const selo = { rascunho: "laranja", assinado: "verde", cancelado: "vermelho" } as const;

  const resumo: string[] = [];
  if (temValor) {
    resumo.push(`O aditivo ${n(d.liquido) >= 0 ? "acresce" : "reduz"} o valor do contrato em ${moeda(Math.abs(n(d.liquido)))}, de ${moeda(d.valorAnterior)} para ${moeda(d.valorNovo)}.`);
    const partes = [
      acrescidos.length ? `${acrescidos.length} ${acrescidos.length === 1 ? "item com acréscimo" : "itens com acréscimo"}` : "",
      suprimidos.length ? `${suprimidos.length} ${suprimidos.length === 1 ? "item com supressão" : "itens com supressão"}` : "",
      novos.length ? `${novos.length} ${novos.length === 1 ? "serviço novo" : "serviços novos"}` : "",
    ].filter(Boolean);
    resumo.push(`Planilha: ${partes.join(", ")}.`);
    resumo.push(`Acréscimos acumulados de ${percentual(d.acrescimoAcumuladoPct, 2)} e supressões acumuladas de ${percentual(d.supressaoAcumuladoPct, 2)} do valor inicial atualizado. Limites de ${d.limiteAcrescimoPct}% e 25%.`);
  }
  if (d.prazoDias > 0) resumo.push(`O prazo de execução passa de ${d.prazoAnterior} para ${d.prazoNovo} dias corridos${d.fimExecucaoNovo ? `, com término em ${dataCurta(d.fimExecucaoNovo)}` : ""}.`);
  if (d.novaVigencia) resumo.push(`A vigência passa de ${dataCurta(d.vigenciaAnterior)} para ${dataCurta(d.novaVigencia)}.`);

  let clausula = 0;
  const ordinal = ["primeira", "segunda", "terceira", "quarta", "quinta", "sexta"];
  const proxima = () => `Cláusula ${ordinal[clausula++]}`;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/aditivos/${id}`} className="botao botao-neutro"><ArrowLeft /> Voltar ao aditivo</Link>
        <BotaoImprimir />
        <a href={`/aditivos/${id}/excel`} className="botao botao-neutro"><FileSpreadsheet /> Planilha Excel</a>
      </div>

      <article className="rel">
        <CabecalhoRelatorio
          orgao={usuario.orgaoNome}
          tipo="Termo aditivo"
          titulo={`${rotuloAditivo(d)} · ${rotuloK}`}
          subtitulo={`${k.obraCodigo} · ${k.obraNome}`}
          selo={{ texto: ROTULO_SITUACAO_ADITIVO[d.situacao], cor: selo[d.situacao] }}
          dados={[
            ["Contratante", usuario.orgaoNome],
            ["Contratada", k.empresaNome ? `${k.empresaNome} · CNPJ ${formatarCnpj(k.empresaCnpj!)}` : "Equipe própria"],
            ["Contrato", `${rotuloK}${k.processo ? ` · processo ${k.processo}` : ""} · assinado em ${dataCurta(k.dataAssinatura)}`],
            ["Objeto do contrato", k.objeto],
            ["Natureza", ROTULO_NATUREZA[k.natureza]],
            ["Assinatura do aditivo", d.dataAssinatura ? dataCurta(d.dataAssinatura) : "Pendente"],
          ]}
        />

        {d.situacao === "cancelado" && <p className="rel-alerta">Aditivo cancelado: {d.canceladoMotivo}</p>}

        <Secao numero={1} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Acréscimos", valor: moeda(d.acrescimo), detalhe: percentual(d.acrescimoPct, 2) },
            { rotulo: "Supressões", valor: moeda(d.supressao), detalhe: percentual(d.supressaoPct, 2) },
            { rotulo: "Valor após o aditivo", valor: moeda(d.valorNovo), destaque: true, detalhe: `antes ${moeda(d.valorAnterior)}` },
            { rotulo: "Prazo de execução", valor: d.prazoNovo != null ? `${d.prazoNovo} dias` : "—", detalhe: d.prazoDias ? `+${d.prazoDias} dias` : "sem alteração" },
            { rotulo: "Vigência", valor: dataCurta(d.vigenciaNova), detalhe: d.novaVigencia ? `antes ${dataCurta(d.vigenciaAnterior)}` : "sem alteração" },
          ]} />
          <ul className="rel-pontos">{resumo.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Secao>

        <Secao numero={2} titulo="Cláusulas">
          <div className="rel-clausulas">
            <p><b>{proxima()} · Do objeto.</b> {d.objeto}.</p>
            <p><b>{proxima()} · Da justificativa.</b> {d.justificativa}</p>
            {temValor && (
              <p><b>{proxima()} · Do valor.</b> Ficam {[n(d.acrescimo) ? `acrescidos ${moeda(d.acrescimo)}` : "", n(d.supressao) ? `suprimidos ${moeda(d.supressao)}` : ""].filter(Boolean).join(" e ")} na planilha contratual,
                conforme a seção 3, aos preços unitários do contrato{novos.length ? " e, para os serviços novos, aos preços indicados" : ""}. O valor do contrato passa a {moeda(d.valorNovo)}.</p>
            )}
            {(d.prazoDias > 0 || d.novaVigencia) && (
              <p><b>{proxima()} · Do prazo.</b> {d.prazoDias > 0 ? `O prazo de execução fica prorrogado em ${d.prazoDias} dias corridos, totalizando ${d.prazoNovo} dias${d.fimExecucaoNovo ? `, com término em ${dataCurta(d.fimExecucaoNovo)}` : ""}.` : ""}
                {d.novaVigencia ? ` A vigência do contrato fica prorrogada até ${dataCurta(d.novaVigencia)}.` : ""}</p>
            )}
            <p><b>{proxima()} · Do fundamento.</b> {d.fundamento ?? "Lei 14.133/2021, arts. 124 e 125"}.</p>
            <p><b>{proxima()} · Da ratificação.</b> Ficam mantidas as demais cláusulas e condições do contrato original e dos termos anteriores.</p>
          </div>
        </Secao>

        {temValor && (
          <Secao numero={3} titulo="Planilha do aditivo" descricao="Somente os itens alterados. Valor = variação × preço unitário do contrato.">
            <table className="rel-tabela rel-tabela-planilha rel-fixa">
              <colgroup>
                <col style={{ width: "7%" }} /><col /><col style={{ width: "5%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} />
              </colgroup>
              <thead><tr><th>Item</th><th>Descrição</th><th>Und.</th><th className="dir">Preço unit.</th><th className="dir">Qtd. atual</th><th className="dir">Variação</th><th className="dir">Nova qtd.</th><th className="dir">Valor</th></tr></thead>
              <tbody>
                {alterados.flatMap((e) => [
                  <tr key={e.nome} className="rel-linha-etapa"><td colSpan={7}>{e.nome}</td><td className="dir num">{valor(e.valorVariacao)}</td></tr>,
                  ...e.linhas.map((l) => (
                    <tr key={l.itemServicoId}>
                      <td className="num">{l.numero}</td>
                      <td>{l.descricao}{l.novo && <div className="rel-memoria">Serviço novo{l.codigo ? ` · código ${l.codigo}` : ""}</div>}</td>
                      <td>{l.unidade}</td>
                      <td className="dir num">{valor(l.precoUnitario)}</td>
                      <td className="dir num">{quantidade(l.anterior)}</td>
                      <td className="dir num forte">{n(l.variacao) > 0 ? "+" : ""}{quantidade(l.variacao)}</td>
                      <td className="dir num">{quantidade(l.nova)}</td>
                      <td className="dir num forte">{valor(l.valorVariacao)}</td>
                    </tr>
                  )),
                ])}
              </tbody>
              <tfoot>
                <tr><td colSpan={7}>Acréscimos (R$)</td><td className="dir num">{valor(d.acrescimo)}</td></tr>
                <tr><td colSpan={7}>Supressões (R$)</td><td className="dir num">{Number(d.supressao) ? "−" : ""}{valor(d.supressao)}</td></tr>
                <tr><td colSpan={7}>Variação do valor do contrato (R$)</td><td className="dir num">{valor(d.liquido)}</td></tr>
              </tfoot>
            </table>
          </Secao>
        )}

        <Secao numero={temValor ? 4 : 3} titulo="Limites legais" descricao="Lei 14.133/2021, art. 125, sobre o valor inicial atualizado pelos reajustes. Acréscimos e supressões são somados separadamente.">
          <div className="rel-duas">
            <div>
              <table className="rel-tabela">
                <thead><tr><th>Referência</th><th className="dir">Valor</th><th className="dir">Uso do limite</th></tr></thead>
                <tbody>
                  <tr><td>Valor inicial atualizado</td><td className="dir num">{moeda(d.base)}</td><td /></tr>
                  <tr><td>Acréscimos acumulados</td><td className="dir num">{moeda(d.acrescimoAcumulado)}</td>
                    <td className="dir"><Participacao pct={d.limiteAcrescimoPct ? (d.acrescimoAcumuladoPct / d.limiteAcrescimoPct) * 100 : 0} cor={COR.maoDeObra} /></td></tr>
                  <tr><td>Limite de acréscimo ({d.limiteAcrescimoPct}%)</td><td className="dir num">{moeda(d.limiteAcrescimo)}</td><td /></tr>
                  <tr><td>Supressões acumuladas</td><td className="dir num">{moeda(d.supressaoAcumulado)}</td>
                    <td className="dir"><Participacao pct={(d.supressaoAcumuladoPct / 25) * 100} cor={COR.bdi} /></td></tr>
                  <tr><td>Limite de supressão (25%)</td><td className="dir num">{moeda(d.limiteSupressao)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            <div>
              <BarraComposicao titulo="Valor do contrato após o aditivo (R$)" coluna="Parcela" rotuloTotal="Valor após o aditivo" fatias={[
                { rotulo: "Valor anterior mantido", valor: Math.max(0, n(d.valorAnterior) - n(d.supressao)), cor: "#c9d6da" },
                { rotulo: "Acréscimos deste aditivo", valor: n(d.acrescimo), cor: COR.maoDeObra },
              ]} />
            </div>
          </div>
        </Secao>

        <Secao numero={temValor ? 5 : 4} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Quantidade atual:</b> quantidade da planilha inicial somada às variações dos aditivos assinados antes deste.</li>
            <li><b>Preços:</b> preço unitário do contrato, com valores {k.arredondamento === "truncar" ? "truncados" : "arredondados"} em 2 casas. Serviços novos com preço e fonte informados no aditivo.</li>
            <li><b>Supressões:</b> nenhuma quantidade fica abaixo do já medido no item.</li>
            <li><b>Prazo:</b> dias corridos contados da ordem de serviço ({dataCurta(k.dataOrdemServico)}).</li>
          </ul>
        </Secao>

        <footer className="rel-assinaturas">
          <div>
            <span className="rel-linha-assinatura" />
            <b>{k.gestorNome ?? "Gestor do contrato"}</b>
            <span>Pela contratante · {usuario.orgaoNome}</span>
          </div>
          {k.empresaNome && (
            <div>
              <span className="rel-linha-assinatura" />
              <b>{k.empresaNome}</b>
              <span>Representante da contratada</span>
            </div>
          )}
          <div>
            <span className="rel-linha-assinatura" />
            <b>{k.fiscalNome ?? "Fiscal do contrato"}</b>
            <span>Fiscal do contrato</span>
          </div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${usuario.orgaoNome} · ${rotuloK} · ${rotuloAditivo(d)} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}

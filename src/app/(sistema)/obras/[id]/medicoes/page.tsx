import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EtiquetaMedicao, EtiquetaPagamento } from "@/componentes/Etiquetas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta, moeda, percentual } from "@/lib/formato";
import { listarContratos, rotuloContrato } from "@/servicos/contratos";
import { extratoDoContrato, rotuloMedicao, sugestaoPeriodo } from "@/servicos/medicoes";
import { pode } from "@/servicos/permissoes";
import { acaoNovaMedicao } from "../../../medicoes/acoes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Medições da obra" };

export default async function MedicoesDaObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="medicoes" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "medicao.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa medições</b></div></>;
  const contratos = (await listarContratos(ator, { obraId: id })).filter((k) => k.situacao !== "rascunho");
  const extratos = await Promise.all(contratos.map(async (k) => ({
    k, e: await extratoDoContrato(ator, k.id),
    sugestao: k.situacao === "vigente" && pode(ator, "medicao.elaborar") ? await sugestaoPeriodo(ator, k.id) : null,
  })));

  return (
    <>
      {cab}
      {extratos.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum contrato assinado</b>A medição é lançada sobre a planilha do contrato assinado.</div>
      ) : (
        <div className="grade">
          {extratos.map(({ k, e, sugestao }) => {
            const aberta = e.medicoes.find((m) => (m.situacao === "rascunho" || m.situacao === "atestada") && !m.ajuste);
            return (
              <section key={k.id} className="grade surgir">
                <div className="barra-acoes">
                  <div>
                    <h2 className="cartao-titulo"><Link href={`/contratos/${k.id}`}>{rotuloContrato(k)}</Link></h2>
                    <span className="cartao-sub">{k.empresaNome ?? "Equipe própria"} · {k.objeto}</span>
                  </div>
                </div>
                <div className="indicadores">
                  <div className="indicador"><span>Valor do contrato</span><b className="num">{moeda(e.valorContrato)}</b></div>
                  <div className="indicador"><span>Medido</span><b className="num">{moeda(e.medido)}</b><small className="num">{percentual(e.executadoPct, 1)} do contrato</small>
                    <div className="trilho-progresso" aria-hidden><i style={{ width: `${Math.min(100, Math.max(0, e.executadoPct))}%` }} /></div></div>
                  <div className="indicador"><span>{k.regime === "direta" ? "Apropriado" : "Pago"}</span><b className="num">{moeda(k.regime === "direta" ? e.liquido : e.pago)}</b>
                    {k.regime !== "direta" && <small className="num">A pagar {moeda(e.aPagar)} · retido {moeda(e.retido)}</small>}</div>
                  <div className="indicador indicador-destaque"><span>Saldo do contrato</span><b className="num">{moeda(e.saldo)}</b></div>
                </div>

                {sugestao && (
                  <div className="cartao">
                    {aberta ? (
                      <p className="cartao-sub">A <Link href={`/medicoes/${aberta.id}`} className="forte">{rotuloMedicao(aberta)}</Link> está em andamento.</p>
                    ) : (
                      <FormAcao acao={acaoNovaMedicao.bind(null, k.id)} className="form-linha form-base">
                        <div className="campo"><label htmlFor={`ini-${k.id}`}>Início do período</label><input id={`ini-${k.id}`} name="periodoInicio" type="date" className="entrada-texto" required defaultValue={sugestao.inicio} /></div>
                        <div className="campo"><label htmlFor={`fim-${k.id}`}>Fim do período</label><input id={`fim-${k.id}`} name="periodoFim" type="date" className="entrada-texto" required defaultValue={sugestao.fim} /></div>
                        <BotaoEnviar enviando="Abrindo…"><Plus /> Nova medição</BotaoEnviar>
                      </FormAcao>
                    )}
                    {e.medicoes.some((m) => m.situacao === "aprovada") && (
                      <details className="detalhe-acao" style={{ marginTop: 12 }}>
                        <summary>Medição de ajuste</summary>
                        <FormAcao acao={acaoNovaMedicao.bind(null, k.id)} className="form-linha form-base" style={{ marginTop: 10 }}>
                          <input type="hidden" name="ajuste" value="sim" />
                          <div className="campo"><label htmlFor={`aini-${k.id}`}>Início</label><input id={`aini-${k.id}`} name="periodoInicio" type="date" className="entrada-texto" required defaultValue={k.dataOrdemServico ?? ""} /></div>
                          <div className="campo"><label htmlFor={`afim-${k.id}`}>Fim</label><input id={`afim-${k.id}`} name="periodoFim" type="date" className="entrada-texto" required defaultValue={sugestao.fim} /></div>
                          <div className="campo" style={{ flex: 1, minWidth: 220 }}><label htmlFor={`amot-${k.id}`}>Motivo</label><input id={`amot-${k.id}`} name="observacao" className="entrada-texto" required /></div>
                          <BotaoEnviar className="botao botao-neutro" enviando="Abrindo…"><Plus /> Abrir ajuste</BotaoEnviar>
                        </FormAcao>
                      </details>
                    )}
                  </div>
                )}

                {e.medicoes.length === 0 ? <div className="cartao vazio"><b>Nenhuma medição</b></div> : (
                  <div className="tabela-caixa">
                    <table className="tabela">
                      <thead><tr><th>Medição</th><th>Período</th><th>Situação</th><th className="dir">Medido</th><th className="dir">Glosas</th><th className="dir">Retenções</th><th className="dir">Líquido</th><th className="dir">Pago</th></tr></thead>
                      <tbody>
                        {e.medicoes.map((m) => (
                          <tr key={m.id} className={m.situacao === "cancelada" ? "linha-apagada" : ""}>
                            <td><Link href={`/medicoes/${m.id}`} className="forte sem-quebra">{rotuloMedicao(m)}</Link></td>
                            <td className="num">{dataCurta(m.periodoInicio)} a {dataCurta(m.periodoFim)}</td>
                            <td><EtiquetaMedicao situacao={m.situacao} />{m.situacaoPagamento && <> <EtiquetaPagamento situacao={m.situacaoPagamento} /></>}</td>
                            <td className="dir num forte">{moeda(m.bruto)}</td>
                            <td className="dir num">{Number(m.glosa) ? moeda(m.glosa) : "—"}</td>
                            <td className="dir num">{Number(m.retencao) ? moeda(m.retencao) : "—"}</td>
                            <td className="dir num">{moeda(m.liquido)}</td>
                            <td className="dir num">{m.situacao === "aprovada" && k.regime !== "direta" ? moeda(m.pago) : "—"}</td>
                          </tr>
                        ))}
                        <tr className="linha-total"><td colSpan={3}>Aprovado</td><td className="dir num">{moeda(e.medido)}</td><td className="dir num">{moeda(e.glosado)}</td>
                          <td className="dir num">{moeda(e.retido)}</td><td className="dir num">{moeda(e.liquido)}</td><td className="dir num">{k.regime !== "direta" ? moeda(e.pago) : "—"}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

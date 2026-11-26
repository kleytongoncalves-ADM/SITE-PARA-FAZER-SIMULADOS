import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { dataHoraCurta, difPct } from "@/componentes/cotacao/Pecas";
import { moeda, percentual, quantidade, valor } from "@/lib/formato";
import { FATORES, ROTULO_CRITERIO_APURACAO, ROTULO_FATOR } from "@/servicos/cotacao-calculo";
import { carregarSolicitacao } from "./carregar";

export const metadata: Metadata = { title: "Cotação" };

export default async function ResumoCotacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  const m = s.precosVisiveis ? s.mapa : null;
  const ap = s.apuracoes[0] ?? null;
  const resultado = ap?.resultado ?? s.previa;
  const ref = Number(s.totalReferencia);
  const maior = m ? Math.max(ref, ...m.fornecedores.map((f) => Number(f.total))) || 1 : 1;
  const semRef = s.materiais.filter((x) => x.precoReferencia == null).length;
  const proximo = s.situacao === "rascunho" ? { href: "fornecedores", rotulo: s.convites.length ? "Revisar e enviar" : "Convidar fornecedores" }
    : s.situacao === "aberta" ? { href: "fornecedores", rotulo: "Acompanhar respostas" }
    : s.situacao === "encerrada" ? { href: "apuracao", rotulo: "Apurar resultado" }
    : s.situacao === "apurada" ? { href: "relatorio", rotulo: "Abrir relatório" } : null;

  return (
    <div className="grade">
      <div className="indicadores" style={{ marginBottom: 0 }}>
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Referência do orçamento</span><b className="num">{moeda(s.totalReferencia)}</b>
          <small>{s.materiais.length} {s.materiais.length === 1 ? "material" : "materiais"}{semRef ? ` · ${semRef} sem preço de referência` : ""}</small></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Respostas</span><b className="num">{s.respondidas} de {s.convites.length}</b>
          <small>{s.situacao === "rascunho" ? "Solicitação ainda não enviada" : `${s.pendentes} sem resposta · ${s.declinaram} ${s.declinaram === 1 ? "declinou" : "declinaram"}`}</small></div>
        {m ? (
          <>
            <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Menor proposta completa</span><b className="num">{m.menorGlobal ? moeda(m.menorGlobal.total) : "—"}</b>
              <small>{m.menorGlobal ? m.menorGlobal.fornecedor : "Nenhum fornecedor cotou todos os itens"}</small></div>
            <div className={`indicador surgir${Number(resultado?.economia ?? m.economiaPorItem) > 0 ? " indicador-destaque" : ""}`} style={{ "--i": 3 } as React.CSSProperties}>
              <span>{ap ? "Economia homologada" : "Economia possível"}</span>
              <b className="num">{moeda(resultado?.economia ?? m.economiaPorItem)}</b>
              <small>{resultado?.economiaPct != null ? `${percentual(resultado.economiaPct, 1)} sobre a referência` : m.economiaPorItemPct != null ? `${percentual(m.economiaPorItemPct, 1)} com o menor preço de cada item` : "Sem referência para comparar"}</small></div>
          </>
        ) : (
          <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Prazo de resposta</span><b className="num" style={{ fontSize: 20 }}>{dataHoraCurta(s.prazo)}</b>
            <small>{s.sigilo && s.situacao === "aberta" ? "Preços liberados no encerramento" : "Horário de Brasília"}</small></div>
        )}
      </div>

      {ap && resultado && (
        <div className="cot-resultado surgir">
          <span>Resultado homologado · {ROTULO_CRITERIO_APURACAO[ap.criterio]}</span>
          <b>{resultado.vencedor ? resultado.vencedor.fornecedor : `${new Set(resultado.itens.filter((i) => i.conviteId).map((i) => i.conviteId)).size} fornecedores vencedores`} · {moeda(ap.totalResultado)}</b>
          <small>Homologado por {ap.homologadaPor ?? "—"} em {dataHoraCurta(ap.homologadaEm)}</small>
        </div>
      )}

      {s.sigilo && s.situacao === "aberta" && s.respondidas > 0 && (
        <div className="aviso aviso-info"><EyeOff /><span>{s.respondidas} {s.respondidas === 1 ? "proposta recebida" : "propostas recebidas"}. Os preços aparecem quando o recebimento for encerrado.</span></div>
      )}

      {m && m.fornecedores.length > 0 && (
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Total por fornecedor</h2>
          <p className="cartao-sub">Soma dos itens cotados, em R$. A marca laranja indica a referência do orçamento ({moeda(s.totalReferencia)}).</p>
          <ul className="cot-barras">
            {[...m.fornecedores].sort((a, b) => Number(b.completa) - Number(a.completa) || Number(a.total) - Number(b.total)).map((f) => (
              <li key={f.conviteId}>
                <span>{f.fornecedor}<div className="fraco" style={{ fontWeight: 450 }}>{f.completa ? "Todos os itens" : `${f.itensCotados} de ${f.itens} itens`}{f.difSinapi != null && <span className={`cot-dif ${f.classe}`}>{difPct(f.difSinapi)}</span>}</div></span>
                <span className="cot-barras-trilho">
                  <i className={`${m.menorGlobal?.conviteId === f.conviteId ? "menor" : ""} ${f.completa ? "" : "parcial"}`} style={{ width: `${(Number(f.total) / maior) * 100}%` }} />
                  {ref > 0 && <u style={{ left: `${(ref / maior) * 100}%` }} title="Referência do orçamento" />}
                </span>
                <b className="num">{moeda(f.total)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cot-duas">
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Condições</h2>
          <dl className="dados" style={{ marginTop: 14 }}>
            <div><dt>Prazo de resposta</dt><dd className="num">{dataHoraCurta(s.prazo)}</dd></div>
            <div><dt>Critério</dt><dd>{ROTULO_CRITERIO_APURACAO[s.criterio]}</dd></div>
            {s.criterio === "custo_beneficio" && <div><dt>Pesos</dt><dd>{FATORES.filter((k) => s.pesos[k] > 0).map((k) => `${ROTULO_FATOR[k]} ${s.pesos[k]}`).join(" · ")}</dd></div>}
            <div><dt>Frete</dt><dd>{s.freteIncluso ? "Incluso no preço" : "Informado à parte"}</dd></div>
            <div><dt>Validade mínima</dt><dd>{s.validadeMinima ? `${s.validadeMinima} dias` : "Não exigida"}</dd></div>
            <div><dt>Propostas</dt><dd>{s.sigilo ? "Fechadas até o prazo" : "Visíveis ao chegar"}</dd></div>
            <div><dt>Local de entrega</dt><dd>{s.localEntrega ?? "—"}</dd></div>
            <div><dt>Criada por</dt><dd>{s.criadoPor ?? "—"}</dd></div>
            <div><dt>Enviada em</dt><dd className="num">{s.enviadaEm ? dataHoraCurta(s.enviadaEm) : "Não enviada"}</dd></div>
            {s.justificativaMinimo && <div style={{ gridColumn: "1 / -1" }}><dt>Menos de três convites</dt><dd style={{ fontWeight: 450 }}>{s.justificativaMinimo}</dd></div>}
            {s.observacao && <div style={{ gridColumn: "1 / -1" }}><dt>Observações aos fornecedores</dt><dd style={{ whiteSpace: "pre-wrap", fontWeight: 450 }}>{s.observacao}</dd></div>}
          </dl>
          {proximo && <div className="rodape-form"><Link href={`/cotacoes/${id}/${proximo.href}`} className="botao botao-primario">{proximo.rotulo} <ArrowRight /></Link></div>}
        </section>

        {m && (
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Cobertura</h2>
            <dl className="dados" style={{ marginTop: 14 }}>
              <div><dt>Itens com proposta</dt><dd className="num">{m.itensCotados} de {m.linhas.length}</dd></div>
              <div><dt>Itens com três preços ou mais</dt><dd className="num">{m.itensComTres} de {m.linhas.length}</dd></div>
              <div><dt>Soma dos menores preços</dt><dd className="num">{moeda(m.somaMenores)}</dd></div>
              <div><dt>Comprar tudo de um fornecedor</dt><dd className="num">{m.custoConcentrar ? `+ ${moeda(m.custoConcentrar)}` : "—"}</dd></div>
              <div><dt>Preços fora do padrão</dt><dd className="num">{m.discrepantes}</dd></div>
              <div><dt>Avaliações registradas</dt><dd className="num">{s.avaliacoes.length}</dd></div>
            </dl>
          </section>
        )}
      </div>

      <section className="surgir">
        <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Materiais</h2>
        <div className="tabela-caixa">
          <table className="tabela tabela-compacta">
            <thead><tr><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Quantidade</th><th className="dir">Preço de referência</th><th className="dir">Total de referência</th>{m && <><th className="dir">Menor preço</th><th className="dir">Diferença</th></>}</tr></thead>
            <tbody>{(m ? m.linhas : s.materiais.map((x) => ({ material: x, refTotal: x.precoReferencia == null ? null : String(Number(x.precoReferencia) * Number(x.quantidade)), menor: null, ofertas: [] as { conviteId: string; difSinapi: number | null; classe: string | null }[] }))).map((l) => {
              const o = l.menor ? l.ofertas.find((x) => x.conviteId === l.menor!.conviteId) : null;
              return (
                <tr key={l.material.id}>
                  <td className="num sem-quebra">{l.material.semSinapi ? "—" : l.material.codigo}</td>
                  <td style={{ minWidth: 240 }}>{l.material.descricao}</td>
                  <td>{l.material.unidade}</td>
                  <td className="dir num">{quantidade(l.material.quantidade)}</td>
                  <td className="dir num">{l.material.precoReferencia == null ? "—" : valor(l.material.precoReferencia)}</td>
                  <td className="dir num">{l.refTotal == null ? "—" : valor(l.refTotal)}</td>
                  {m && <><td className="dir num forte">{l.menor ? valor(l.menor.preco) : "—"}</td><td className="dir num">{o?.difSinapi != null ? <span className={`cot-dif ${o.classe}`}>{difPct(o.difSinapi)}</span> : "—"}</td></>}
                </tr>
              );
            })}</tbody>
            <tfoot><tr><td colSpan={5} className="forte">Total de referência (R$)</td><td className="dir num forte">{valor(s.totalReferencia)}</td>{m && <><td className="dir num forte">{valor(m.somaMenores)}</td><td /></>}</tr></tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

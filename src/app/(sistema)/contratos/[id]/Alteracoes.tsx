import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EtiquetaAditivo } from "@/componentes/Etiquetas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta, moeda, percentual } from "@/lib/formato";
import { FUNDAMENTOS, ROTULO_REVISAO, rotuloAditivo, type Alteracoes as Dados } from "@/servicos/aditivos";
import { INDICES } from "@/servicos/contratos";
import { acaoNovoAditivo, acaoRevisao } from "../../aditivos/acoes";

function Medidor({ rotulo, usado, limite, valor, saldo }: { rotulo: string; usado: number; limite: number; valor: string; saldo: string }) {
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  return (
    <div className="medidor-limite">
      <div className="medidor-topo"><span>{rotulo}</span><b className="num">{percentual(usado, 2)} de {limite}%</b></div>
      <div className={`trilho-progresso${pct >= 90 ? " trilho-alerta" : ""}`} aria-hidden><i style={{ width: `${pct}%` }} /></div>
      <small className="num">{moeda(valor)} usados · disponível {moeda(saldo)}</small>
    </div>
  );
}

export function Alteracoes({ d }: { d: Dados }) {
  const k = d.contrato;
  const aberto = d.aditivos.find((a) => a.situacao === "rascunho");
  return (
    <section className="cartao surgir" id="aditivos" style={{ minWidth: 0 }}>
      <div className="barra-acoes">
        <h2 className="cartao-titulo">Aditivos e apostilamentos</h2>
        <span className="cartao-sub" style={{ marginLeft: "auto" }}>Base dos limites: valor inicial atualizado {moeda(d.base)}</span>
      </div>

      <div className="limites-aditivo">
        <Medidor rotulo="Acréscimos" usado={d.acrescimoPct} limite={d.limiteAcrescimoPct} valor={k.acrescimos} saldo={d.saldoAcrescimo} />
        <Medidor rotulo="Supressões" usado={d.supressaoPct} limite={25} valor={k.supressoes} saldo={d.saldoSupressao} />
        <div className="medidor-limite">
          <div className="medidor-topo"><span>Reajuste acumulado</span><b className="num">{percentual(d.reajustePct, 2)}</b></div>
          <small className="num">
            {k.regime === "direta" ? "Execução direta, sem reajuste" : d.proximoReajuste ? `Próximo reajuste a partir de ${dataCurta(d.proximoReajuste)}` : "Sem data-base"}
            {k.indiceReajuste ? ` · ${k.indiceReajuste}` : ""}
          </small>
        </div>
      </div>

      <h3 className="subtitulo-secao">Termos aditivos</h3>
      {d.aditivos.length === 0 ? <p className="cartao-sub">Nenhum aditivo.</p> : (
        <div className="tabela-caixa">
          <table className="tabela tabela-compacta">
            <thead><tr><th>Termo</th><th>Objeto</th><th>Situação</th><th className="dir">Acréscimo</th><th className="dir">Supressão</th><th className="dir">Prazo</th><th>Nova vigência</th><th>Assinatura</th></tr></thead>
            <tbody>
              {d.aditivos.map((a) => (
                <tr key={a.id} className={a.situacao === "cancelado" ? "linha-apagada" : ""}>
                  <td><Link href={`/aditivos/${a.id}`} className="forte sem-quebra">{rotuloAditivo(a)}</Link></td>
                  <td>{a.objeto}</td>
                  <td><EtiquetaAditivo situacao={a.situacao} /></td>
                  <td className="dir num">{Number(a.acrescimo) ? moeda(a.acrescimo) : "—"}</td>
                  <td className="dir num">{Number(a.supressao) ? moeda(a.supressao) : "—"}</td>
                  <td className="dir num">{a.prazoDias ? `+${a.prazoDias} dias` : "—"}</td>
                  <td className="num">{dataCurta(a.novaVigencia)}</td>
                  <td className="num">{dataCurta(a.dataAssinatura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.podeElaborar && (aberto ? (
        <p className="cartao-sub" style={{ marginTop: 10 }}>O <Link href={`/aditivos/${aberto.id}`} className="forte">{rotuloAditivo(aberto)}</Link> está em elaboração.</p>
      ) : (
        <details className="detalhe-acao" style={{ marginTop: 12 }}>
          <summary>Novo termo aditivo</summary>
          <FormAcao acao={acaoNovoAditivo.bind(null, k.id)} className="grade-form" style={{ marginTop: 10 }}>
            <div className="campo c6"><label htmlFor="ad-objeto">Objeto</label><input id="ad-objeto" name="objeto" className="entrada-texto" required placeholder="Acréscimo de serviços e prorrogação de prazo" /></div>
            <div className="campo c6"><label htmlFor="ad-fund">Fundamento legal</label>
              <input id="ad-fund" name="fundamento" className="entrada-texto" list="fundamentos" defaultValue={FUNDAMENTOS[1]} />
              <datalist id="fundamentos">{FUNDAMENTOS.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
            <div className="campo c12"><label htmlFor="ad-just">Justificativa técnica</label><textarea id="ad-just" name="justificativa" className="entrada-texto" rows={3} required /></div>
            <div className="campo c3"><label htmlFor="ad-prazo">Acréscimo de prazo (dias)</label><input id="ad-prazo" name="prazoDias" type="number" min={0} className="entrada-texto num" defaultValue={0} /></div>
            <div className="campo c3"><label htmlFor="ad-vig">Nova vigência</label><input id="ad-vig" name="novaVigencia" type="date" className="entrada-texto" /></div>
            <div className="c6 rodape-form"><BotaoEnviar enviando="Abrindo…"><Plus /> Abrir aditivo</BotaoEnviar></div>
          </FormAcao>
        </details>
      ))}

      <h3 className="subtitulo-secao">Apostilamentos de reajuste e reequilíbrio</h3>
      {d.revisoes.length === 0 ? <p className="cartao-sub">Nenhum apostilamento.</p> : (
        <div className="tabela-caixa">
          <table className="tabela tabela-compacta">
            <thead><tr><th>Apostilamento</th><th>Tipo</th><th>Base de cálculo</th><th className="dir">Percentual</th><th>Início</th><th className="dir">Acumulado</th><th className="dir">Impacto no saldo</th><th /></tr></thead>
            <tbody>
              {d.revisoes.map((r) => (
                <tr key={r.id}>
                  <td className="forte sem-quebra">{r.numero}º</td>
                  <td>{ROTULO_REVISAO[r.tipo]}</td>
                  <td>{r.tipo === "reajuste" ? <span className="num">{r.indice}: {Number(r.indiceBase).toLocaleString("pt-BR")} → {Number(r.indiceAtual).toLocaleString("pt-BR")}</span> : r.documento}</td>
                  <td className="dir num">{percentual(r.percentual, 4)}</td>
                  <td className="num">{dataCurta(r.inicio)}</td>
                  <td className="dir num">{percentual((Number(r.fatorAcumulado) - 1) * 100, 4)}</td>
                  <td className="dir num">{moeda(r.valorImpacto)}</td>
                  <td><Link href={`/apostilamentos/${r.id}`} className="botao botao-neutro botao-pequeno"><FileText /> Termo</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.podeRegistrarRevisao && (
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", marginTop: 12, gap: 12 }}>
          <details className="detalhe-acao">
            <summary>Registrar reajuste</summary>
            <FormAcao acao={acaoRevisao.bind(null, k.id)} className="grade-form" style={{ marginTop: 10 }} limpar>
              <input type="hidden" name="tipo" value="reajuste" />
              <div className="campo c6"><label htmlFor="rj-ind">Índice</label>
                <input id="rj-ind" name="indice" className="entrada-texto" list="indices" required defaultValue={k.indiceReajuste ?? "INCC-DI"} />
                <datalist id="indices">{INDICES.map((i) => <option key={i} value={i} />)}</datalist>
              </div>
              <div className="campo c6"><label htmlFor="rj-ini">Novos preços a partir de</label><input id="rj-ini" name="inicio" type="date" className="entrada-texto" required defaultValue={d.proximoReajuste ?? ""} /></div>
              <div className="campo c6"><label htmlFor="rj-base">Número-índice da data-base</label><input id="rj-base" name="indiceBase" className="entrada-texto num" inputMode="decimal" required /></div>
              <div className="campo c6"><label htmlFor="rj-atual">Número-índice atual</label><input id="rj-atual" name="indiceAtual" className="entrada-texto num" inputMode="decimal" required /></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><Plus /> Registrar reajuste</BotaoEnviar></div>
            </FormAcao>
          </details>
          <details className="detalhe-acao">
            <summary>Registrar reequilíbrio</summary>
            <FormAcao acao={acaoRevisao.bind(null, k.id)} className="grade-form" style={{ marginTop: 10 }} limpar>
              <input type="hidden" name="tipo" value="reequilibrio" />
              <div className="campo c6"><label htmlFor="re-pct">Percentual (%)</label><input id="re-pct" name="percentual" className="entrada-texto num" inputMode="decimal" required /></div>
              <div className="campo c6"><label htmlFor="re-ini">Novos preços a partir de</label><input id="re-ini" name="inicio" type="date" className="entrada-texto" required /></div>
              <div className="campo c12"><label htmlFor="re-doc">Processo ou parecer</label><input id="re-doc" name="documento" className="entrada-texto" required /></div>
              <div className="campo c12"><label htmlFor="re-just">Justificativa</label><textarea id="re-just" name="justificativa" className="entrada-texto" rows={2} required /></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><Plus /> Registrar reequilíbrio</BotaoEnviar></div>
            </FormAcao>
          </details>
        </div>
      )}
    </section>
  );
}

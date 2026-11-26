import Link from "next/link";
import { CalendarClock, Lock, RotateCcw, Trash2, XCircle } from "lucide-react";
import { dataHoraCurta, EtiquetaCotacao, Passos, prazoDaqui, tempoRestante } from "@/componentes/cotacao/Pecas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { mesAno } from "@/lib/formato";
import { ROTULO_CRITERIO_APURACAO } from "@/servicos/cotacao-calculo";
import { ROTULO_FONTE, ROTULO_REGIME, type Fonte, type Regime } from "@/servicos/precos";
import { acaoCancelar, acaoEncerrar, acaoExcluir, acaoProrrogar, acaoReabrir } from "../acoes";
import { AbasCotacao } from "./AbasCotacao";
import { carregarSolicitacao } from "./carregar";
import "@/estilos/cotacoes.css";

export default async function LayoutCotacao({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  const minimo = prazoDaqui(3600000);
  const sugestao = prazoDaqui(3 * 86400000, s.prazo);
  const numero = String(s.numero).padStart(3, "0");

  return (
    <>
      <div className="cabecalho nao-imprimir">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/cotacoes">Cotações</Link><span>/</span>
            <Link href={`/obras/${s.obraId}`} className="num">{s.obraCodigo}</Link><span>/</span>
            <Link href={`/orcamentos/${s.orcamentoId}/cotacoes`}>Orçamento {s.orcamentoNumero} v{s.orcamentoVersao}</Link><span>/</span>
            <span className="num">Nº {numero}</span>
          </div>
          <h1 className="titulo">{s.titulo}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <EtiquetaCotacao situacao={s.situacao} />
            <span>{s.obraNome}</span>
            <span>· {ROTULO_FONTE[s.fonte as Fonte] ?? s.fonte} {s.uf} {mesAno(s.mes)} · {ROTULO_REGIME[s.regime as Regime] ?? s.regime}</span>
            <span>· {ROTULO_CRITERIO_APURACAO[s.criterio]}</span>
            {s.situacao === "aberta" && <span>· responder até {dataHoraCurta(s.prazo)} ({tempoRestante(s.prazo)})</span>}
          </p>
        </div>
      </div>

      <Passos situacao={s.situacao} convites={s.convites.length} />

      {s.situacao === "cancelada" && s.canceladaMotivo && <div className="aviso aviso-erro nao-imprimir"><XCircle /><span>Cancelada: {s.canceladaMotivo}</span></div>}
      {s.versaoMaisNova && s.situacao !== "cancelada" && (
        <div className="aviso aviso-info nao-imprimir"><CalendarClock /><span>O orçamento tem versão mais nova. Esta cotação segue com as quantidades e os preços de referência da versão {s.orcamentoVersao}.</span></div>
      )}

      {s.podeSolicitar && s.situacao !== "cancelada" && (
        <div className="barra-acoes nao-imprimir" style={{ marginBottom: 14 }}>
          {s.situacao === "aberta" && (
            <>
              <details className="gaveta">
                <summary className="botao botao-neutro botao-pequeno"><CalendarClock /> Prorrogar prazo</summary>
                <FormAcao acao={acaoProrrogar.bind(null, id)} className="gaveta-corpo" style={{ minWidth: 300 }}>
                  <div className="campo"><label htmlFor="pr-prazo">Novo prazo</label><input id="pr-prazo" name="prazo" type="datetime-local" className="entrada-texto" required min={minimo} defaultValue={sugestao} /></div>
                  <div className="campo"><label htmlFor="pr-just">Justificativa</label><textarea id="pr-just" name="justificativa" className="entrada-texto" rows={2} required minLength={10} /></div>
                  <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="Salvando…">Prorrogar</BotaoEnviar>
                </FormAcao>
              </details>
              <FormAcao acao={acaoEncerrar.bind(null, id)} confirmar="Encerrar o recebimento agora? Os fornecedores não poderão mais enviar ou corrigir propostas.">
                <BotaoEnviar className="botao botao-neutro botao-pequeno" enviando="Encerrando…"><Lock /> Encerrar recebimento</BotaoEnviar>
              </FormAcao>
            </>
          )}
          {(s.situacao === "encerrada" || s.situacao === "apurada") && (
            <details className="gaveta">
              <summary className="botao botao-neutro botao-pequeno"><RotateCcw /> Reabrir recebimento</summary>
              <FormAcao acao={acaoReabrir.bind(null, id)} className="gaveta-corpo" style={{ minWidth: 300 }}>
                <div className="campo"><label htmlFor="re-prazo">Novo prazo</label><input id="re-prazo" name="prazo" type="datetime-local" className="entrada-texto" required min={minimo} defaultValue={sugestao} /></div>
                <div className="campo"><label htmlFor="re-just">Justificativa</label><textarea id="re-just" name="justificativa" className="entrada-texto" rows={2} required minLength={10} /></div>
                <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="Reabrindo…">Reabrir</BotaoEnviar>
              </FormAcao>
            </details>
          )}
          {s.situacao === "rascunho" ? (
            <FormAcao acao={acaoExcluir.bind(null, id, s.orcamentoId)} confirmar="Excluir este rascunho?">
              <BotaoEnviar className="botao botao-texto" enviando="Excluindo…"><Trash2 /> Excluir rascunho</BotaoEnviar>
            </FormAcao>
          ) : (
            <details className="gaveta">
              <summary className="botao botao-texto"><XCircle /> Cancelar cotação</summary>
              <FormAcao acao={acaoCancelar.bind(null, id)} className="gaveta-corpo" style={{ minWidth: 300 }} confirmar="Cancelar esta cotação? Os links dos fornecedores deixam de funcionar.">
                <div className="campo"><label htmlFor="ca-just">Motivo do cancelamento</label><textarea id="ca-just" name="justificativa" className="entrada-texto" rows={2} required minLength={10} /></div>
                <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="Cancelando…">Cancelar cotação</BotaoEnviar>
              </FormAcao>
            </details>
          )}
        </div>
      )}

      <AbasCotacao id={id} contagem={{
        "/fornecedores": s.convites.length ? `${s.respondidas}/${s.convites.length}` : undefined,
        "/apuracao": s.apuracoes.length ? String(s.apuracoes.length) : undefined,
      }} />
      {children}
    </>
  );
}

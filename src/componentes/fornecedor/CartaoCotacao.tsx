import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Landmark } from "lucide-react";
import { dataHoraCurta, tempoRestante } from "@/componentes/cotacao/Pecas";
import { ROTULO_ESTADO, type CotacaoNaArea, type EstadoNaArea } from "@/servicos/fornecedores";

const COR: Record<EstadoNaArea, string> = { pendente: "et-laranja", rascunho: "et-roxa", enviada: "et-verde", declinada: "et-neutra", encerrada: "et-neutra", cancelada: "et-vermelha" };

export const EtiquetaEstado = ({ estado }: { estado: EstadoNaArea }) => <span className={`etiqueta ${COR[estado]}`}>{ROTULO_ESTADO[estado]}</span>;

export function CartaoCotacao({ c, i = 0 }: { c: CotacaoNaArea; i?: number }) {
  const aberta = c.estado === "pendente" || c.estado === "rascunho";
  const urgente = c.urgente;
  return (
    <article className={`forn-cotacao surgir ${aberta ? "aberta" : ""}`} style={{ "--i": i } as React.CSSProperties}>
      <div className="forn-cotacao-topo">
        <span className="forn-orgao"><Landmark />{c.orgao}</span>
        <EtiquetaEstado estado={c.estado} />
      </div>
      <h3>{c.titulo}</h3>
      <p className="fraco">Cotação nº {String(c.numero).padStart(3, "0")} · {c.itens} {c.itens === 1 ? "item" : "itens"} · {c.obra}</p>
      <div className="forn-cotacao-rodape">
        <span className={`forn-prazo ${urgente ? "urgente" : ""}`}><CalendarClock />
          {aberta ? <>Até {dataHoraCurta(c.prazo)} · <b>{tempoRestante(c.prazo)}</b></> : c.estado === "enviada" && c.enviadaEm ? <>Enviada em {dataHoraCurta(c.enviadaEm)} · versão {c.versao}</> : <>Prazo {dataHoraCurta(c.prazo)}</>}
        </span>
        <Link href={`/fornecedor/cotacoes/${c.conviteId}`} className={aberta ? "botao botao-primario" : "botao botao-neutro"}>
          {aberta ? <>{c.estado === "rascunho" ? "Continuar" : "Responder"} <ArrowRight /></> : <><FileText /> Ver</>}
        </Link>
      </div>
    </article>
  );
}

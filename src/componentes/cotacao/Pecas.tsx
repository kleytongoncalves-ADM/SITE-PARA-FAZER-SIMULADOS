import { PASSOS, passoAtual, ROTULO_CONVITE, ROTULO_SITUACAO_COTACAO, type SituacaoConvite, type SituacaoSolicitacao } from "@/servicos/cotacoes";

const COR_SITUACAO: Record<SituacaoSolicitacao, string> = { rascunho: "et-neutra", aberta: "et-azul", encerrada: "et-laranja", apurada: "et-verde", cancelada: "et-vermelha" };
const COR_CONVITE: Record<SituacaoConvite, string> = { convidado: "et-neutra", abriu: "et-azul", preenchendo: "et-roxa", respondeu: "et-verde", declinou: "et-laranja", nao_respondeu: "et-vermelha" };

export const EtiquetaCotacao = ({ situacao }: { situacao: SituacaoSolicitacao }) => <span className={`etiqueta ${COR_SITUACAO[situacao]}`}>{ROTULO_SITUACAO_COTACAO[situacao]}</span>;
export const EtiquetaConvite = ({ situacao }: { situacao: SituacaoConvite }) => <span className={`etiqueta ${COR_CONVITE[situacao]}`}>{ROTULO_CONVITE[situacao]}</span>;

/** Faixa de andamento da solicitação. */
export function Passos({ situacao, convites }: { situacao: SituacaoSolicitacao; convites: number }) {
  const atual = passoAtual(situacao, convites);
  return (
    <ol className={`cot-passos nao-imprimir ${situacao === "cancelada" ? "cancelada" : ""}`} aria-label="Andamento da solicitação">
      {PASSOS.map((p, i) => (
        <li key={p} className={i < atual ? "feito" : i === atual ? "atual" : ""} aria-current={i === atual ? "step" : undefined}>
          <i>{i < atual ? "✓" : i + 1}</i>{p}
        </li>
      ))}
    </ol>
  );
}

const FUSO = "America/Sao_Paulo";
export const dataHoraCurta = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

/** "faltam 3 dias", "faltam 5 h", "encerrado". */
export function tempoRestante(prazo: Date, agora = new Date()) {
  const ms = new Date(prazo).getTime() - agora.getTime();
  if (ms <= 0) return "prazo encerrado";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `faltam ${Math.floor(h / 24)} dias`;
  if (h >= 1) return `faltam ${h} h`;
  return `faltam ${Math.max(1, Math.floor(ms / 60000))} min`;
}

/** Valor para um campo datetime-local, no horário de Brasília. */
export const paraCampoPrazo = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T");

export const difPct = (v: number | null) => (v == null ? "" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

/** Campo de prazo a `ms` de agora (ou de `apos`, se for posterior). */
export const prazoDaqui = (ms: number, apos?: Date | null) => paraCampoPrazo(new Date(Math.max(Date.now(), apos ? new Date(apos).getTime() : 0) + ms));

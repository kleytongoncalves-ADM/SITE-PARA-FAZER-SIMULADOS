import { dataCurta } from "@/lib/formato";

const AVISO_DIAS = 30;
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Situação de ASO e treinamentos obrigatórios de uma pessoa. */
export function SituacaoHabilitacao({ pendencia, vencimento, item }: { pendencia: string | null; vencimento: string | null; item: string | null }) {
  if (pendencia) return <span className="etiqueta et-vermelha">{pendencia.replace(/^./, (c) => c.toUpperCase())}</span>;
  if (!vencimento) return <span className="etiqueta et-neutra">Sem registro</span>;
  if (vencimento <= somar(hoje(), AVISO_DIAS)) {
    const nome = item ? (item.length > 28 ? `${item.slice(0, 28)}…` : item) : "Habilitação";
    return <span className="etiqueta et-laranja" title={item ?? undefined}>{nome} vence em {dataCurta(vencimento).slice(0, 5)}</span>;
  }
  return <span className="etiqueta et-verde">Em dia</span>;
}

export function SituacaoEquipamento({ ativo, disponivel, obra }: { ativo: boolean; disponivel: boolean; obra: string | null }) {
  if (!ativo) return <span className="etiqueta et-neutra">Inativo</span>;
  if (!disponivel) return <span className="etiqueta et-vermelha">Manutenção vencida</span>;
  if (obra) return <span className="etiqueta et-azul">Na obra {obra}</span>;
  return <span className="etiqueta et-verde">Disponível</span>;
}

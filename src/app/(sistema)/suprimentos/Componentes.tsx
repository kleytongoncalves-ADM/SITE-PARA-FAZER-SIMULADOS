import { ROTULO_PEDIDO, ROTULO_REQUISICAO, type SituacaoPedido, type SituacaoRequisicao } from "@/servicos/suprimentos";

const COR_REQ: Record<SituacaoRequisicao, string> = { rascunho: "et-neutra", enviada: "et-laranja", aprovada: "et-verde", recusada: "et-vermelha", cancelada: "et-neutra" };
const COR_PED: Record<SituacaoPedido, string> = { emitido: "et-azul", parcial: "et-laranja", recebido: "et-verde", cancelado: "et-neutra" };

export function EtiquetaRequisicao({ situacao }: { situacao: SituacaoRequisicao }) {
  return <span className={`etiqueta ${COR_REQ[situacao]}`}>{ROTULO_REQUISICAO[situacao]}</span>;
}
export function EtiquetaPedido({ situacao }: { situacao: SituacaoPedido }) {
  return <span className={`etiqueta ${COR_PED[situacao]}`}>{ROTULO_PEDIDO[situacao]}</span>;
}

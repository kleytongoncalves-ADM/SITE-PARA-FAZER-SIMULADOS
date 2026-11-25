import { ROTULO_SITUACAO_ADITIVO, type SituacaoAditivo } from "@/servicos/aditivos";
import { ROTULO_SITUACAO_CONTRATO, type SituacaoContrato } from "@/servicos/contratos";
import { ROTULO_SITUACAO_CRONO, type SituacaoCronograma } from "@/servicos/cronogramas";
import { ROTULO_PAGAMENTO, ROTULO_SITUACAO_MEDICAO, type SituacaoMedicao, type SituacaoPagamento } from "@/servicos/medicoes";

const COR_CONTRATO: Record<SituacaoContrato, string> = { rascunho: "et-laranja", vigente: "et-verde", encerrado: "et-neutra", rescindido: "et-vermelha" };
const COR_CRONO: Record<SituacaoCronograma, string> = { rascunho: "et-laranja", linha_base: "et-azul", substituido: "et-neutra" };

export function EtiquetaContrato({ situacao }: { situacao: SituacaoContrato }) {
  return <span className={`etiqueta ${COR_CONTRATO[situacao]}`}>{ROTULO_SITUACAO_CONTRATO[situacao]}</span>;
}

export function EtiquetaCronograma({ situacao }: { situacao: SituacaoCronograma }) {
  return <span className={`etiqueta ${COR_CRONO[situacao]}`}>{ROTULO_SITUACAO_CRONO[situacao]}</span>;
}

const COR_MEDICAO: Record<SituacaoMedicao, string> = { rascunho: "et-laranja", atestada: "et-azul", aprovada: "et-verde", cancelada: "et-neutra" };
const COR_PAGAMENTO: Record<SituacaoPagamento, string> = { a_pagar: "et-laranja", parcial: "et-azul", paga: "et-verde", sem_valor: "et-neutra" };

export function EtiquetaMedicao({ situacao }: { situacao: SituacaoMedicao }) {
  return <span className={`etiqueta ${COR_MEDICAO[situacao]}`}>{ROTULO_SITUACAO_MEDICAO[situacao]}</span>;
}

export function EtiquetaPagamento({ situacao }: { situacao: SituacaoPagamento }) {
  return <span className={`etiqueta ${COR_PAGAMENTO[situacao]}`}>{ROTULO_PAGAMENTO[situacao]}</span>;
}

const COR_ADITIVO: Record<SituacaoAditivo, string> = { rascunho: "et-laranja", assinado: "et-verde", cancelado: "et-neutra" };

export function EtiquetaAditivo({ situacao }: { situacao: SituacaoAditivo }) {
  return <span className={`etiqueta ${COR_ADITIVO[situacao]}`}>{ROTULO_SITUACAO_ADITIVO[situacao]}</span>;
}

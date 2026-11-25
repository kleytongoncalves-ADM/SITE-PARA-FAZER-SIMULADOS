import { ROTULO_SITUACAO_CONTRATO, type SituacaoContrato } from "@/servicos/contratos";
import { ROTULO_SITUACAO_CRONO, type SituacaoCronograma } from "@/servicos/cronogramas";

const COR_CONTRATO: Record<SituacaoContrato, string> = { rascunho: "et-laranja", vigente: "et-verde", encerrado: "et-neutra", rescindido: "et-vermelha" };
const COR_CRONO: Record<SituacaoCronograma, string> = { rascunho: "et-laranja", linha_base: "et-azul", substituido: "et-neutra" };

export function EtiquetaContrato({ situacao }: { situacao: SituacaoContrato }) {
  return <span className={`etiqueta ${COR_CONTRATO[situacao]}`}>{ROTULO_SITUACAO_CONTRATO[situacao]}</span>;
}

export function EtiquetaCronograma({ situacao }: { situacao: SituacaoCronograma }) {
  return <span className={`etiqueta ${COR_CRONO[situacao]}`}>{ROTULO_SITUACAO_CRONO[situacao]}</span>;
}

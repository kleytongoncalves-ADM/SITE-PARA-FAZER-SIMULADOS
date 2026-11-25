import { ROTULO_SITUACAO_ORC, type SituacaoOrcamento } from "@/servicos/orcamentos";

const COR: Record<SituacaoOrcamento, string> = { rascunho: "et-laranja", aprovado: "et-verde", substituido: "et-neutra", cancelado: "et-vermelha" };

export function EtiquetaOrcamento({ situacao }: { situacao: SituacaoOrcamento }) {
  return <span className={`etiqueta ${COR[situacao]}`}>{ROTULO_SITUACAO_ORC[situacao]}</span>;
}

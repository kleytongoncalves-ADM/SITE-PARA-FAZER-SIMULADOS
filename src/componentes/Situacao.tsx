import { ROTULO_SITUACAO, type Situacao } from "@/servicos/rotulos";

const COR: Record<Situacao, string> = {
  em_estudo: "et-neutra",
  orcada: "et-azul",
  licitada: "et-roxa",
  contratada: "et-roxa",
  em_execucao: "et-laranja pulso",
  paralisada: "et-vermelha",
  concluida: "et-verde",
  recebida_provisoriamente: "et-verde",
  recebida_definitivamente: "et-verde",
  cancelada: "et-neutra",
};

export function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  return <span className={`etiqueta ${COR[situacao]}`}>{ROTULO_SITUACAO[situacao]}</span>;
}

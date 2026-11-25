import { dataCurta } from "@/lib/formato";
import { CATEGORIAS, EXIGENCIAS, ROTULO_CATEGORIA, TIPOS_SUGERIDOS, type Exigencia, type SituacaoDocumento } from "@/servicos/documentos";
import type { FormaExecucao } from "@/servicos/rotulos";
import type { OpcoesDocumento } from "./CamposDocumento";

const COR: Record<SituacaoDocumento, string> = { vigente: "et-verde", vencendo: "et-laranja", vencido: "et-vermelha", superado: "et-neutra", baixada: "et-azul" };
const ROTULO: Record<SituacaoDocumento, string> = { vigente: "Vigente", vencendo: "Vence em breve", vencido: "Vencido", superado: "Superado", baixada: "Baixada" };

export function EtiquetaDocumento({ situacao, validade }: { situacao: SituacaoDocumento; validade?: string | null }) {
  const texto = situacao === "vencendo" && validade ? `Vence em ${dataCurta(validade)}` : situacao === "vencido" && validade ? `Venceu em ${dataCurta(validade)}` : ROTULO[situacao];
  return <span className={`etiqueta ${COR[situacao]}`}>{texto}</span>;
}

export const tamanhoArquivo = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

export function opcoesDocumento(contratos: { id: string; numero: string }[], forma: FormaExecucao | null): OpcoesDocumento {
  return {
    categorias: CATEGORIAS.map((c) => ({ valor: c, rotulo: ROTULO_CATEGORIA[c], tipos: TIPOS_SUGERIDOS[c] })),
    exigencias: (Object.keys(EXIGENCIAS) as Exigencia[]).filter((k) => !forma || EXIGENCIAS[k].vale(forma))
      .map((k) => ({ valor: k, rotulo: EXIGENCIAS[k].rotulo, categoria: EXIGENCIAS[k].categoria, tipo: EXIGENCIAS[k].tipo })),
    contratos,
  };
}

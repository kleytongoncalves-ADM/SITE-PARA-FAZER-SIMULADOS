import { ROTULO_SITUACAO, ROTULO_TIPO, TIPOS_OBRA, type Situacao, type TipoObra } from "@/servicos/rotulos";

export const SITUACOES_FILTRO: Situacao[] = ["licitada", "contratada", "em_execucao", "paralisada", "concluida", "recebida_provisoriamente"];

export function lerFiltros(f: { tipo?: string | null; unidade?: string | null; situacao?: string | null }) {
  return {
    tipo: TIPOS_OBRA.includes(f.tipo as TipoObra) ? (f.tipo as string) : undefined,
    unidade: f.unidade || undefined,
    situacao: SITUACOES_FILTRO.includes(f.situacao as Situacao) ? (f.situacao as string) : undefined,
  };
}

/** Descrição dos filtros aplicados, para o cabeçalho de relatório e planilha. */
export function descreverFiltros(f: ReturnType<typeof lerFiltros>, unidades: { id: string; nome: string }[]) {
  const partes = [
    f.tipo ? ROTULO_TIPO[f.tipo as TipoObra] : null,
    f.unidade ? unidades.find((u) => u.id === f.unidade)?.nome ?? null : null,
    f.situacao ? ROTULO_SITUACAO[f.situacao as Situacao] : "Da licitação ao recebimento provisório",
  ].filter(Boolean);
  return partes.join(" · ");
}

export const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (m: string) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

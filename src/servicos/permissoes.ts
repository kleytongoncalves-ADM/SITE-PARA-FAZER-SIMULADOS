import type { Perfil } from "./rotulos";

export type Acao =
  | "obra.ver_todas"
  | "obra.criar"
  | "obra.editar"
  | "obra.mudar_situacao"
  | "obra.vincular"
  | "usuario.gerenciar"
  | "auditoria.ver"
  | "orcamento.ver"
  | "orcamento.editar"
  | "orcamento.aprovar"
  | "precos.composicao_propria"
  | "precos.aprovar_composicao"
  | "contrato.ver"
  | "contrato.editar"
  | "contrato.assinar"
  | "cronograma.ver"
  | "cronograma.editar"
  | "cronograma.linha_base"
  | "cronograma.avanco";

export type Quem = { perfil: Perfil; administrador: boolean };

const MATRIZ: Record<Exclude<Acao, "usuario.gerenciar">, Perfil[]> = {
  "obra.ver_todas": ["direcao"],
  "obra.criar": ["direcao", "engenheiro", "administrativo"],
  "obra.editar": ["direcao", "engenheiro", "administrativo"],
  "obra.mudar_situacao": ["direcao", "engenheiro", "gestor_contrato"],
  "obra.vincular": ["direcao", "engenheiro", "gestor_contrato", "administrativo"],
  "auditoria.ver": ["direcao"],
  "orcamento.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro"],
  "orcamento.editar": ["direcao", "engenheiro"],
  "orcamento.aprovar": ["direcao", "engenheiro"],
  "precos.composicao_propria": ["direcao", "engenheiro"],
  "precos.aprovar_composicao": ["direcao", "engenheiro"],
  "contrato.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro"],
  "contrato.editar": ["direcao", "gestor_contrato", "administrativo"],
  "contrato.assinar": ["direcao", "gestor_contrato"],
  "cronograma.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro", "campo"],
  "cronograma.editar": ["direcao", "gestor_contrato", "engenheiro"],
  "cronograma.linha_base": ["direcao", "engenheiro"],
  "cronograma.avanco": ["direcao", "engenheiro", "fiscal"],
};

/** O administrador do sistema pode tudo. Os demais seguem a matriz por perfil. */
export function pode(quem: Quem, acao: Acao): boolean {
  if (quem.administrador) return true;
  if (acao === "usuario.gerenciar") return false;
  return MATRIZ[acao].includes(quem.perfil);
}

export class SemPermissao extends Error {
  constructor(mensagem = "Sem permissão para esta ação.") {
    super(mensagem);
    this.name = "SemPermissao";
  }
}

export function exigir(quem: Quem, acao: Acao) {
  if (!pode(quem, acao)) throw new SemPermissao();
}

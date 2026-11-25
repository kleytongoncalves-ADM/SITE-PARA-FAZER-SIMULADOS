import type { Perfil } from "./rotulos";

export type Acao =
  | "obra.ver_todas"
  | "obra.criar"
  | "obra.editar"
  | "obra.mudar_situacao"
  | "obra.vincular"
  | "usuario.gerenciar"
  | "auditoria.ver";

export type Quem = { perfil: Perfil; administrador: boolean };

const MATRIZ: Record<Exclude<Acao, "usuario.gerenciar">, Perfil[]> = {
  "obra.ver_todas": ["direcao"],
  "obra.criar": ["direcao", "engenheiro", "administrativo"],
  "obra.editar": ["direcao", "engenheiro", "administrativo"],
  "obra.mudar_situacao": ["direcao", "engenheiro", "gestor_contrato"],
  "obra.vincular": ["direcao", "engenheiro", "gestor_contrato", "administrativo"],
  "auditoria.ver": ["direcao"],
};

/** O administrador do sistema pode tudo. Os demais seguem a matriz por perfil. */
export function pode(quem: Quem, acao: Acao): boolean {
  if (quem.administrador) return true;
  if (acao === "usuario.gerenciar") return false;
  return MATRIZ[acao].includes(quem.perfil);
}

export class SemPermissao extends Error {
  constructor(mensagem = "Você não tem permissão para esta ação. Peça o acesso ao administrador do sistema.") {
    super(mensagem);
    this.name = "SemPermissao";
  }
}

export function exigir(quem: Quem, acao: Acao) {
  if (!pode(quem, acao)) throw new SemPermissao();
}

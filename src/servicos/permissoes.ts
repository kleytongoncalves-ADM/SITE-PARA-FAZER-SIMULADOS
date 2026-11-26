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
  | "cronograma.avanco"
  | "medicao.ver"
  | "medicao.elaborar"
  | "medicao.atestar"
  | "medicao.aprovar"
  | "medicao.ajustar"
  | "pagamento.registrar"
  | "aditivo.elaborar"
  | "aditivo.assinar"
  | "revisao.registrar"
  | "diario.ver"
  | "diario.lancar"
  | "diario.assinar"
  | "diario.visto"
  | "qualidade.ver"
  | "qualidade.registrar"
  | "qualidade.corrigir"
  | "qualidade.verificar"
  | "seguranca.ver"
  | "seguranca.registrar"
  | "seguranca.encerrar"
  | "suprimentos.ver"
  | "suprimentos.requisitar"
  | "suprimentos.aprovar"
  | "suprimentos.comprar"
  | "suprimentos.estoque"
  | "equipes.ver"
  | "equipes.gerenciar"
  | "equipes.apontar"
  | "documentos.ver"
  | "documentos.enviar"
  | "documentos.dispensar"
  | "gerencial.ver"
  | "cotacao.ver"
  | "cotacao.solicitar"
  | "cotacao.apurar"
  | "cotacao.homologar";

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
  "medicao.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro"],
  "medicao.elaborar": ["direcao", "engenheiro", "fiscal"],
  "medicao.atestar": ["direcao", "fiscal"],
  "medicao.aprovar": ["direcao", "gestor_contrato"],
  "medicao.ajustar": ["direcao", "gestor_contrato", "fiscal", "engenheiro", "financeiro"],
  "pagamento.registrar": ["direcao", "financeiro"],
  "aditivo.elaborar": ["direcao", "gestor_contrato", "engenheiro", "administrativo"],
  "aditivo.assinar": ["direcao", "gestor_contrato"],
  "revisao.registrar": ["direcao", "gestor_contrato", "administrativo"],
  "diario.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "campo", "contratada"],
  "diario.lancar": ["direcao", "engenheiro", "fiscal", "campo", "contratada"],
  "diario.assinar": ["direcao", "engenheiro", "contratada"],
  "diario.visto": ["direcao", "gestor_contrato", "fiscal"],
  "qualidade.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "campo", "contratada"],
  "qualidade.registrar": ["direcao", "engenheiro", "fiscal"],
  "qualidade.corrigir": ["direcao", "engenheiro", "campo", "contratada"],
  "qualidade.verificar": ["direcao", "fiscal"],
  "seguranca.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "campo", "contratada"],
  "seguranca.registrar": ["direcao", "engenheiro", "fiscal", "campo", "contratada"],
  "seguranca.encerrar": ["direcao", "engenheiro", "fiscal"],
  "suprimentos.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro", "campo"],
  "suprimentos.requisitar": ["direcao", "engenheiro", "campo"],
  "suprimentos.aprovar": ["direcao", "engenheiro", "gestor_contrato"],
  "suprimentos.comprar": ["direcao", "gestor_contrato", "administrativo"],
  "suprimentos.estoque": ["direcao", "engenheiro", "administrativo", "campo"],
  "equipes.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro", "campo"],
  "equipes.gerenciar": ["direcao", "engenheiro", "administrativo"],
  "equipes.apontar": ["direcao", "engenheiro", "campo"],
  "documentos.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro", "campo", "contratada"],
  "documentos.enviar": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "contratada"],
  "documentos.dispensar": ["direcao", "engenheiro"],
  "gerencial.ver": ["direcao", "gestor_contrato", "engenheiro", "administrativo", "financeiro"],
  "cotacao.ver": ["direcao", "gestor_contrato", "engenheiro", "fiscal", "administrativo", "financeiro"],
  "cotacao.solicitar": ["direcao", "gestor_contrato", "engenheiro", "administrativo"],
  "cotacao.apurar": ["direcao", "gestor_contrato", "engenheiro"],
  "cotacao.homologar": ["direcao", "gestor_contrato"],
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

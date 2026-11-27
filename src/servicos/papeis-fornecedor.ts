/** Permissões de cada usuário da empresa fornecedora. Sem acesso a banco: usado também nas telas. */
export type PapelFornecedor = "administrador" | "cotacoes" | "consulta";
export const ROTULO_PAPEL: Record<PapelFornecedor, string> = { administrador: "Administrador", cotacoes: "Responde cotações", consulta: "Somente consulta" };
export const DESCRICAO_PAPEL: Record<PapelFornecedor, string> = {
  administrador: "Tudo, inclusive dados da empresa e usuários.",
  cotacoes: "Responde cotações e conversa com os contratantes.",
  consulta: "Vê cotações e conversas, sem enviar nada.",
};
export const PAPEIS: PapelFornecedor[] = ["administrador", "cotacoes", "consulta"];

export const PERFIS = [
  "direcao", "gestor_contrato", "engenheiro", "fiscal",
  "administrativo", "financeiro", "campo", "contratada",
] as const;
export type Perfil = (typeof PERFIS)[number];

export const ROTULO_PERFIL: Record<Perfil, string> = {
  direcao: "Direção",
  gestor_contrato: "Gestor de contrato",
  engenheiro: "Engenheiro responsável",
  fiscal: "Fiscal",
  administrativo: "Administrativo",
  financeiro: "Financeiro",
  campo: "Campo",
  contratada: "Contratada",
};

export const SITUACOES = [
  "em_estudo", "orcada", "licitada", "contratada", "em_execucao", "paralisada",
  "concluida", "recebida_provisoriamente", "recebida_definitivamente", "cancelada",
] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  em_estudo: "Em estudo",
  orcada: "Orçada",
  licitada: "Licitada",
  contratada: "Contratada",
  em_execucao: "Em execução",
  paralisada: "Paralisada",
  concluida: "Concluída",
  recebida_provisoriamente: "Recebida provisoriamente",
  recebida_definitivamente: "Recebida definitivamente",
  cancelada: "Cancelada",
};

export const TIPOS_OBRA = ["edificacao", "pavimentacao", "saneamento", "reforma", "urbanizacao", "outro"] as const;
export type TipoObra = (typeof TIPOS_OBRA)[number];
export const ROTULO_TIPO: Record<TipoObra, string> = {
  edificacao: "Edificação",
  pavimentacao: "Pavimentação",
  saneamento: "Saneamento",
  reforma: "Reforma",
  urbanizacao: "Urbanização",
  outro: "Outro",
};

export const FORMAS_EXECUCAO = ["contratada", "direta", "mista"] as const;
export type FormaExecucao = (typeof FORMAS_EXECUCAO)[number];
export const ROTULO_FORMA: Record<FormaExecucao, string> = {
  contratada: "Por contratada",
  direta: "Direta (equipe própria)",
  mista: "Mista",
};

export const PAPEIS = [
  "gestor_contrato", "fiscal", "responsavel_tecnico", "campo", "contratada", "administrativo", "financeiro",
] as const;
export type Papel = (typeof PAPEIS)[number];
export const ROTULO_PAPEL: Record<Papel, string> = {
  gestor_contrato: "Gestor do contrato",
  fiscal: "Fiscal",
  responsavel_tecnico: "Responsável técnico",
  campo: "Equipe de campo",
  contratada: "Representante da contratada",
  administrativo: "Administrativo",
  financeiro: "Financeiro",
};

/** Para onde a obra pode ir a partir de cada situação. Espelha a função do banco. */
export function proximasSituacoes(de: Situacao, forma: FormaExecucao): Situacao[] {
  switch (de) {
    case "em_estudo": return ["orcada", "cancelada"];
    case "orcada": return forma === "direta" ? ["em_execucao", "licitada", "em_estudo", "cancelada"] : ["licitada", "em_estudo", "cancelada"];
    case "licitada": return ["contratada", "cancelada"];
    case "contratada": return ["em_execucao", "cancelada"];
    case "em_execucao": return ["paralisada", "concluida"];
    case "paralisada": return ["em_execucao", "cancelada"];
    case "concluida": return ["recebida_provisoriamente"];
    case "recebida_provisoriamente": return ["recebida_definitivamente"];
    default: return [];
  }
}

export const ROTULO_CAMPO: Record<string, string> = {
  nome: "Nome", codigo: "Código", tipo: "Tipo", forma_execucao: "Forma de execução", endereco: "Endereço",
  municipio: "Município", uf: "UF", latitude: "Latitude", longitude: "Longitude", area_m2: "Área (m²)",
  extensao_m: "Extensão (m)", fonte_recurso: "Fonte de recurso", convenio: "Convênio",
  processo_administrativo: "Processo administrativo", licitacao: "Licitação", art_numero: "ART ou RRT",
  ordem_servico_numero: "Ordem de serviço", ordem_servico_data: "Data da ordem de serviço",
  data_inicio_prevista: "Início previsto", data_fim_prevista: "Término previsto", situacao: "Situação",
  unidade_id: "Unidade", perfil: "Perfil", administrador: "Administrador", ativo: "Ativo", email: "E-mail",
  senha_hash: "Senha", cpf: "CPF", registro_profissional: "Registro profissional", fim: "Fim do vínculo",
  papel: "Papel", inicio: "Início do vínculo",
};
export const ROTULO_TABELA: Record<string, string> = { obra: "Obra", usuario: "Usuário", vinculo_obra: "Vínculo com a obra" };

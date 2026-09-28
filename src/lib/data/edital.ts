import type { Assunto, Cargo, Concurso, Disciplina } from '../types'

// Fonte: Edital nº 1 do Concurso Público 1/2026 – CRA/RJ (Normativo), banca IADES.
// Estrutura extraída dos Anexos I (vagas), II (cargos), III (questões e pesos) e IV (conteúdo programático).
// Sempre que uma informação não constar literalmente no edital, ela é tratada no produto como
// "questão gerada" ou "conteúdo de apoio" — nunca como conteúdo oficial da banca.

function assuntos(disciplinaId: string, nomes: string[]): Assunto[] {
  return nomes.map((nome, i) => ({ id: `${disciplinaId}-${i + 1}`, disciplinaId, nome }))
}

const disciplinasComuns: Disciplina[] = [
  {
    id: 'portugues',
    nome: 'Língua Portuguesa e Redação Oficial',
    cor: '#6f4bff',
    peso: 1,
    numQuestoesEdital: 10,
    assuntos: assuntos('portugues', [
      'Compreensão e interpretação de textos',
      'Tipologia e gêneros textuais',
      'Coesão e coerência',
      'Ortografia oficial',
      'Acentuação gráfica',
      'Classes de palavras',
      'Tempos e modos verbais',
      'Concordância verbal e nominal',
      'Regência verbal e nominal',
      'Crase',
      'Colocação pronominal',
      'Sintaxe e pontuação',
      'Significação das palavras (semântica)',
      'Redação oficial',
    ]),
  },
  {
    id: 'legislacao-cra',
    nome: 'Legislação Aplicada ao CRA/RJ',
    cor: '#10b8ae',
    peso: 1,
    numQuestoesEdital: 5,
    assuntos: assuntos('legislacao-cra', [
      'Lei nº 4.769/1965',
      'Decreto nº 61.934/1967',
      'Estrutura e competências do Sistema CFA/CRAs',
      'Registro profissional e fiscalização',
      'Normativos do Sistema CFA/CRAs',
    ]),
  },
  {
    id: 'adm-publica',
    nome: 'Administração Pública e Gestão Pública',
    cor: '#f59e0b',
    peso: 1,
    numQuestoesEdital: 5,
    assuntos: assuntos('adm-publica', [
      'Estruturas organizacionais e departamentalização',
      'Processo organizacional',
      'Gestão de processos e da qualidade',
      'Gestão de projetos',
      'Planejamento estratégico',
      'Excelência nos serviços públicos',
      'Gestão de resultados no setor público',
      'Gestão pública x gestão privada',
      'Sustentabilidade pública e acessibilidade',
    ]),
  },
  {
    id: 'raciocinio-logico',
    nome: 'Raciocínio Lógico',
    cor: '#f43f5e',
    peso: 1,
    numQuestoesEdital: 4,
    assuntos: assuntos('raciocinio-logico', [
      'Estruturas lógicas e argumentação',
      'Proposições, conectivos e tabelas-verdade',
      'Diagramas e sequências lógicas',
      'Conjuntos, razão e proporção',
      'Regra de três simples e composta',
      'Porcentagem',
      'Juros simples e compostos',
      'Interpretação de tabelas e gráficos',
    ]),
  },
  {
    id: 'informatica',
    nome: 'Noções de Informática',
    cor: '#22d3c9',
    peso: 1,
    numQuestoesEdital: 3,
    assuntos: assuntos('informatica', [
      'Hardware e software',
      'Windows e aplicativos',
      'Word, Excel e PowerPoint',
      'Correio eletrônico e internet',
      'Armazenamento em nuvem',
      'Segurança da informação',
    ]),
  },
  {
    id: 'etica',
    nome: 'Ética e Administração Pública',
    cor: '#34d399',
    peso: 1,
    numQuestoesEdital: 3,
    assuntos: assuntos('etica', [
      'Princípios constitucionais da Administração Pública',
      'Ética no serviço público',
      'Conduta funcional e integridade',
      'Administração direta e indireta',
    ]),
  },
]

const especificoAdministrador: Disciplina = {
  id: 'especifico-101',
  nome: 'Conhecimentos Específicos — Administrador',
  cor: '#8b73ff',
  peso: 2,
  numQuestoesEdital: 20,
  assuntos: assuntos('especifico-101', [
    'Teorias da Administração',
    'Processo administrativo (PODC)',
    'Planejamento estratégico, tático e operacional',
    'Gestão por processos',
    'Governança, compliance e gestão de riscos',
    'Gestão de pessoas',
    'Administração financeira e orçamentária',
    'Administração de materiais e patrimônio',
    'Indicadores de desempenho e relatórios gerenciais',
    'Licitações e contratos (Lei nº 14.133/2021)',
    'Proteção de dados pessoais na gestão pública',
    'Tecnologia da informação aplicada à gestão',
    'ESG e Objetivos de Desenvolvimento Sustentável',
    'Código de Ética e Disciplina do Sistema CFA/CRAs',
    'Regulamento de Fiscalização e de Registro do Sistema CFA/CRAs',
  ]),
}

const especificoFiscal: Disciplina = {
  id: 'especifico-102',
  nome: 'Conhecimentos Específicos — Fiscal',
  cor: '#8b73ff',
  peso: 2,
  numQuestoesEdital: 20,
  assuntos: assuntos('especifico-102', [
    'Lei nº 4.769/1965 e Decreto nº 61.934/1967',
    'Código de Conduta e Decoro do Sistema CFA/CRAs',
    'Código de Ética e Disciplina dos Profissionais de Administração',
    'Regulamento de Fiscalização do Sistema CFA/CRAs',
    'Regulamento de Registro do Sistema CFA/CRAs',
    'Poder de polícia administrativa',
    'Processo administrativo aplicado à fiscalização',
    'Atos administrativos: auto de infração e notificação',
    'Contraditório e ampla defesa',
    'Atividades privativas, compartilhadas e correlatas',
    'Responsabilidade técnica e exercício ilegal da profissão',
    'Técnicas de fiscalização presencial, remota e documental',
  ]),
}

const especificoApoio: Disciplina = {
  id: 'especifico-201',
  nome: 'Conhecimentos Específicos — Apoio Administrativo',
  cor: '#8b73ff',
  peso: 2,
  numQuestoesEdital: 20,
  assuntos: assuntos('especifico-201', [
    'Noções de Administração Geral',
    'Rotinas administrativas e atendimento ao público',
    'Redação oficial e administrativa',
    'Arquivologia e gestão documental',
    'Informática aplicada às rotinas administrativas',
    'Gestão de materiais, patrimônio e almoxarifado',
    'Noções de recursos humanos e departamento pessoal',
    'Licitações e contratos administrativos (Lei nº 14.133/2021)',
    'Estrutura e normativos do Sistema CFA/CRAs',
    'Organização do trabalho e sigilo das informações',
  ]),
}

const cargos: Cargo[] = [
  {
    id: '201',
    codigo: '201',
    nome: 'Profissional de Apoio Administrativo',
    nivel: 'medio',
    salario: 2437,
    vagasImediatas: 2,
    vagasCadastroReserva: 40,
    requisitos: 'Ensino Médio completo ou Curso Técnico em Administração (MEC).',
    descricao:
      'Executa atividades administrativas e funcionais de apoio às áreas finalísticas e de suporte do CRA-RJ: atendimento ao público, gestão documental, operação de sistemas corporativos e apoio às rotinas financeiras, de pessoal, materiais e patrimônio.',
  },
  {
    id: '101',
    codigo: '101',
    nome: 'Administrador',
    nivel: 'superior',
    salario: 6369,
    vagasImediatas: 1,
    vagasCadastroReserva: 20,
    requisitos: 'Bacharelado em Administração ou Administração Pública (MEC) + registro ativo no CRA-RJ.',
    descricao:
      'Planeja, organiza, coordena, executa e aperfeiçoa processos administrativos, financeiros, de suprimentos, gestão de pessoas e governança institucional do CRA-RJ.',
  },
  {
    id: '102',
    codigo: '102',
    nome: 'Fiscal',
    nivel: 'superior',
    salario: 6369,
    vagasImediatas: 1,
    vagasCadastroReserva: 20,
    requisitos: 'Bacharelado em Administração ou Administração Pública (MEC) + registro ativo no CRA-RJ.',
    descricao:
      'Organiza, executa e acompanha ações de fiscalização e orientação profissional para verificar o cumprimento da legislação que regulamenta o exercício da profissão de Administrador.',
  },
]

export function disciplinasPorCargo(cargoId: string): Disciplina[] {
  const especifico =
    cargoId === '101' ? especificoAdministrador : cargoId === '102' ? especificoFiscal : especificoApoio
  return [...disciplinasComuns, especifico]
}

export const concurso: Concurso = {
  id: 'cra-rj-2026',
  nome: 'Concurso Público CRA/RJ 1/2026',
  orgao: 'Conselho Regional de Administração do Rio de Janeiro (CRA/RJ)',
  banca: 'IADES',
  edital: 'Edital nº 1 do Concurso Público 1/2026 – CRA/RJ (Normativo)',
  dataProva: '2026-10-18',
  duracaoProvaHoras: 4,
  notaMinimaPercent: 50,
  cargos,
  disciplinas: disciplinasPorCargo('101'),
  cronograma: [
    { item: 'Publicação do Edital Normativo', data: '2026-08-12' },
    { item: 'Período de inscrições', data: '2026-08-20 a 2026-09-15' },
    { item: 'Último dia para pagamento da taxa', data: '2026-09-16' },
    { item: 'Divulgação dos locais de prova', data: '2026-10-05' },
    { item: 'Aplicação das provas objetivas e discursiva/redação', data: '2026-10-18' },
    { item: 'Gabaritos preliminares', data: '2026-10-18' },
    { item: 'Resultado final das provas objetivas', data: '2026-11-04' },
    { item: 'Resultado preliminar da discursiva/redação', data: '2026-11-10' },
    { item: 'Resultado preliminar do concurso', data: '2026-12-09' },
    { item: 'Resultado final e homologação', data: '2026-12-15' },
  ],
}

export const bancaEstiloInfo =
  'A IADES costuma cobrar comandos objetivos, alternativas com pequenas variações de redação e questões de Língua Portuguesa fortemente contextualizadas em textos motivadores. Simulados "estilo banca" seguem esse padrão, mas não são questões oficiais da IADES.'

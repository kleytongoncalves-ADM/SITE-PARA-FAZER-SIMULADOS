/**
 * Carrega os dados de exemplo: um órgão fictício, um usuário por perfil e quatro obras
 * em situações diferentes. Tudo aqui é inventado. Não rode em produção.
 *
 * A senha de demonstração vem de SENHA_DEMO no .env. Sem ela, o script usa a senha
 * padrão abaixo, que serve só para o ambiente local.
 */
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { gerarHashSenha } from "../src/servicos/auth";
import { criarObra, editarObra, mudarSituacao, vincular, type Ator, type DadosObra } from "../src/servicos/obras";
import type { Perfil } from "../src/servicos/rotulos";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { lancarMuro, PADRAO_MURO, sugerirMuro } from "../src/servicos/assistente-muro";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import {
  adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais,
} from "../src/servicos/orcamentos";
import { buscarComposicoes } from "../src/servicos/precos";

try { process.loadEnvFile(".env"); } catch {}
const SENHA_DEMO = process.env.SENHA_DEMO ?? "Demonstracao2026";
const CNPJ = "00.000.000/0001-00";

async function principal() {
  if (process.env.NODE_ENV === "production") throw new Error("Dados de exemplo não entram em produção.");
  const ja = await pool().query("select 1 from orgao where cnpj = $1", [CNPJ]);
  if (ja.rowCount) return console.log("Os dados de exemplo já estão carregados.");

  const orgaoId = (await pool().query(
    "insert into orgao (nome, cnpj, esfera, uf, municipio) values ('Prefeitura de Vila Exemplo', $1, 'municipal', 'RJ', 'Vila Exemplo') returning id",
    [CNPJ],
  )).rows[0].id as string;

  const hash = gerarHashSenha(SENHA_DEMO);
  const pessoas: [string, string, Perfil, boolean, string | null][] = [
    ["Helena Duarte", "direcao", "direcao", false, null],
    ["Marcos Teixeira", "gestor", "gestor_contrato", false, null],
    ["Carla Nogueira", "engenheira", "engenheiro", false, "CREA-RJ 000000-0"],
    ["Rafael Pinto", "fiscal", "fiscal", false, "CREA-RJ 000001-0"],
    ["Juliana Reis", "administrativo", "administrativo", true, null],
    ["Paulo Mendes", "financeiro", "financeiro", false, null],
    ["Sebastião Lima", "campo", "campo", false, null],
    ["Construtora Exemplo Ltda.", "contratada", "contratada", false, null],
  ];
  const ator: Record<string, Ator> = {};
  await comContexto({ usuarioId: null, orgaoId }, async (c) => {
    const unidade = (await c.query("insert into unidade (orgao_id, nome, sigla) values ($1, 'Secretaria Municipal de Obras', 'SMO') returning id", [orgaoId])).rows[0].id;
    for (const [nome, login, perfil, administrador, registro] of pessoas) {
      const r = await c.query(
        `insert into usuario (orgao_id, unidade_id, nome, email, perfil, administrador, registro_profissional, senha_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [orgaoId, unidade, nome, `${login}@vilaexemplo.exemplo`, perfil, administrador, registro, hash],
      );
      ator[login] = { id: r.rows[0].id, orgaoId, perfil, administrador };
    }
  });
  const { direcao, engenheira, gestor } = ator;

  const base = { municipio: "Vila Exemplo", uf: "RJ" };
  const equipe = async (id: string, comContratada: boolean) => {
    await vincular(direcao, id, ator.fiscal.id, "fiscal");
    await vincular(direcao, id, gestor.id, "gestor_contrato");
    await vincular(direcao, id, ator.campo.id, "campo");
    await vincular(direcao, id, ator.financeiro.id, "financeiro");
    if (comContratada) await vincular(direcao, id, ator.contratada.id, "contratada");
  };

  // Obra A: ciclo completo, por contratada.
  const a: DadosObra = {
    ...base, codigo: "OB-2026-001", nome: "Muro de fechamento da Escola Municipal Modelo", tipo: "edificacao",
    formaExecucao: "contratada", endereco: "Rua das Acácias, 120, Centro", extensaoM: 10, latitude: -22.52, longitude: -43.18,
    fonteRecurso: "Recursos próprios", processoAdministrativo: "PA 0101/2026", licitacao: "Dispensa 04/2026",
    dataInicioPrevista: "2026-03-02", dataFimPrevista: "2026-03-31",
  };
  const idA = await criarObra(engenheira, a);
  await equipe(idA, true);
  await mudarSituacao(engenheira, idA, "orcada", "Orçamento 001/2026, aprovado em 10/02/2026");
  await mudarSituacao(gestor, idA, "licitada", "Dispensa 04/2026");
  await mudarSituacao(gestor, idA, "contratada", "Contrato 012/2026");
  await editarObra(engenheira, idA, { ...a, artNumero: "ART 2020260000001", ordemServicoNumero: "OS 05/2026", ordemServicoData: "2026-03-02" });
  await mudarSituacao(gestor, idA, "em_execucao", "OS 05/2026");
  await mudarSituacao(engenheira, idA, "concluida", "Segunda e última medição, atestada");
  await mudarSituacao(direcao, idA, "recebida_provisoriamente", "Termo de recebimento provisório 03/2026");
  await mudarSituacao(direcao, idA, "recebida_definitivamente", "Termo de recebimento definitivo 03/2026");

  // Obra B: reforma, execução mista, em andamento.
  const b: DadosObra = {
    ...base, codigo: "OB-2026-002", nome: "Reforma da Unidade de Saúde Central", tipo: "reforma", formaExecucao: "mista",
    endereco: "Avenida Principal, 800, Centro", areaM2: 640, latitude: -22.521, longitude: -43.176,
    fonteRecurso: "Convênio estadual", convenio: "Convênio 77/2025", processoAdministrativo: "PA 0230/2026",
    licitacao: "Concorrência 02/2026", dataInicioPrevista: "2026-05-04", dataFimPrevista: "2026-12-18",
    artNumero: "ART 2020260000002", ordemServicoNumero: "OS 11/2026", ordemServicoData: "2026-05-04",
  };
  const idB = await criarObra(engenheira, b);
  await equipe(idB, true);
  await mudarSituacao(engenheira, idB, "orcada", "Orçamento 004/2026");
  await mudarSituacao(gestor, idB, "licitada", "Concorrência 02/2026");
  await mudarSituacao(gestor, idB, "contratada", "Contrato 031/2026");
  await mudarSituacao(gestor, idB, "em_execucao", "OS 11/2026");

  // Obra C: calçada, execução direta.
  const c: DadosObra = {
    ...base, codigo: "OB-2026-003", nome: "Calçada acessível da Rua Principal", tipo: "urbanizacao", formaExecucao: "direta",
    endereco: "Rua Principal, do número 1 ao 240", extensaoM: 120, latitude: -22.523, longitude: -43.181,
    fonteRecurso: "Recursos próprios", processoAdministrativo: "PA 0312/2026",
    dataInicioPrevista: "2026-09-01", dataFimPrevista: "2026-12-05",
    artNumero: "ART 2020260000003", ordemServicoNumero: "OS 19/2026", ordemServicoData: "2026-09-01",
  };
  const idC = await criarObra(engenheira, c);
  await equipe(idC, false);
  await mudarSituacao(engenheira, idC, "orcada", "Orçamento 009/2026");
  await mudarSituacao(engenheira, idC, "em_execucao", "OS 19/2026");

  // Obra D: ainda em estudo.
  const idD = await criarObra(engenheira, {
    ...base, codigo: "OB-2026-004", nome: "Praça do Bairro Novo", tipo: "urbanizacao", formaExecucao: "contratada",
    endereco: "Quadra 12, Bairro Novo", areaM2: 1800, processoAdministrativo: "PA 0455/2026",
  });
  await vincular(direcao, idD, ator.administrativo.id, "administrativo");

  // Base de preços de demonstração (global) e orçamentos de exemplo.
  const conexao = await pool().connect();
  let tabelaId: string;
  try {
    await conexao.query("begin");
    const r = await gravarCargaSinapi(conexao, cargaDemonstracao(), "demonstracao");
    await conexao.query("commit");
    tabelaId = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
  } finally { conexao.release(); }

  // Obra A: muro de 10 m x 2 m pelo assistente, aprovado com nota.
  const orcA = await criarOrcamento(engenheira, { obraId: idA, nome: "Muro de fechamento", tabelaId });
  const linhas = await sugerirMuro(engenheira, orcA, PADRAO_MURO);
  await lancarMuro(engenheira, orcA, {
    nomeEtapa: "Muro", modo: "servico",
    linhas: linhas.filter((l) => l.escolhida).map((l) => ({ composicaoId: l.escolhida!, quantidade: l.quantidade, memoria: l.memoria })),
  });
  const oA = await obterOrcamento(engenheira, orcA);
  await salvarDadosGerais(engenheira, orcA, {
    ...oA, responsavelTecnico: "Carla Nogueira", registroProfissional: "CREA-RJ 000000-0", art: "ART 2020260000001",
  });
  await salvarCronograma(engenheira, orcA, {
    periodos: 4, unidadePeriodo: "semana", inicio: "2026-03-02",
    percentuais: { [oA.etapas[0].id]: { 1: "25", 2: "35", 3: "25", 4: "15" } },
  });
  await aprovarOrcamento(direcao, orcA);

  // Obra D: orçamento em elaboração.
  const orcD = await criarOrcamento(engenheira, { obraId: idD, nome: "Orçamento básico", tabelaId });
  const prelim = await adicionarEtapa(engenheira, orcD, "Serviços preliminares");
  const loc = (await buscarComposicoes(engenheira, { tabelaId, busca: "locação" }))[0];
  if (loc) await adicionarComposicao(engenheira, orcD, loc.id, { etapaId: prelim, quantidade: "180", memoria: "Perímetro da praça" });
  await adicionarEtapa(engenheira, orcD, "Pavimentação");

  console.log("Dados de exemplo carregados: 1 órgão, 8 usuários, 4 obras, base de demonstração e 2 orçamentos.");
  console.log("Logins: direcao, gestor, engenheira, fiscal, administrativo, financeiro, campo e contratada, todos @vilaexemplo.exemplo.");
  console.log("Senha: a definida em SENHA_DEMO no .env, ou a padrão que está no início de scripts/semear.ts.");
}

principal().finally(fecharPool);

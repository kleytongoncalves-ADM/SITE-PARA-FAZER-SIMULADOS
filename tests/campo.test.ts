import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import {
  abrirDiario, adicionarLinha, assinarDiario, complementarDiario, enviarFoto, excluirFoto, lerFoto, obterDiario, relatorioDiario, removerLinha,
  repetirAnterior, resumoDiarios, salvarDiario, vistarDiario,
} from "../src/servicos/campo";
import { assinarContrato, criarContrato, obterContrato, salvarEmpresa } from "../src/servicos/contratos";
import { criarCronograma, gravarLinhaBase, obterCronograma } from "../src/servicos/cronogramas";
import { criarMedicao, salvarBoletim } from "../src/servicos/medicoes";
import { criarObra, mudarSituacao, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { abrirNc, cancelarNc, corrigirNc, obterNc, painelQualidade, registrarEnsaio, registrarInspecao, verificarNc, MODELOS } from "../src/servicos/qualidade";
import { encerrarOcorrencia, painelSeguranca, registrarEpi, registrarOcorrencia } from "../src/servicos/seguranca";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, gestor: Ator, fiscal: Ator, financeiro: Ator, campo: Ator, outro: Ator;
let nd: string, empresaId: string;

beforeAll(async () => {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const { gravarCargaSinapi } = await import("../src/servicos/importador-sinapi");
    const r = await gravarCargaSinapi(c, cargaDemonstracao(), "demonstracao");
    await c.query("commit");
    nd = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
  } finally { c.release(); }
  orgao = await novoOrgao();
  eng = await novoUsuario(orgao, "engenheiro");
  direcao = await novoUsuario(orgao, "direcao");
  gestor = await novoUsuario(orgao, "gestor_contrato");
  fiscal = await novoUsuario(orgao, "fiscal");
  financeiro = await novoUsuario(orgao, "financeiro");
  campo = await novoUsuario(orgao, "campo");
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Campo Ltda", cnpj: "11.444.777/0001-61", tipo: "contratada" });
});
afterAll(fecharPool);

const consulta = (sql: string, p: unknown[]) => comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => (await c.query(sql, p)).rows);

let seq = 0;
/** Obra em execução com contrato vigente e cronograma em linha de base. */
async function obraEmExecucao() {
  const obraId = await criarObra(eng, dadosObra({ ordemServicoNumero: "OS 001/2026", ordemServicoData: "2026-11-02", artNumero: "RJ2026000123" }));
  for (const [u, p] of [[gestor, "gestor_contrato"], [fiscal, "fiscal"], [financeiro, "financeiro"], [campo, "campo"]] as const) await vincular(direcao, obraId, u.id, p);
  const orc = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, orc, "Alvenaria");
  const comp = async (busca: string) => (await buscarComposicoes(eng, { tabelaId: nd, busca }))[0];
  await adicionarComposicao(eng, orc, (await comp("alvenaria")).id, { etapaId: etapa, quantidade: "20" });
  await adicionarComposicao(eng, orc, (await comp("chapisco")).id, { etapaId: etapa, quantidade: "40" });
  await salvarDadosGerais(eng, orc, { ...(await obterOrcamento(eng, orc)), responsavelTecnico: "Eng. Teste" });
  await salvarCronograma(eng, orc, { periodos: 1, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "100" } } });
  await aprovarOrcamento(eng, orc);
  const contratoId = await criarContrato(gestor, {
    orcamentoId: orc, empresaId, numero: `CP-${Date.now()}-${++seq}`, objeto: "Muro", regime: "preco_unitario", natureza: "obra_nova",
    dataAssinatura: "2026-11-02", dataOrdemServico: "2026-11-02", prazoExecucaoDias: 30, vigenciaFim: "2027-02-28", dataBase: "2026-10-01",
    gestorId: gestor.id, fiscalId: fiscal.id,
  });
  await assinarContrato(gestor, contratoId);
  await mudarSituacao(eng, obraId, "em_execucao", "OS 001/2026");
  const cronoId = await criarCronograma(eng, contratoId, { inicio: "2026-11-02" });
  await gravarLinhaBase(eng, cronoId);
  const crono = await obterCronograma(eng, cronoId);
  const k = await obterContrato(gestor, contratoId);
  return { obraId, contratoId, k, atividade: crono.atividades.find((x) => x.itemServicoId === k.itens[0].id)!, alvenaria: k.itens[0] };
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const foto = (obraId: string, alvo: Record<string, string>, momento?: "antes" | "depois") => ({
  obraId, alvo, momento, legenda: "Frente de serviço", tiradaEm: "2026-11-10T10:00:00-03:00", latitude: -22.9, longitude: -43.2,
  mime: "image/jpeg", largura: 1600, altura: 1200, conteudo: jpeg, miniatura: jpeg,
});

describe("diário de obra", () => {
  it("lança o dia, assina, lança o avanço e congela", async () => {
    const { obraId, atividade } = await obraEmExecucao();
    await expect(abrirDiario(campo, obraId, "2099-01-01")).rejects.toThrow(/futura/);
    const id = await abrirDiario(campo, obraId, "2026-11-10");
    expect(await abrirDiario(campo, obraId, "2026-11-10")).toBe(id);
    await salvarDiario(campo, id, { climaManha: "bom", climaTarde: "chuva_forte", condicao: "parcial", relato: "Elevação da alvenaria no trecho 1." });
    await adicionarLinha(campo, id, { tipo: "efetivo", funcao: "Pedreiro", empresa: "Construtora Campo", quantidade: 3 });
    await adicionarLinha(campo, id, { tipo: "efetivo", funcao: "pedreiro", empresa: "Construtora Campo", quantidade: 1 });
    await adicionarLinha(campo, id, { tipo: "efetivo", funcao: "Servente", empresa: "Construtora Campo", quantidade: 4 });
    await adicionarLinha(campo, id, { tipo: "equipamento", descricao: "Betoneira 400 L", quantidade: 1, horas: 6 });
    await adicionarLinha(campo, id, { tipo: "servico", descricao: "", atividadeId: atividade.id, avancoPct: 40 });
    await adicionarLinha(campo, id, { tipo: "ocorrencia", subtipo: "paralisacao", motivo: "chuva", horas: 3, descricao: "Chuva forte à tarde." });
    await expect(adicionarLinha(campo, id, { tipo: "ocorrencia", subtipo: "paralisacao", descricao: "x" })).rejects.toThrow(/motivo/);
    const fotoId = await enviarFoto(campo, foto(obraId, { diarioId: id }));

    let d = await obterDiario(campo, id);
    expect(d.totalEfetivo).toBe(8);
    expect(d.efetivo.find((e) => e.funcao === "Pedreiro")!.quantidade).toBe(4);
    expect(d.horasParadas).toBe(3);
    expect(d.servicos[0].descricao).toContain(atividade.nome);
    expect(d.fotos).toHaveLength(1);
    expect(d.podeAssinar).toBe(false);

    await expect(assinarDiario(campo, id)).rejects.toThrow(SemPermissao);
    await assinarDiario(eng, id);
    d = await obterDiario(eng, id);
    expect(d.situacao).toBe("assinado");
    expect(d.podeVisto).toBe(false);
    const crono = await consulta("select percentual::float8 as p, origem from avanco where atividade_id = $1", [atividade.id]);
    expect(crono).toEqual([{ p: 40, origem: "diario" }]);

    await expect(salvarDiario(eng, id, { climaManha: "bom", climaTarde: "bom", condicao: "praticavel", relato: "Mudou" })).rejects.toThrow(/complemento/);
    await expect(adicionarLinha(campo, id, { tipo: "efetivo", funcao: "Pintor", quantidade: 1 })).rejects.toThrow(/complemento/);
    await expect(removerLinha(campo, id, "efetivo", d.efetivo[0].id)).rejects.toThrow(/complemento/);
    await expect(enviarFoto(campo, foto(obraId, { diarioId: id }))).rejects.toThrow(/assinado/);
    await expect(excluirFoto(campo, fotoId)).rejects.toThrow();

    await expect(vistarDiario(eng, id, null)).rejects.toThrow(SemPermissao);
    await vistarDiario(fiscal, id, "Conferido em campo.");
    await expect(vistarDiario(fiscal, id, null)).rejects.toThrow(/já foi dado/);
    await complementarDiario(fiscal, id, "Faltou registrar a visita da concessionária às 15 h.");
    d = await obterDiario(fiscal, id);
    expect(d.vistoPor).toBeTruthy();
    expect(d.complementos).toHaveLength(1);

    // Dia seguinte repete o efetivo; avanço menor que o já lançado é recusado.
    const id2 = await abrirDiario(campo, obraId, "2026-11-11");
    expect(await repetirAnterior(campo, id2)).toBe(3);
    await expect(adicionarLinha(campo, id2, { tipo: "servico", descricao: "", atividadeId: atividade.id, avancoPct: 30 })).rejects.toThrow(/já é 40/);

    const rel = await relatorioDiario(eng, obraId, "2026-11-01", "2026-11-15");
    expect(rel.diasComDiario).toBe(2);
    expect(rel.paradas).toEqual([{ motivo: "chuva", horas: 3, dias: 1 }]);
    expect(rel.homensDia).toBe(16);
    expect(rel.avancos[0]).toMatchObject({ de: 0, ate: 40 });
    expect(rel.diasUteisSemDiario).toContain("2026-11-03");

    const resumo = await resumoDiarios(eng, obraId, "2026-11");
    expect(resumo.dias).toHaveLength(2);
    expect(resumo.totalPendentes).toBeGreaterThan(5);
  });

  it("respeita perfil e órgão", async () => {
    const { obraId } = await obraEmExecucao();
    await expect(resumoDiarios(financeiro, obraId)).rejects.toThrow(SemPermissao);
    await expect(resumoDiarios(outro, obraId)).rejects.toThrow(/não encontrada/);
    const id = await abrirDiario(campo, obraId, "2026-11-12");
    const fotoId = await enviarFoto(campo, foto(obraId, { diarioId: id }));
    expect(await lerFoto(eng, fotoId, true)).toMatchObject({ mime: "image/jpeg" });
    expect(await lerFoto(outro, fotoId, false)).toBeNull();
    await excluirFoto(campo, fotoId);
    await expect(assinarDiario(eng, id)).rejects.toThrow(/relato/);
  });
});

describe("qualidade", () => {
  it("não conformidade impeditiva trava a medição até ser encerrada pelo fiscal", async () => {
    const { obraId, contratoId, alvenaria } = await obraEmExecucao();
    await expect(abrirNc(campo, obraId, { titulo: "x", descricao: "y", gravidade: "leve", responsavel: "z" })).rejects.toThrow(SemPermissao);
    await expect(abrirNc(fiscal, obraId, { titulo: "Prumo", descricao: "Fora de prumo", gravidade: "grave", responsavel: "Contratada", impeditiva: true }))
      .rejects.toThrow(/item da planilha/);
    const ncId = await abrirNc(fiscal, obraId, {
      titulo: "Alvenaria fora de prumo", descricao: "Desvio de 2 cm no trecho 1", gravidade: "grave", responsavel: "Construtora Campo", impeditiva: true, itemServicoId: alvenaria.id,
    });
    await enviarFoto(fiscal, foto(obraId, { naoConformidadeId: ncId }, "antes"));
    const periodo = { periodoInicio: "2026-11-02", periodoFim: "2026-11-15" };
    const med = await criarMedicao(eng, contratoId, periodo);
    await expect(salvarBoletim(eng, med, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "5", memoria: "Trecho 1" }] })).rejects.toThrow(/impeditiva/);

    await expect(verificarNc(fiscal, ncId, true, "ok")).rejects.toThrow(/depois da correção/);
    await corrigirNc(campo, ncId, "Trecho demolido e refeito.");
    await expect(verificarNc(fiscal, ncId, true, "Conferido")).rejects.toThrow(/foto da correção/);
    await verificarNc(fiscal, ncId, false, "Ainda fora de prumo");
    let nc = await obterNc(fiscal, ncId);
    expect(nc.situacao).toBe("aberta");
    await corrigirNc(campo, ncId, "Refeito com gabarito.");
    await enviarFoto(campo, foto(obraId, { naoConformidadeId: ncId }, "depois"));
    await verificarNc(fiscal, ncId, true, "Prumo conferido com nível laser.");
    nc = await obterNc(fiscal, ncId);
    expect(nc.situacao).toBe("encerrada");
    expect(nc.fotosAntes).toHaveLength(1);
    expect(nc.fotosDepois).toHaveLength(1);
    await expect(cancelarNc(fiscal, ncId, "x")).rejects.toThrow(/aberta/);
    await salvarBoletim(eng, med, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "5", memoria: "Trecho 1" }] });
  });

  it("ensaio reprovado e inspeção não conforme abrem não conformidade", async () => {
    const { obraId, alvenaria } = await obraEmExecucao();
    const ok = await registrarEnsaio(fiscal, obraId, {
      tipo: "Resistência à compressão do concreto", dataColeta: "2026-11-03", dataResultado: "2026-11-24", unidade: "MPa", criterio: "minimo",
      especificado: "25", resultado: "27,4", laboratorio: "Lab. Teste",
    });
    expect(ok).toMatchObject({ aprovado: true, ncId: null });
    const ruim = await registrarEnsaio(fiscal, obraId, {
      tipo: "Resistência à compressão do concreto", itemServicoId: alvenaria.id, dataColeta: "2026-11-03", dataResultado: "2026-11-24", unidade: "MPa",
      criterio: "minimo", especificado: "25", resultado: "21,8", laudo: "L-123",
    });
    expect(ruim.aprovado).toBe(false);
    const nc = await obterNc(eng, ruim.ncId!);
    expect(nc).toMatchObject({ origem: "ensaio", gravidade: "grave", impeditiva: true });
    expect(nc.descricao).toContain("21,8 MPa");

    const m = MODELOS.find((x) => x.chave === "alvenaria")!;
    const respostas = m.itens.map((_, i) => ({ resposta: i === 1 ? "nao_conforme" : i === 5 ? "nao_aplica" : "conforme", observacao: i === 1 ? "Desvio no eixo B" : null }));
    await expect(registrarInspecao(fiscal, obraId, { modelo: "alvenaria", data: "2026-11-20", respostas: respostas.slice(1) })).rejects.toThrow(/todos os itens/);
    const ins = await registrarInspecao(fiscal, obraId, { modelo: "alvenaria", data: "2026-11-20", local: "Eixo B", respostas, abrirNcs: true, responsavel: "Construtora Campo" });
    expect(ins.ncs).toBe(1);
    const p = await painelQualidade(eng, obraId);
    expect(p.inspecoes[0]).toMatchObject({ conformes: 4, naoConformes: 1 });
    expect(p.abertas).toBe(2);
    expect(p.impeditivas).toBe(1);
    expect(p.ensaiosReprovados).toBe(1);
    expect(Math.round(p.conformidade!)).toBe(80);
  });
});

describe("segurança", () => {
  it("ocorrência vai para o diário, conta dias sem acidente e encerra com a ação", async () => {
    const { obraId } = await obraEmExecucao();
    await expect(registrarOcorrencia(campo, obraId, {
      tipo: "risco_grave", data: "2026-11-18", descricao: "Vala sem escoramento", acaoCorretiva: "Escorar", responsavel: "Contratada", prazo: "2026-11-19",
      paralisacao: true, horasParalisadas: 4,
    })).rejects.toThrow(/fiscal/);
    const r1 = await registrarOcorrencia(fiscal, obraId, {
      tipo: "risco_grave", data: "2026-11-18", local: "Vala da rede pluvial", descricao: "Vala de 1,8 m sem escoramento", acaoCorretiva: "Escoramento metálico",
      responsavel: "Construtora Campo", prazo: "2026-11-19", paralisacao: true, horasParalisadas: 4,
    });
    const diario = (await consulta("select id from diario where obra_id = $1 and data = '2026-11-18'", [obraId]))[0].id;
    let d = await obterDiario(eng, diario);
    expect(d.ocorrencias[0]).toMatchObject({ tipo: "paralisacao", motivo: "seguranca", horas: 4, ocorrenciaSegurancaId: r1 });
    await expect(removerLinha(campo, diario, "ocorrencia", d.ocorrencias[0].id)).rejects.toThrow(/segurança/);

    await salvarDiario(campo, diario, { climaManha: "bom", climaTarde: "bom", condicao: "parcial", relato: "Frente da vala parada." });
    await assinarDiario(eng, diario);
    await registrarOcorrencia(campo, obraId, {
      tipo: "acidente_sem_afastamento", data: "2026-11-18", descricao: "Corte superficial na mão", envolvido: "J. Silva", acaoCorretiva: "Troca de luva",
      responsavel: "Técnico de segurança", prazo: "2026-11-20",
    });
    d = await obterDiario(eng, diario);
    expect(d.complementos[0].texto).toContain("Acidente sem afastamento");

    await expect(registrarEpi(campo, obraId, { data: "2026-11-18", trabalhador: "J. Silva", epis: [] })).rejects.toThrow(/EPI/);
    expect(await registrarEpi(campo, obraId, { data: "2026-11-18", trabalhador: "J. Silva", funcao: "Servente", epis: ["Luva de raspa", "Capacete"] })).toBe(2);

    await expect(encerrarOcorrencia(campo, r1, "x")).rejects.toThrow(SemPermissao);
    await encerrarOcorrencia(fiscal, r1, "Escoramento instalado e conferido.");
    const p = await painelSeguranca(eng, obraId);
    expect(p).toMatchObject({ acidentes: 1, riscos: 1, abertas: 1, horasParalisadas: 4, ultimoAcidente: "2026-11-18" });
    expect(p.diasSemAcidente).toBe(7);
    expect(p.epis).toHaveLength(2);
  });
});

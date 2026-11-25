import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { assinarContrato, criarContrato, obterContrato, salvarEmpresa } from "../src/servicos/contratos";
import {
  alocarEquipamento, alocarPessoa, apontarEquipamento, apontarHoras, documentosDasEmpresas, efetivoAlocado, encerrarAlocacao, obterPessoa,
  painelEquipes, painelModuloEquipes, registrarDocumentoEmpresa, registrarHabilitacao, registrarManutencao, salvarEquipamento, salvarPessoa,
} from "../src/servicos/equipes";
import { criarObra, mudarSituacao, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import {
  adicionarItemRequisicao, avaliacaoFornecedores, cancelarPedido, criarRequisicao, decidirRequisicao, definirMinimo, emitirPedido, enviarRequisicao,
  importarDoOrcamento, obterPedido, obterRequisicao, painelSuprimentos, registrarCotacao, registrarMovimento, registrarRecebimento,
} from "../src/servicos/suprimentos";
import { hoje } from "../src/servicos/campo";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

const HOJE = hoje();

let orgao: string, eng: Ator, direcao: Ator, gestor: Ator, fiscal: Ator, campo: Ator, adm: Ator, outro: Ator;
let nd: string, empresaId: string;

function digitos(base: number[], pesos: number[]) {
  const s = base.reduce((t, d, i) => t + d * pesos[i], 0) % 11;
  return s < 2 ? 0 : 11 - s;
}
let semente = 100;
function cnpj() {
  const b = String(10000000 + ++semente * 7919).slice(0, 8).split("").map(Number).concat([0, 0, 0, 1]);
  const d1 = digitos(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitos([...b, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...b, d1, d2].join("");
}
function cpf() {
  const b = String(100000000 + ++semente * 104729).slice(0, 9).split("").map(Number);
  const dv = (arr: number[]) => {
    const s = arr.reduce((t, d, i) => t + d * (arr.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(b);
  return [...b, d1, dv([...b, d1])].join("");
}

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
  campo = await novoUsuario(orgao, "campo");
  adm = await novoUsuario(orgao, "administrativo");
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Suprimentos Ltda", cnpj: cnpj(), tipo: "contratada" });
});
afterAll(fecharPool);

const consulta = (sql: string, p: unknown[]) => comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => (await c.query(sql, p)).rows);

let seq = 0;
async function obraEmExecucao() {
  const obraId = await criarObra(eng, dadosObra({ ordemServicoNumero: "OS 001/2026", ordemServicoData: "2026-11-02", artNumero: "RJ2026000123", formaExecucao: "mista" }));
  for (const [u, p] of [[gestor, "gestor_contrato"], [fiscal, "fiscal"], [campo, "campo"], [adm, "administrativo"]] as const) await vincular(direcao, obraId, u.id, p);
  const orc = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, orc, "Alvenaria");
  const comp = async (busca: string) => (await buscarComposicoes(eng, { tabelaId: nd, busca }))[0];
  await adicionarComposicao(eng, orc, (await comp("alvenaria")).id, { etapaId: etapa, quantidade: "20" });
  await salvarDadosGerais(eng, orc, { ...(await obterOrcamento(eng, orc)), responsavelTecnico: "Eng. Teste" });
  await salvarCronograma(eng, orc, { periodos: 1, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "100" } } });
  await aprovarOrcamento(eng, orc);
  const contratoId = await criarContrato(gestor, {
    orcamentoId: orc, empresaId, numero: `CS-${Date.now()}-${++seq}`, objeto: "Muro", regime: "preco_unitario", natureza: "obra_nova",
    dataAssinatura: "2026-11-02", dataOrdemServico: "2026-11-02", prazoExecucaoDias: 30, vigenciaFim: "2027-02-28", dataBase: "2026-10-01",
    gestorId: gestor.id, fiscalId: fiscal.id,
  });
  await assinarContrato(gestor, contratoId);
  await mudarSituacao(eng, obraId, "em_execucao", "OS 001/2026");
  const k = await obterContrato(gestor, contratoId);
  return { obraId, item: k.itens[0] };
}

describe("suprimentos", () => {
  it("requisição, cotação, pedido, recebimento e estoque", async () => {
    const { obraId, item } = await obraEmExecucao();
    expect(await importarDoOrcamento(campo, obraId)).toBeGreaterThan(0);
    expect(await importarDoOrcamento(campo, obraId)).toBe(0);
    let p = await painelSuprimentos(campo, obraId);
    expect(p.estoque.length).toBeGreaterThanOrEqual(2);
    const [m1, m2] = [...p.estoque].sort((a, b) => b.previsto - a.previsto);
    expect(m1.previsto).toBeGreaterThan(0);

    const req = await criarRequisicao(campo, obraId, { necessidade: "2099-12-01" });
    await adicionarItemRequisicao(campo, req, { materialId: m1.materialId, quantidade: String(m1.previsto / 2), itemServicoId: item.id });
    await expect(adicionarItemRequisicao(campo, req, { materialId: m2.materialId, quantidade: String(m2.previsto * 2) })).rejects.toThrow(/justificativa/);
    await adicionarItemRequisicao(campo, req, { materialId: m2.materialId, quantidade: String(m2.previsto * 2), justificativa: "Reposição de perda no transporte." });
    await expect(decidirRequisicao(eng, req, true)).rejects.toThrow(/aguardando/);
    await enviarRequisicao(campo, req);
    await expect(adicionarItemRequisicao(campo, req, { materialId: m1.materialId, quantidade: "1" })).rejects.toThrow(/enviada/);
    await expect(decidirRequisicao(campo, req, true)).rejects.toThrow(SemPermissao);
    await expect(decidirRequisicao(eng, req, false)).rejects.toThrow(/motivo/);
    await decidirRequisicao(eng, req, true);

    // Quem faz a requisição não a aprova.
    const propria = await criarRequisicao(eng, obraId, { necessidade: "2099-12-01" });
    await adicionarItemRequisicao(eng, propria, { materialId: m1.materialId, quantidade: "1", justificativa: "Teste" });
    await enviarRequisicao(eng, propria);
    await expect(decidirRequisicao(eng, propria, true)).rejects.toThrow(/outra pessoa/);
    expect((await obterRequisicao(eng, propria)).podeDecidir).toBe(false);

    const r = await obterRequisicao(gestor, req);
    const [i1, i2] = r.itens.sort((a, b) => (a.materialId === m1.materialId ? -1 : b.materialId === m1.materialId ? 1 : 0));
    const fa = await salvarEmpresa(direcao, { razaoSocial: "Depósito Alfa", cnpj: cnpj(), tipo: "fornecedor" });
    const fb = await salvarEmpresa(direcao, { razaoSocial: "Materiais Beta", cnpj: cnpj(), tipo: "fornecedor" });
    await expect(registrarCotacao(campo, req, { empresaId: fa, precos: { [i1.id]: "10" } })).rejects.toThrow(SemPermissao);
    const ca = await registrarCotacao(gestor, req, { empresaId: fa, prazoEntrega: 5, frete: "50", precos: { [i1.id]: "10,00", [i2.id]: "30" } });
    const cb = await registrarCotacao(adm, req, { empresaId: fb, prazoEntrega: 3, precos: { [i1.id]: "12", [i2.id]: "25" } });
    await expect(registrarCotacao(gestor, req, { empresaId: fa, precos: { [i1.id]: "9" } })).rejects.toThrow(/já tem cotação/);
    const mapa = await obterRequisicao(gestor, req);
    expect(mapa.menor[i1.id]).toBe(10);
    expect(mapa.menor[i2.id]).toBe(25);

    await expect(emitirPedido(gestor, ca, { itens: [i1.id, i2.id] })).rejects.toThrow(/justificativa/);
    const pa = await emitirPedido(gestor, ca, { itens: [i1.id], prazoEntrega: "2099-12-01" });
    const pb = await emitirPedido(gestor, cb, { itens: [i2.id] });
    await expect(emitirPedido(gestor, cb, { itens: [i1.id], justificativa: "Entrega mais rápida." })).rejects.toThrow(/outro pedido/);

    // Recebimento parcial com recusa.
    let ped = await obterPedido(campo, pa);
    expect(ped.total).toBeCloseTo(i1.quantidade * 10 + 50, 2);
    const metade = Math.floor(i1.quantidade / 2);
    await expect(registrarRecebimento(campo, pa, { data: HOJE, notaFiscal: "123", notaQualidade: 4, notaAtendimento: 5,
      itens: [{ pedidoItemId: ped.itens[0].id, quantidade: String(i1.quantidade + 1) }] })).rejects.toThrow(/saldo a receber/);
    await expect(registrarRecebimento(campo, pa, { data: HOJE, notaFiscal: "123", notaQualidade: 4, notaAtendimento: 5,
      itens: [{ pedidoItemId: ped.itens[0].id, quantidade: String(metade), recusada: "1" }] })).rejects.toThrow(/motivo da recusa/);
    await registrarRecebimento(campo, pa, { data: HOJE, notaFiscal: "123", notaQualidade: 4, notaAtendimento: 5,
      itens: [{ pedidoItemId: ped.itens[0].id, quantidade: String(metade), recusada: "1", motivo: "Peças quebradas" }] });
    ped = await obterPedido(campo, pa);
    expect(ped.situacao).toBe("parcial");
    expect(ped.itens[0].saldo).toBeCloseTo(i1.quantidade - metade - 1, 4);
    expect(ped.podeCancelar).toBe(false);
    await expect(cancelarPedido(gestor, pa, "Desistência")).rejects.toThrow(/sem recebimento/);
    await cancelarPedido(gestor, pb, "Fornecedor sem estoque");

    p = await painelSuprimentos(campo, obraId);
    let linha = p.estoque.find((l) => l.materialId === m1.materialId)!;
    expect(linha.saldo).toBe(metade);
    expect(linha.custoMedio).toBe(10);

    // Saída para o item, perda e limites do estoque.
    await expect(registrarMovimento(campo, obraId, { tipo: "saida", materialId: m1.materialId, quantidade: "1", data: HOJE })).rejects.toThrow(/item de serviço/);
    await expect(registrarMovimento(campo, obraId, { tipo: "saida", materialId: m1.materialId, quantidade: String(metade + 1), data: HOJE, itemServicoId: item.id }))
      .rejects.toThrow(/insuficiente/);
    await registrarMovimento(campo, obraId, { tipo: "saida", materialId: m1.materialId, quantidade: "4", data: HOJE, itemServicoId: item.id });
    await expect(registrarMovimento(campo, obraId, { tipo: "perda", materialId: m1.materialId, quantidade: "1", data: HOJE })).rejects.toThrow(/justificativa/);
    await registrarMovimento(campo, obraId, { tipo: "perda", materialId: m1.materialId, quantidade: "1", data: HOJE, observacao: "Quebra no manuseio" });
    await expect(registrarMovimento(fiscal, obraId, { tipo: "perda", materialId: m1.materialId, quantidade: "1", data: HOJE, observacao: "x" })).rejects.toThrow(SemPermissao);

    // Transferência para outra obra pelo mesmo custo.
    const outra = await obraEmExecucao();
    await registrarMovimento(campo, obraId, { tipo: "transferencia_saida", materialId: m1.materialId, quantidade: "2", data: HOJE, obraDestinoId: outra.obraId, observacao: "Sobra" });
    const destino = (await painelSuprimentos(campo, outra.obraId)).estoque.find((l) => l.materialId === m1.materialId)!;
    expect(destino.saldo).toBe(2);
    expect(destino.custoMedio).toBe(10);

    await definirMinimo(campo, obraId, m1.materialId, String(metade));
    p = await painelSuprimentos(campo, obraId);
    linha = p.estoque.find((l) => l.materialId === m1.materialId)!;
    expect(linha.saldo).toBe(metade - 7);
    expect(linha.consumido).toBe(4);
    expect(linha.abaixoMinimo).toBe(true);
    expect(p.abaixoMinimo).toBe(1);
    expect(p.consumoMateriais).toBe(50);
    expect(p.perdas[0].real).toBe(4);

    await expect(consulta("update movimento_estoque set quantidade = 1 where obra_id = $1", [obraId])).rejects.toThrow();
    await expect(consulta("delete from movimento_estoque where obra_id = $1", [obraId])).rejects.toThrow();
    await expect(obterRequisicao(outro, req)).rejects.toThrow();

    const av = (await avaliacaoFornecedores(gestor)).find((f) => f.id === fa)!;
    expect(av.recebimentos).toBe(1);
    expect(av.noPrazo).toBe(100);
    expect(av.qualidade).toBe(4);
  });
});

describe("equipes e recursos", () => {
  it("alocação exige ASO e treinamentos em dia; horas viram custo do item", async () => {
    const { obraId, item } = await obraEmExecucao();
    const terceira = await salvarEmpresa(direcao, { razaoSocial: "Mão de Obra Gama", cnpj: cnpj(), tipo: "terceirizada" });
    await expect(salvarPessoa(eng, null, { nome: "João", cpf: "111.111.111-11", funcao: "Pedreiro" })).rejects.toThrow(/CPF/);
    await expect(salvarPessoa(campo, null, { nome: "João", cpf: cpf(), funcao: "Pedreiro" })).rejects.toThrow(SemPermissao);
    const doc = cpf();
    const joao = await salvarPessoa(eng, null, { nome: "João Pedreiro", cpf: doc, funcao: "Pedreiro", custoHora: "20" });
    await expect(salvarPessoa(eng, null, { nome: "Outro", cpf: doc, funcao: "Servente" })).rejects.toThrow(/CPF/);
    const ana = await salvarPessoa(adm, null, { nome: "Ana Servente", cpf: cpf(), funcao: "Servente", empresaId: terceira, custoHora: "15" });

    await expect(alocarPessoa(eng, obraId, { pessoaId: joao, inicio: "2026-11-03" })).rejects.toThrow(/sem ASO/);
    await registrarHabilitacao(eng, joao, { tipo: "aso", descricao: "Admissional", data: "2026-01-10", validade: "2027-01-10" });
    await registrarHabilitacao(eng, joao, { tipo: "treinamento", descricao: "NR-35 Trabalho em altura", data: "2024-01-05", validade: "2025-01-05" });
    await expect(alocarPessoa(eng, obraId, { pessoaId: joao, inicio: "2026-11-03" })).rejects.toThrow(/NR-35 Trabalho em altura vencido/);
    await registrarHabilitacao(eng, joao, { tipo: "treinamento", descricao: "NR-35 Trabalho em altura", data: "2026-10-01", validade: "2028-10-01" });
    await alocarPessoa(eng, obraId, { pessoaId: joao, inicio: "2026-11-03" });
    await expect(alocarPessoa(eng, obraId, { pessoaId: joao, inicio: "2026-11-10" })).rejects.toThrow(/já está alocado/);
    await registrarHabilitacao(eng, ana, { tipo: "aso", descricao: "Admissional", data: "2026-02-01", validade: "2027-02-01" });
    await alocarPessoa(eng, obraId, { pessoaId: ana, inicio: "2026-11-03", funcao: "Ajudante" });

    const pj = await obterPessoa(fiscal, joao);
    expect(pj.pendencia).toBeNull();
    expect(pj.habilitacoes.filter((h) => h.vigente)).toHaveLength(2);

    await expect(apontarHoras(fiscal, obraId, { data: "2026-11-05", linhas: [{ pessoaId: joao, normais: "8" }] })).rejects.toThrow(SemPermissao);
    await expect(apontarHoras(campo, obraId, { data: "2026-11-02", linhas: [{ pessoaId: joao, normais: "8" }] })).rejects.toThrow(/não está alocado/);
    expect(await apontarHoras(campo, obraId, { data: "2026-11-05", itemServicoId: item.id, linhas: [{ pessoaId: joao, normais: "8", extras: "2" }, { pessoaId: ana, normais: "8" }] })).toBe(2);
    await expect(apontarHoras(campo, obraId, { data: "2026-11-05", linhas: [{ pessoaId: joao, normais: "15" }] })).rejects.toThrow(/24 horas/);

    const eq = await salvarEquipamento(eng, null, { descricao: "Betoneira 400 L", identificacao: "PAT-001", propriedade: "proprio", custoHora: "12" });
    await registrarManutencao(eng, eq, { data: "2026-05-01", tipo: "preventiva", descricao: "Troca de correia", proximaRevisao: "2026-08-01" });
    await expect(alocarEquipamento(eng, obraId, { equipamentoId: eq, inicio: "2026-11-03" })).rejects.toThrow(/manutenção vencida/);
    await registrarManutencao(eng, eq, { data: "2026-11-02", tipo: "revisao", descricao: "Revisão geral", proximaRevisao: "2027-05-02" });
    await alocarEquipamento(eng, obraId, { equipamentoId: eq, inicio: "2026-11-03" });
    await apontarEquipamento(campo, obraId, { data: "2026-11-05", equipamentoId: eq, itemServicoId: item.id, horas: "6" });

    const p = await painelEquipes(eng, obraId);
    expect(p.pessoas.filter((x) => x.ativa)).toHaveLength(2);
    const custo = p.custos.find((l) => l.itemId === item.id)!;
    expect(custo.maoDeObra).toBe(8 * 20 + 2 * 20 * 1.5 + 8 * 15);
    expect(custo.equipamentos).toBe(72);
    expect(custo.horas).toBe(18);
    expect(custo.realizado).toBe(custo.maoDeObra + 72);

    const efetivo = await comContexto({ usuarioId: eng.id, orgaoId: orgao }, (c) => efetivoAlocado(c, obraId, "2026-11-05"));
    expect(efetivo).toEqual([{ funcao: "Pedreiro", empresa: "Equipe própria", quantidade: 1 }, { funcao: "Ajudante", empresa: "Mão de Obra Gama", quantidade: 1 }]);

    await expect(encerrarAlocacao(eng, "pessoa", p.pessoas.find((x) => x.pessoaId === joao)!.id, "2026-11-04")).rejects.toThrow(/horas apontadas/);
    await encerrarAlocacao(eng, "pessoa", p.pessoas.find((x) => x.pessoaId === joao)!.id, "2026-11-06");

    await registrarDocumentoEmpresa(adm, terceira, { tipo: "fgts", validade: "2026-10-01" });
    const docs = (await documentosDasEmpresas(eng)).find((e) => e.id === terceira)!;
    expect(docs.vencidos).toBe(1);
    const m = await painelModuloEquipes(direcao);
    expect(m.documentosVencidos).toBeGreaterThanOrEqual(1);
    await expect(consulta("update apontamento set horas_normais = 1 where obra_id = $1", [obraId])).rejects.toThrow();
  });
});

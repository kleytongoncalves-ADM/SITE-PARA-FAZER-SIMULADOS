import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import {
  adicionarGarantia, assinarContrato, cnpjValido, criarContrato, definirExecutor, listarContratos, obterContrato,
  orcamentosParaContratar, salvarContrato, salvarEmpresa,
} from "../src/servicos/contratos";
import {
  adicionarAtividade, criarCronograma, editarAtividade, gravarLinhaBase, novaVersaoCronograma, obterCronograma, registrarAvanco, removerAtividade,
} from "../src/servicos/cronogramas";
import { criarObra, obterObra, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, gestor: Ator, fiscal: Ator, campo: Ator, outro: Ator;
let nd: string, empresaId: string;
const CNPJ = "11.222.333/0001-81";

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
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Teste Ltda", cnpj: CNPJ, tipo: "contratada" });
});
afterAll(fecharPool);

/** Obra com orçamento aprovado: alvenaria 20 m² (R$ 1.746,60) e chapisco 40 m². */
async function orcamentoAprovado() {
  const obraId = await criarObra(eng, dadosObra());
  for (const u of [gestor, fiscal, campo]) await vincular(direcao, obraId, u.id, u === gestor ? "gestor_contrato" : u === fiscal ? "fiscal" : "campo");
  const id = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, id, "Alvenaria");
  const comp = async (busca: string) => (await buscarComposicoes(eng, { tabelaId: nd, busca }))[0];
  await adicionarComposicao(eng, id, (await comp("alvenaria")).id, { etapaId: etapa, quantidade: "20" });
  await adicionarComposicao(eng, id, (await comp("chapisco")).id, { etapaId: etapa, quantidade: "40" });
  const o = await obterOrcamento(eng, id);
  await salvarDadosGerais(eng, id, { ...o, responsavelTecnico: "Eng. Teste" });
  await salvarCronograma(eng, id, { periodos: 1, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "100" } } });
  await aprovarOrcamento(eng, id);
  return { obraId, orcamentoId: id, total: (await obterOrcamento(eng, id)).totais.total };
}

let seq = 0;
const dados = (orcamentoId: string, extra: Record<string, unknown> = {}) => ({
  orcamentoId, empresaId, numero: `CT-${Date.now()}-${++seq}`, objeto: "Muro de fechamento", regime: "preco_unitario" as const,
  natureza: "obra_nova" as const, dataAssinatura: "2026-11-02", dataOrdemServico: "2026-11-09", prazoExecucaoDias: 30,
  vigenciaFim: "2027-02-28", gestorId: gestor.id, fiscalId: fiscal.id, ...extra,
});

describe("empresas", () => {
  it("confere o CNPJ e não repete", async () => {
    expect(cnpjValido(CNPJ)).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    await expect(salvarEmpresa(direcao, { razaoSocial: "X", cnpj: "123", tipo: "contratada" })).rejects.toThrow(/CNPJ inválido/);
    await expect(salvarEmpresa(direcao, { razaoSocial: "Outra", cnpj: CNPJ, tipo: "contratada" })).rejects.toThrow(/Já existe/);
    await expect(salvarEmpresa(eng, { razaoSocial: "Y", cnpj: "11444777000161", tipo: "contratada" })).rejects.toThrow(SemPermissao);
  });
});

describe("contrato", () => {
  it("nasce do orçamento aprovado com o desconto da proposta e fica congelado ao assinar", async () => {
    const { obraId, orcamentoId, total } = await orcamentoAprovado();
    expect((await orcamentosParaContratar(gestor)).some((o) => o.id === orcamentoId)).toBe(true);
    const id = await criarContrato(gestor, dados(orcamentoId, { desconto: "10" }));
    let k = await obterContrato(gestor, id);
    expect(k.itens).toHaveLength(2);
    // Alvenaria: 87,33 x 0,90 = 78,597 → 78,60; 20 m² = 1.572,00.
    expect(k.itens[0]).toMatchObject({ numero: "1.1", precoUnitario: "78.60", total: "1572.00", executor: "contratada" });
    expect(Number(k.valorInicial)).toBeLessThan(Number(total));
    expect(k.valorOrcado).toBe(total);
    expect(k.saldo).toBe(k.valorInicial);

    await salvarContrato(gestor, id, { ...dados(orcamentoId), numero: k.numero, desconto: "0" });
    k = await obterContrato(gestor, id);
    expect(k.valorInicial).toBe(total);
    await definirExecutor(gestor, id, k.itens[1].id, "equipe_propria");

    await expect(assinarContrato(eng, id)).rejects.toThrow(SemPermissao);
    await assinarContrato(gestor, id);
    k = await obterContrato(gestor, id);
    expect(k.situacao).toBe("vigente");
    expect(k.itens[1].executor).toBe("equipe_propria");
    expect((await obterObra(eng, obraId)).situacao).toBe("contratada");

    await expect(salvarContrato(gestor, id, { ...dados(orcamentoId), numero: k.numero })).rejects.toThrow(/aditivo/);
    await expect(comContexto({ usuarioId: gestor.id, orgaoId: orgao }, (c) => c.query("update item_servico set quantidade = 1 where contrato_id = $1", [id])))
      .rejects.toThrow(/aditivo/);
    await expect(comContexto({ usuarioId: gestor.id, orgaoId: orgao }, (c) => c.query("update contrato set valor_inicial = 1 where id = $1", [id])))
      .rejects.toThrow(/aditivo/);
    await expect(criarContrato(gestor, dados(orcamentoId))).rejects.toThrow(/já tem contrato/);
  });

  it("exige os dados para assinar e confere datas", async () => {
    const { orcamentoId } = await orcamentoAprovado();
    await expect(criarContrato(gestor, dados(orcamentoId, { dataOrdemServico: "2026-10-01" }))).rejects.toThrow(/ordem de serviço/);
    await expect(criarContrato(gestor, dados(orcamentoId, { vigenciaFim: "2026-11-20" }))).rejects.toThrow(/vigência termina antes/);
    const id = await criarContrato(gestor, dados(orcamentoId, { fiscalId: null, vigenciaFim: null }));
    await expect(assinarContrato(gestor, id)).rejects.toThrow(/Fim da vigência.*Fiscal/);
  });

  it("execução direta não tem contratada e todos os itens são da equipe própria", async () => {
    const { orcamentoId } = await orcamentoAprovado();
    const id = await criarContrato(direcao, dados(orcamentoId, { regime: "direta", empresaId: null }));
    const k = await obterContrato(direcao, id);
    expect(k.empresaId).toBeNull();
    expect(k.itens.every((i) => i.executor === "equipe_propria")).toBe(true);
    await expect(definirExecutor(direcao, id, k.itens[0].id, "contratada")).rejects.toThrow(/equipe própria/);
  });

  it("garantia, alertas e isolamento", async () => {
    const { orcamentoId } = await orcamentoAprovado();
    const id = await criarContrato(gestor, dados(orcamentoId, { vigenciaFim: "2027-02-28" }));
    await assinarContrato(direcao, id);
    await adicionarGarantia(gestor, id, { modalidade: "seguro_garantia", valor: "100,00", inicio: "2026-11-02", vencimento: "2026-12-10" });
    const k = await obterContrato(gestor, id);
    expect(k.garantias).toHaveLength(1);
    expect(k.alertas.some((a) => /garantia/.test(a.texto))).toBe(true);
    await expect(obterContrato(outro, id)).rejects.toThrow(/não encontrado/);
    await expect(listarContratos(campo)).rejects.toThrow(SemPermissao);
  });
});

describe("cronograma", () => {
  async function contratoAssinado() {
    const { obraId, orcamentoId } = await orcamentoAprovado();
    const id = await criarContrato(gestor, dados(orcamentoId));
    await assinarContrato(gestor, id);
    return { obraId, contratoId: id };
  }

  it("gera as atividades do contrato, calcula o caminho crítico e aceita edição", async () => {
    const { contratoId } = await contratoAssinado();
    const cid = await criarCronograma(eng, contratoId, { inicio: "2026-11-09", calendario: "uteis" });
    let c = await obterCronograma(eng, cid);
    expect(c.atividades.map((a) => a.codigo)).toEqual(["M1", "1.1", "1.2", "M2"]);
    expect(c.atividades.every((a) => a.critica)).toBe(true);
    expect(c.atividades[0]).toMatchObject({ inicio: "2026-11-09", fim: "2026-11-09", duracao: 0 });
    expect(c.pendencias).toEqual([]);
    const pesos = c.atividades.reduce((s, a) => s + a.peso, 0);
    expect(pesos).toBeCloseTo(100);

    // Chapisco passa a começar junto com a alvenaria: deixa de ser crítico se for mais curto.
    const ch = c.atividades.find((a) => a.codigo === "1.2")!;
    const alv = c.atividades.find((a) => a.codigo === "1.1")!;
    await editarAtividade(eng, cid, ch.id, { codigo: "1.2", nome: ch.nome, duracao: 1, predecessoras: "1.1II", itemServicoId: ch.itemServicoId });
    c = await obterCronograma(eng, cid);
    const ch2 = c.atividades.find((a) => a.codigo === "1.2")!;
    expect(ch2.inicio).toBe(alv.inicio);
    expect(ch2.critica).toBe(alv.duracao <= 1);
    await expect(editarAtividade(eng, cid, alv.id, { codigo: "1.1", nome: alv.nome, duracao: alv.duracao, predecessoras: "1.2TI", itemServicoId: alv.itemServicoId }))
      .rejects.toThrow(/ciclo/);
    await expect(editarAtividade(eng, cid, alv.id, { codigo: "1.1", nome: alv.nome, duracao: alv.duracao, predecessoras: "9.9" })).rejects.toThrow(/não existe/);

    // Item dividido em duas atividades: 60% e 40%.
    await editarAtividade(eng, cid, alv.id, { codigo: "1.1", nome: "Alvenaria até 1 m", duracao: 2, predecessoras: "M1", itemServicoId: alv.itemServicoId, parcela: "60" });
    c = await obterCronograma(eng, cid);
    expect(c.pendencias.join(" ")).toMatch(/1\.1/);
    const nova = await adicionarAtividade(eng, cid, { codigo: "1.1b", nome: "Alvenaria até 2 m", duracao: 2, predecessoras: "1.1", itemServicoId: alv.itemServicoId, parcela: "40" });
    c = await obterCronograma(eng, cid);
    expect(c.pendencias).toEqual([]);
    await removerAtividade(eng, cid, nova);
    await expect(gravarLinhaBase(eng, cid)).rejects.toThrow(/100%/);
  });

  it("linha de base congela, recebe avanço e passa o avanço para a nova versão", async () => {
    const { obraId, contratoId } = await contratoAssinado();
    const cid = await criarCronograma(eng, contratoId, { inicio: "2026-11-09", calendario: "corridos" });
    await expect(registrarAvanco(fiscal, cid, (await obterCronograma(eng, cid)).atividades[1].id, { data: "2026-11-10", percentual: "10", justificativa: "x" }))
      .rejects.toThrow(/linha de base/);
    await gravarLinhaBase(eng, cid);
    let c = await obterCronograma(eng, cid);
    expect(c.situacao).toBe("linha_base");
    const alv = c.atividades.find((a) => a.codigo === "1.1")!;
    await expect(editarAtividade(eng, cid, alv.id, { codigo: "1.1", nome: "x", duracao: 1 })).rejects.toThrow(/linha de base não pode/);
    await expect(comContexto({ usuarioId: eng.id, orgaoId: orgao }, (k) => k.query("update atividade set duracao = 1 where id = $1", [alv.id])))
      .rejects.toThrow(/linha de base não pode/);

    await registrarAvanco(fiscal, cid, alv.id, { data: "2026-11-10", percentual: "40", justificativa: "Conferido em campo" });
    await expect(registrarAvanco(fiscal, cid, alv.id, { data: "2026-11-11", percentual: "30", justificativa: "x" })).rejects.toThrow(/menor/);
    await expect(registrarAvanco(campo, cid, alv.id, { data: "2026-11-11", percentual: "50", justificativa: "x" })).rejects.toThrow(SemPermissao);
    await expect(registrarAvanco(fiscal, cid, alv.id, { data: "2026-11-11", percentual: "50", justificativa: "" })).rejects.toThrow(/justificativa/);
    c = await obterCronograma(campo, cid);
    expect(c.atividades.find((a) => a.codigo === "1.1")!.avancoAtual).toBe(40);
    expect(c.indicadores.realizadoPct).toBeGreaterThan(0);
    expect(c.curva.at(-1)!.previstoPct).toBeCloseTo(100);

    await expect(novaVersaoCronograma(eng, cid, " ")).rejects.toThrow(/motivo/);
    const v2 = await novaVersaoCronograma(eng, cid, "Chuvas acima da média");
    const n = await obterCronograma(eng, v2);
    expect(n).toMatchObject({ versao: 2, situacao: "rascunho" });
    const alv2 = n.atividades.find((a) => a.codigo === "1.1")!;
    await editarAtividade(eng, v2, alv2.id, { codigo: "1.1", nome: alv2.nome, duracao: alv2.duracao + 3, predecessoras: alv2.predecessorasTexto, itemServicoId: alv2.itemServicoId });
    await gravarLinhaBase(direcao, v2);
    const antiga = await obterCronograma(eng, cid);
    expect(antiga.situacao).toBe("substituido");
    const atual = await obterCronograma(eng, v2);
    expect(atual.atividades.find((a) => a.codigo === "1.1")!.avancoAtual).toBe(40);
    expect(atual.termino > antiga.termino).toBe(true);
    const eventos = (await comContexto({ usuarioId: eng.id, orgaoId: orgao }, (k) => k.query("select resumo from obra_evento where obra_id = $1", [obraId]))).rows.map((r) => r.resumo).join(" | ");
    expect(eventos).toMatch(/Linha de base do cronograma gravada \(versão 2\): Chuvas/);
  });
});

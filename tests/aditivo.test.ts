import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import {
  alteracoesDoContrato, assinarAditivo, cancelarAditivo, criarAditivo, incluirItem, obterAditivo, registrarRevisao, removerItem, salvarAditivo,
} from "../src/servicos/aditivos";
import { assinarContrato, criarContrato, listarContratos, obterContrato, salvarEmpresa, type Natureza } from "../src/servicos/contratos";
import { aprovarMedicao, atestarMedicao, criarMedicao, obterMedicao, registrarNotaFiscal, salvarBoletim } from "../src/servicos/medicoes";
import { criarObra, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, gestor: Ator, fiscal: Ator, financeiro: Ator, outro: Ator;
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
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Aditivo Ltda", cnpj: "11.222.333/0001-81", tipo: "contratada" });
});
afterAll(fecharPool);

let seq = 0;
/** Contrato vigente: alvenaria 20 m² (R$ 87,33) e chapisco 40 m². */
async function contrato(o: { natureza?: Natureza; dataBase?: string } = {}) {
  const obraId = await criarObra(eng, dadosObra());
  await vincular(direcao, obraId, gestor.id, "gestor_contrato");
  await vincular(direcao, obraId, fiscal.id, "fiscal");
  await vincular(direcao, obraId, financeiro.id, "financeiro");
  const orc = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, orc, "Alvenaria");
  const comp = async (busca: string) => (await buscarComposicoes(eng, { tabelaId: nd, busca }))[0];
  await adicionarComposicao(eng, orc, (await comp("alvenaria")).id, { etapaId: etapa, quantidade: "20" });
  await adicionarComposicao(eng, orc, (await comp("chapisco")).id, { etapaId: etapa, quantidade: "40" });
  await salvarDadosGerais(eng, orc, { ...(await obterOrcamento(eng, orc)), responsavelTecnico: "Eng. Teste" });
  await salvarCronograma(eng, orc, { periodos: 1, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "100" } } });
  await aprovarOrcamento(eng, orc);
  const contratoId = await criarContrato(gestor, {
    orcamentoId: orc, empresaId, numero: `AD-${Date.now()}-${++seq}`, objeto: "Muro", regime: "preco_unitario", natureza: o.natureza ?? "obra_nova",
    dataAssinatura: "2026-11-02", dataOrdemServico: "2026-11-02", prazoExecucaoDias: 30, vigenciaFim: "2027-02-28", dataBase: o.dataBase ?? "2026-10-01",
    gestorId: gestor.id, fiscalId: fiscal.id,
  });
  await assinarContrato(gestor, contratoId);
  const k = await obterContrato(gestor, contratoId);
  return { contratoId, k, alvenaria: k.itens[0], chapisco: k.itens[1] };
}

const periodo = { periodoInicio: "2026-11-02", periodoFim: "2026-11-15" };

async function medirEAprovar(contratoId: string, linhas: { itemServicoId: string; quantidade: string }[]) {
  const id = await criarMedicao(eng, contratoId, periodo);
  await salvarBoletim(eng, id, { ...periodo, linhas: linhas.map((l) => ({ ...l, memoria: "Conferido" })) });
  await atestarMedicao(fiscal, id);
  await aprovarMedicao(gestor, id);
  return id;
}

describe("aditivo", () => {
  it("acresce, suprime, inclui item novo e estende prazo e vigência", async () => {
    const { contratoId, k, alvenaria, chapisco } = await contrato();
    const id = await criarAditivo(gestor, contratoId, {
      objeto: "Ampliação do muro", justificativa: "Trecho adicional pedido pela fiscalização", prazoDias: 15, novaVigencia: "2027-04-30",
    });
    await expect(criarAditivo(gestor, contratoId, { objeto: "x", justificativa: "y" })).rejects.toThrow(/em elaboração/);
    await salvarAditivo(gestor, id, {
      objeto: "Ampliação do muro", justificativa: "Trecho adicional pedido pela fiscalização", prazoDias: 15, novaVigencia: "2027-04-30",
      linhas: [{ itemServicoId: alvenaria.id, variacao: "4" }, { itemServicoId: chapisco.id, variacao: "-10" }],
    });
    const novo = await incluirItem(gestor, id, { etapa: alvenaria.etapa, descricao: "Pintura acrílica do muro", unidade: "m²", quantidade: "4", precoUnitario: "12,50" });

    let ad = await obterAditivo(gestor, id);
    const pu = Number(chapisco.precoUnitario);
    expect(ad.numero).toBe(1);
    expect(ad.acrescimo).toBe((4 * 87.33 + 50).toFixed(2));
    expect(ad.supressao).toBe((10 * pu).toFixed(2));
    expect(ad.linhas.find((l) => l.itemServicoId === novo)).toMatchObject({ novo: true, numero: "A01.1", anterior: "0.0000", nova: "4.0000" });
    expect(ad.prazoNovo).toBe(45);
    expect(ad.fimExecucaoNovo).toBe("2026-12-16");
    expect(ad.pendencias).toEqual([]);

    // Antes da assinatura, o item novo não entra na medição e o acréscimo não vale.
    const m = await criarMedicao(eng, contratoId, periodo);
    expect((await obterMedicao(eng, m)).linhas.some((l) => l.itemServicoId === novo)).toBe(false);
    await expect(salvarBoletim(eng, m, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "22", memoria: "x" }] })).rejects.toThrow(/passa da contratada/);

    await expect(assinarAditivo(eng, id, "2026-11-20")).rejects.toThrow(SemPermissao);
    await assinarAditivo(gestor, id, "2026-11-20");
    await expect(salvarAditivo(gestor, id, { objeto: "x", justificativa: "y", linhas: [] })).rejects.toThrow(/assinado/);
    await expect(comContexto({ usuarioId: gestor.id, orgaoId: orgao }, (c) => c.query("update aditivo_item set quantidade = 1 where aditivo_id = $1", [id])))
      .rejects.toThrow(/assinado/);

    const k2 = await obterContrato(gestor, contratoId);
    expect(k2.valorContratual).toBe((Number(k.valorInicial) + Number(ad.acrescimo) - Number(ad.supressao)).toFixed(2));
    expect(k2.prazoExecucaoDias).toBe(45);
    expect(k2.prazoInicialDias).toBe(30);
    expect(k2.vigenciaFim).toBe("2027-04-30");
    expect(k2.fimExecucao).toBe("2026-12-16");

    await salvarBoletim(eng, m, { ...periodo, linhas: [
      { itemServicoId: alvenaria.id, quantidade: "24", memoria: "Muro inteiro" },
      { itemServicoId: novo, quantidade: "2", memoria: "Trecho A" },
    ] });
    const mm = await obterMedicao(eng, m);
    expect(mm.linhas.find((l) => l.itemServicoId === alvenaria.id)).toMatchObject({ contratado: "24.0000", saldo: "0.0000", pctAcumulado: 100 });
    expect(mm.linhas.find((l) => l.itemServicoId === novo)).toMatchObject({ contratado: "4.0000", totalContratado: "50.00" });
    await expect(salvarBoletim(eng, m, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "25", memoria: "x" }] })).rejects.toThrow(/passa da contratada/);

    ad = await obterAditivo(gestor, id);
    expect(ad.situacao).toBe("assinado");
    expect(ad.linhas.find((l) => l.itemServicoId === alvenaria.id)).toMatchObject({ anterior: "20.0000", variacao: "4.0000", nova: "24.0000" });
  });

  it("confere os limites de 25% sem compensar acréscimo com supressão", async () => {
    const { contratoId, k, alvenaria, chapisco } = await contrato();
    const base = Number(k.valorInicial);
    // Acréscimo acima de 25% fica pendente e o banco recusa a assinatura.
    const a1 = await criarAditivo(gestor, contratoId, { objeto: "Acréscimo grande", justificativa: "Teste" });
    const q = Math.ceil((base * 0.26) / 87.33);
    await salvarAditivo(gestor, a1, { objeto: "Acréscimo grande", justificativa: "Teste", linhas: [{ itemServicoId: alvenaria.id, variacao: String(q) }] });
    expect((await obterAditivo(gestor, a1)).pendencias.join(" ")).toMatch(/limite de 25%/);
    await expect(assinarAditivo(gestor, a1, "2026-11-20")).rejects.toThrow(/passam do limite de 25%/);
    await cancelarAditivo(gestor, a1, "Refeito em valor menor");

    // 20% de acréscimo e 20% de supressão passam; um novo acréscimo de 10% não, mesmo com saldo líquido.
    const acr = Math.floor((base * 0.2) / 87.33);
    const sup = Math.floor((base * 0.2) / Number(chapisco.precoUnitario));
    const a2 = await criarAditivo(gestor, contratoId, { objeto: "Troca de serviços", justificativa: "Revisão de projeto" });
    await salvarAditivo(gestor, a2, { objeto: "Troca de serviços", justificativa: "Revisão de projeto", linhas: [
      { itemServicoId: alvenaria.id, variacao: String(acr) }, { itemServicoId: chapisco.id, variacao: String(-Math.min(sup, 39)) },
    ] });
    await assinarAditivo(gestor, a2, "2026-11-20");
    const a3 = await criarAditivo(gestor, contratoId, { objeto: "Mais alvenaria", justificativa: "Teste" });
    await salvarAditivo(gestor, a3, { objeto: "Mais alvenaria", justificativa: "Teste", linhas: [{ itemServicoId: alvenaria.id, variacao: String(Math.ceil((base * 0.1) / 87.33)) }] });
    await expect(assinarAditivo(gestor, a3, "2026-11-21")).rejects.toThrow(/acréscimos somam/);
    const alt = await alteracoesDoContrato(gestor, contratoId);
    expect(alt.aditivos.map((x) => x.situacao)).toEqual(["cancelado", "assinado", "rascunho"]);
    expect(alt.acrescimoPct).toBeGreaterThan(15);
    expect(alt.acrescimoPct).toBeLessThanOrEqual(25);
  });

  it("aceita 50% de acréscimo em reforma e não suprime abaixo do já medido", async () => {
    const { contratoId, k, alvenaria } = await contrato({ natureza: "reforma" });
    await medirEAprovar(contratoId, [{ itemServicoId: alvenaria.id, quantidade: "15" }]);
    const a1 = await criarAditivo(gestor, contratoId, { objeto: "Redução", justificativa: "Teste" });
    await expect(salvarAditivo(gestor, a1, { objeto: "Redução", justificativa: "Teste", linhas: [{ itemServicoId: alvenaria.id, variacao: "-6" }] }))
      .rejects.toThrow(/abaixo do já medido/);
    const q = Math.floor((Number(k.valorInicial) * 0.45) / 87.33);
    await salvarAditivo(gestor, a1, { objeto: "Ampliação", justificativa: "Teste", linhas: [{ itemServicoId: alvenaria.id, variacao: String(q) }] });
    await assinarAditivo(gestor, a1, "2026-11-20");
    expect((await obterContrato(gestor, contratoId)).itens.length).toBe(2);
    const alt = await alteracoesDoContrato(gestor, contratoId);
    expect(alt.limiteAcrescimoPct).toBe(50);
    expect(alt.acrescimoPct).toBeGreaterThan(40);
  });

  it("remove item novo, só aceita data e prazo coerentes e respeita perfis e órgão", async () => {
    const { contratoId, alvenaria } = await contrato();
    await expect(criarAditivo(fiscal, contratoId, { objeto: "x", justificativa: "y" })).rejects.toThrow(SemPermissao);
    const id = await criarAditivo(eng, contratoId, { objeto: "Prazo", justificativa: "Chuvas", prazoDias: 200 });
    expect((await obterAditivo(eng, id)).pendencias.join(" ")).toMatch(/depois do fim da vigência/);
    const novo = await incluirItem(eng, id, { etapa: alvenaria.etapa, descricao: "Rufo", unidade: "m", quantidade: "5", precoUnitario: "40" });
    await removerItem(eng, id, novo);
    expect((await obterAditivo(eng, id)).linhas.some((l) => l.novo)).toBe(false);
    await salvarAditivo(eng, id, { objeto: "Prazo", justificativa: "Chuvas", prazoDias: 20, novaVigencia: "2027-01-10", linhas: [] });
    await expect(assinarAditivo(gestor, id, "2026-11-20")).rejects.toThrow(/posterior à atual/);
    await salvarAditivo(eng, id, { objeto: "Prazo", justificativa: "Chuvas", prazoDias: 20, linhas: [] });
    await expect(assinarAditivo(gestor, id, "2099-01-01")).rejects.toThrow(/futura/);
    await expect(obterAditivo(outro, id)).rejects.toThrow();
    await assinarAditivo(gestor, id, "2026-11-20");
    const [k] = (await listarContratos(gestor)).filter((x) => x.id === contratoId);
    expect(k.prazoExecucaoDias).toBe(50);
    expect(k.aditivosAssinados).toBe(1);
  });
});

describe("revisão de preço", () => {
  it("reajusta pelo índice após 12 meses da data-base e aplica na medição", async () => {
    const { contratoId, alvenaria } = await contrato({ dataBase: "2025-10-01" });
    await expect(registrarRevisao(gestor, contratoId, { tipo: "reajuste", inicio: "2026-11-02", indice: "INCC-DI", indiceBase: "100", indiceAtual: "100" }))
      .rejects.toThrow(/não variaram/);
    await registrarRevisao(gestor, contratoId, { tipo: "reajuste", inicio: "2026-11-02", indice: "INCC-DI", indiceBase: "1.000,000", indiceAtual: "1.050,000" });
    await expect(registrarRevisao(gestor, contratoId, { tipo: "reajuste", inicio: "2026-11-10", indice: "INCC-DI", indiceBase: "1050", indiceAtual: "1060" }))
      .rejects.toThrow(/12 meses/);
    await expect(registrarRevisao(gestor, contratoId, { tipo: "reequilibrio", inicio: "2026-11-10", percentual: "2" })).rejects.toThrow(/justificativa/);

    const id = await medirEAprovar(contratoId, [{ itemServicoId: alvenaria.id, quantidade: "8" }]);
    const m = await obterMedicao(financeiro, id);
    expect(m.bruto).toBe("698.64");
    expect(m.reajuste).toBe("34.93");
    expect(m.reajustePctAplicado).toBe(5);
    expect(m.liquido).toBe("733.57");
    await expect(registrarNotaFiscal(financeiro, id, { numero: "1", data: "2026-11-20", valor: "698,64" })).rejects.toThrow(/733,57/);
    await registrarNotaFiscal(financeiro, id, { numero: "1", data: "2026-11-20", valor: "733,57" });

    await registrarRevisao(gestor, contratoId, {
      tipo: "reequilibrio", inicio: "2026-11-16", percentual: "2", justificativa: "Alta extraordinária do aço", documento: "Processo 123/2026",
    });
    const alt = await alteracoesDoContrato(gestor, contratoId);
    expect(alt.revisoes.map((r) => r.percentual)).toEqual(["5.0000", "2.0000"]);
    expect(alt.revisoes[1].fatorAcumulado).toBe("1.071000000000");
    expect(alt.reajustePct).toBeCloseTo(7.1, 6);
    const k = await obterContrato(gestor, contratoId);
    expect(k.reajusteMedido).toBe("34.93");
    expect(Number(k.valorAtual)).toBeCloseTo(Number(k.valorContratual) + 34.93 + Number(k.saldo) * 0.071, 1);
    // A base dos limites usa só o reajuste.
    expect(Number(alt.base)).toBeCloseTo(Number(k.valorInicial) * 1.05, 1);
  });

  it("recusa reajuste antes do aniversário e em execução direta", async () => {
    const { contratoId } = await contrato({ dataBase: "2026-10-01" });
    await expect(registrarRevisao(gestor, contratoId, { tipo: "reajuste", inicio: "2026-12-01", indice: "INCC-DI", indiceBase: "100", indiceAtual: "104" }))
      .rejects.toThrow(/01\/10\/2027/);
    await expect(registrarRevisao(eng, contratoId, { tipo: "reajuste", inicio: "2027-10-01", indice: "INCC-DI", indiceBase: "100", indiceAtual: "104" }))
      .rejects.toThrow(SemPermissao);
    await expect(comContexto({ usuarioId: gestor.id, orgaoId: orgao }, (c) =>
      c.query("insert into revisao_preco (orgao_id, contrato_id, numero, tipo, indice, indice_base, indice_atual, percentual, inicio, valor_saldo, valor_impacto) values ($1,$2,1,'reajuste','X',100,104,4,'2026-12-01',0,0)", [orgao, contratoId])))
      .rejects.toThrow(/12 meses/);
  });
});

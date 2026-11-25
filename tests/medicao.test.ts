import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { assinarContrato, criarContrato, obterContrato, salvarEmpresa } from "../src/servicos/contratos";
import { criarCronograma, gravarLinhaBase, obterCronograma } from "../src/servicos/cronogramas";
import {
  adicionarGlosa, adicionarRetencao, aprovarMedicao, atestarMedicao, cancelarMedicao, criarMedicao, devolverMedicao, extratoDoContrato,
  listarMedicoes, obterMedicao, registrarNotaFiscal, registrarPagamento, removerGlosa, salvarBoletim,
} from "../src/servicos/medicoes";
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
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Medição Ltda", cnpj: "11.444.777/0001-61", tipo: "contratada" });
});
afterAll(fecharPool);

let seq = 0;
/** Contrato vigente com alvenaria 20 m² (R$ 87,33/m²) e chapisco 40 m², e cronograma com linha de base. */
async function contratoComLinhaBase() {
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
    orcamentoId: orc, empresaId, numero: `MD-${Date.now()}-${++seq}`, objeto: "Muro", regime: "preco_unitario", natureza: "obra_nova",
    dataAssinatura: "2026-11-02", dataOrdemServico: "2026-11-02", prazoExecucaoDias: 30, vigenciaFim: "2027-02-28", gestorId: gestor.id, fiscalId: fiscal.id,
  });
  await assinarContrato(gestor, contratoId);
  const cid = await criarCronograma(eng, contratoId, { inicio: "2026-11-02", calendario: "corridos" });
  await gravarLinhaBase(eng, cid);
  const k = await obterContrato(gestor, contratoId);
  return { obraId, contratoId, cronogramaId: cid, alvenaria: k.itens[0], chapisco: k.itens[1] };
}

const periodo = { periodoInicio: "2026-11-02", periodoFim: "2026-11-15" };

describe("medição", () => {
  it("segue o fluxo elaborar, atestar e aprovar, baixa o saldo e leva o avanço ao cronograma", async () => {
    const { contratoId, cronogramaId, alvenaria, chapisco } = await contratoComLinhaBase();
    const id = await criarMedicao(eng, contratoId, periodo);
    await salvarBoletim(eng, id, { ...periodo, linhas: [
      { itemServicoId: alvenaria.id, quantidade: "8", memoria: "Pano A: 4,00 x 2,00" },
      { itemServicoId: chapisco.id, quantidade: "", memoria: "" },
    ] });
    let m = await obterMedicao(eng, id);
    expect(m.numero).toBe(1);
    expect(m.bruto).toBe("698.64");
    expect(m.linhas[0]).toMatchObject({ nesta: "8.0000", acumulado: "8.0000", saldo: "12.0000", pctAcumulado: 40 });
    expect(m.pendencias).toEqual([]);

    await expect(atestarMedicao(eng, id)).rejects.toThrow(SemPermissao);
    await expect(aprovarMedicao(gestor, id)).rejects.toThrow(/atestada/);
    await atestarMedicao(fiscal, id, "Conferido em campo");
    await expect(salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "9", memoria: "x" }] })).rejects.toThrow(/elaboração/);
    await expect(aprovarMedicao(fiscal, id)).rejects.toThrow(SemPermissao);
    await aprovarMedicao(gestor, id);

    m = await obterMedicao(eng, id);
    expect(m.situacao).toBe("aprovada");
    expect(m.valorBruto).toBe("698.64");
    expect(m.tramites.map((t) => t.acao)).toEqual(["elaborada", "atestada", "aprovada"]);
    const k = await obterContrato(gestor, contratoId);
    expect(k.medido).toBe("698.64");
    expect(Number(k.saldo)).toBeCloseTo(Number(k.valorInicial) - 698.64, 2);

    const c = await obterCronograma(eng, cronogramaId);
    const at = c.atividades.find((a) => a.itemServicoId === alvenaria.id)!;
    expect(at.avancoAtual).toBe(40);
    expect(at.avancos.at(-1)).toMatchObject({ origem: "medicao" });

    await expect(comContexto({ usuarioId: eng.id, orgaoId: orgao }, (x) => x.query("update item_medido set quantidade = 1 where medicao_id = $1", [id])))
      .rejects.toThrow(/elaboração/);
    await expect(comContexto({ usuarioId: eng.id, orgaoId: orgao }, (x) => x.query("update medicao set observacao = 'x' where id = $1", [id])))
      .rejects.toThrow(/ajuste/);
    await expect(cancelarMedicao(gestor, id, "erro")).rejects.toThrow(/ajuste/);
  });

  it("não deixa passar da quantidade contratada, exige memória e não sobrepõe períodos", async () => {
    const { contratoId, alvenaria } = await contratoComLinhaBase();
    const id = await criarMedicao(eng, contratoId, periodo);
    await expect(salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "21", memoria: "x" }] })).rejects.toThrow(/passa da contratada/);
    await expect(salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "5", memoria: " " }] })).rejects.toThrow(/memória/);
    await expect(salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "-1", memoria: "x" }] })).rejects.toThrow(/negativa/);
    await expect(criarMedicao(eng, contratoId, { periodoInicio: "2026-11-16", periodoFim: "2026-11-20" })).rejects.toThrow(/andamento/);
    await expect(atestarMedicao(fiscal, id)).rejects.toThrow(/sem itens/);

    await salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "15", memoria: "Panos A a C" }] });
    await atestarMedicao(fiscal, id);
    await aprovarMedicao(gestor, id);
    await expect(criarMedicao(eng, contratoId, { periodoInicio: "2026-11-10", periodoFim: "2026-11-20" })).rejects.toThrow(/sobrepõe/);
    const id2 = await criarMedicao(eng, contratoId, { periodoInicio: "2026-11-16", periodoFim: "2026-11-20" });
    expect((await obterMedicao(eng, id2)).linhas[0]).toMatchObject({ anterior: "15.0000", saldo: "5.0000" });
    await expect(salvarBoletim(eng, id2, { periodoInicio: "2026-11-16", periodoFim: "2026-11-20", linhas: [{ itemServicoId: alvenaria.id, quantidade: "6", memoria: "x" }] }))
      .rejects.toThrow(/passa da contratada/);
  });

  it("calcula glosas, retenções e líquido, e controla nota fiscal e pagamento", async () => {
    const { contratoId, alvenaria } = await contratoComLinhaBase();
    const id = await criarMedicao(eng, contratoId, periodo);
    await salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "10", memoria: "Pano A e B" }] });
    // Bruto 873,30. Glosa de 73,30. ISS de 5% sobre 400,00 = 20,00. Líquido = 780,00.
    await atestarMedicao(fiscal, id);
    const g = await adicionarGlosa(fiscal, id, { motivo: "Junta fora do padrão", valor: "73,30", itemServicoId: alvenaria.id });
    expect(g).toBeUndefined();
    await expect(adicionarGlosa(fiscal, id, { motivo: "x", valor: "900" })).rejects.toThrow(/passam do valor medido/);
    await adicionarRetencao(gestor, id, { tipo: "iss", base: "400", aliquota: "5" });
    await expect(adicionarRetencao(gestor, id, { tipo: "outra", base: "10", aliquota: "1" })).rejects.toThrow(/Descreva/);
    let m = await obterMedicao(gestor, id);
    expect(m).toMatchObject({ bruto: "873.30", glosa: "73.30", retencao: "20.00", liquido: "780.00" });

    await expect(registrarPagamento(financeiro, id, { data: "2026-11-20", valor: "100", empenho: "2026NE001" })).rejects.toThrow(/aprovada/);
    await aprovarMedicao(gestor, id);
    await expect(adicionarGlosa(fiscal, id, { motivo: "x", valor: "1" })).rejects.toThrow(/aprovada/);
    await expect(removerGlosa(fiscal, id, m.glosas[0].id)).rejects.toThrow(/aprovada/);

    await expect(registrarPagamento(financeiro, id, { data: hojeIso(), valor: "100", empenho: "2026NE001" })).rejects.toThrow(/nota fiscal/);
    await expect(registrarNotaFiscal(financeiro, id, { numero: "123", data: hojeIso(), valor: "873,30" })).rejects.toThrow(/menos as glosas/);
    await registrarNotaFiscal(financeiro, id, { numero: "123", data: hojeIso(), valor: "800,00" });
    await expect(registrarPagamento(eng, id, { data: hojeIso(), valor: "100", empenho: "2026NE001" })).rejects.toThrow(SemPermissao);
    await registrarPagamento(financeiro, id, { data: hojeIso(), valor: "500", empenho: "2026NE001", ordemBancaria: "OB 10" });
    m = await obterMedicao(financeiro, id);
    expect(m).toMatchObject({ pago: "500.00", aPagar: "280.00", situacaoPagamento: "parcial" });
    await expect(registrarPagamento(financeiro, id, { data: hojeIso(), valor: "280,01", empenho: "2026NE001" })).rejects.toThrow(/280,00/);
    await registrarPagamento(financeiro, id, { data: hojeIso(), valor: "280", empenho: "2026NE001" });
    expect((await obterMedicao(financeiro, id)).situacaoPagamento).toBe("paga");

    const e = await extratoDoContrato(gestor, contratoId);
    expect(e).toMatchObject({ medido: "873.30", glosado: "73.30", retido: "20.00", liquido: "780.00", pago: "780.00", aPagar: "0.00" });
    expect((await obterContrato(gestor, contratoId)).pago).toBe("780.00");
  });

  it("devolve com motivo, separa quem atesta de quem aprova e corrige por ajuste", async () => {
    const { contratoId, alvenaria } = await contratoComLinhaBase();
    const id = await criarMedicao(eng, contratoId, periodo);
    await salvarBoletim(eng, id, { ...periodo, linhas: [{ itemServicoId: alvenaria.id, quantidade: "6", memoria: "Pano A" }] });
    await atestarMedicao(direcao, id);
    await expect(aprovarMedicao(direcao, id)).rejects.toThrow(/Quem atestou/);
    await expect(devolverMedicao(gestor, id, " ")).rejects.toThrow(/motivo/);
    await devolverMedicao(gestor, id, "Rever a área do pano A");
    let m = await obterMedicao(eng, id);
    expect(m.situacao).toBe("rascunho");
    expect(m.tramites.at(-1)).toMatchObject({ acao: "devolvida", observacao: "Rever a área do pano A" });
    await atestarMedicao(fiscal, id);
    await aprovarMedicao(direcao, id);

    await expect(criarMedicao(eng, contratoId, { ...periodo, ajuste: true })).rejects.toThrow(/motivo/);
    const aj = await criarMedicao(eng, contratoId, { ...periodo, ajuste: true, observacao: "Área do pano A medida a maior" });
    await expect(salvarBoletim(eng, aj, { ...periodo, observacao: "Área do pano A medida a maior", linhas: [{ itemServicoId: alvenaria.id, quantidade: "-7", memoria: "x" }] }))
      .rejects.toThrow(/negativa/);
    await salvarBoletim(eng, aj, { ...periodo, observacao: "Área do pano A medida a maior", linhas: [{ itemServicoId: alvenaria.id, quantidade: "-1", memoria: "Pano A: 5,00 m²" }] });
    await atestarMedicao(fiscal, aj);
    await aprovarMedicao(gestor, aj);
    m = await obterMedicao(eng, aj);
    expect(m).toMatchObject({ numero: 2, ajuste: true, bruto: "-87.33" });
    expect((await obterContrato(gestor, contratoId)).medido).toBe("436.65");
    expect((await listarMedicoes(gestor, { contratoId })).length).toBe(2);
  });

  it("isola por órgão e por perfil", async () => {
    const { contratoId } = await contratoComLinhaBase();
    const id = await criarMedicao(eng, contratoId, periodo);
    await expect(obterMedicao(outro, id)).rejects.toThrow(/não encontrada/);
    await expect(criarMedicao(financeiro, contratoId, periodo)).rejects.toThrow(SemPermissao);
    await cancelarMedicao(eng, id, "Lançada por engano");
    expect((await obterMedicao(eng, id)).situacao).toBe("cancelada");
    const id2 = await criarMedicao(eng, contratoId, periodo);
    expect((await obterMedicao(eng, id2)).numero).toBe(2);
  });
});

function hojeIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

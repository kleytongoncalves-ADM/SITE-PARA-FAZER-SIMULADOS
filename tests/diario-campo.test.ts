import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { obterDiario } from "../src/servicos/campo";
import { assinarContrato, criarContrato, obterContrato, salvarEmpresa } from "../src/servicos/contratos";
import { criarCronograma, gravarLinhaBase, obterCronograma } from "../src/servicos/cronogramas";
import { dadosParaCampo, enviosDoDiario, juntarRelato, lerPacote, receberPacote, textoComplemento, type PacoteCampo } from "../src/servicos/diario-campo";
import { definirLocal, fichaDaObra, localValido, mapaObras } from "../src/servicos/mapa";
import { criarObra, mudarSituacao, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, aprovarOrcamento, criarOrcamento, obterOrcamento, salvarCronograma, salvarDadosGerais } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, gestor: Ator, fiscal: Ator, financeiro: Ator, campo: Ator;
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
  empresaId = await salvarEmpresa(direcao, { razaoSocial: "Construtora Offline Ltda", cnpj: "04.252.011/0001-10", tipo: "contratada" });
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

function pacote(autor: Ator, obraId: string, data: string, extra: Partial<PacoteCampo> = {}): PacoteCampo {
  return {
    chave: randomUUID(), usuarioId: autor.id, obraId, data, registradoEm: "2026-11-10T07:42:00-03:00",
    climaManha: "bom", climaTarde: "nublado", condicao: "praticavel", relato: "Alvenaria do trecho 2.",
    linhas: [
      { tipo: "efetivo", funcao: "Pedreiro", empresa: "Construtora Offline", quantidade: 3 },
      { tipo: "equipamento", descricao: "Betoneira 400 L", quantidade: 1, horas: 5 },
    ],
    assinar: false, comoComplemento: false, ...extra,
  };
}

describe("lançamento recebido do aparelho", () => {
  it("confere o formato antes de gravar", () => {
    const base = { chave: randomUUID(), usuarioId: randomUUID(), obraId: randomUUID(), data: "2026-11-10", registradoEm: "2026-11-10T10:00:00Z", linhas: [] };
    expect(lerPacote({ ...base, chave: "x" })).toMatch(/identificação/);
    expect(lerPacote({ ...base, data: "10/11/2026" })).toMatch(/data/);
    expect(lerPacote({ ...base, climaManha: "neve" })).toMatch(/Clima/);
    expect(lerPacote({ ...base, linhas: [{ tipo: "foto" }] })).toMatch(/desconhecido/);
    expect(lerPacote({ ...base, linhas: Array.from({ length: 201 }, () => ({ tipo: "efetivo", funcao: "A", quantidade: 1 })) })).toMatch(/200/);
    expect(lerPacote({ ...base, linhas: [{ tipo: "equipamento", descricao: "Grua", quantidade: 1, horas: "abc" }] })).toMatch(/Número/);
    const ok = lerPacote({ ...base, chave: base.chave.toUpperCase(), relato: "  ", assinar: "sim", linhas: [{ tipo: "efetivo", funcao: "Servente", quantidade: "2" }] });
    expect(typeof ok).toBe("object");
    expect(ok).toMatchObject({ chave: base.chave, relato: null, assinar: false, linhas: [{ tipo: "efetivo", funcao: "Servente", quantidade: 2, empresa: null }] });
  });

  it("junta o relato sem repetir e monta o complemento", () => {
    expect(juntarRelato(null, "A")).toBe("A");
    expect(juntarRelato("A", null)).toBe("A");
    expect(juntarRelato("Texto A. Texto B.", "Texto B.")).toBe("Texto A. Texto B.");
    expect(juntarRelato("A", "B")).toBe("A\n\nB");
    const t = textoComplemento(pacote(campo, randomUUID(), "2026-11-10", {
      linhas: [{ tipo: "ocorrencia", subtipo: "paralisacao", motivo: "chuva", horas: 2, descricao: "Chuva" }],
    }));
    expect(t).toContain("Registrado em campo em 10/11/2026 07:42");
    expect(t).toContain("Paralisação: Chuva (chuva, 2 h).");
  });

  it("grava uma vez só, mesmo enviado de novo ou ao mesmo tempo", async () => {
    const { obraId } = await obraEmExecucao();
    const p = pacote(campo, obraId, "2026-11-10");
    const r1 = await receberPacote(campo, p);
    expect(r1).toMatchObject({ situacao: "enviado", numero: 1, assinado: false });
    const r2 = await receberPacote(campo, p);
    expect(r2).toMatchObject({ situacao: "ja_enviado", diarioId: r1.diarioId });
    let d = await obterDiario(campo, r1.diarioId!);
    expect(d.totalEfetivo).toBe(3);
    expect(d.equipamentos).toHaveLength(1);
    expect(d.relato).toBe("Alvenaria do trecho 2.");
    expect(d.criadoPor).toBe("Pessoa campo");

    // Dois envios simultâneos do mesmo lançamento (duas abas, conexão instável).
    const q = pacote(campo, obraId, "2026-11-10", { relato: "Chegada de blocos." });
    const rs = await Promise.all([receberPacote(campo, q), receberPacote(campo, q), receberPacote(campo, q)]);
    expect(rs.map((r) => r.situacao).sort()).toEqual(["enviado", "ja_enviado", "ja_enviado"]);
    d = await obterDiario(campo, r1.diarioId!);
    expect(d.totalEfetivo).toBe(6);
    expect(d.equipamentos).toHaveLength(2);
    expect(d.relato).toBe("Alvenaria do trecho 2.\n\nChegada de blocos.");
    const envios = await enviosDoDiario(eng, r1.diarioId!);
    expect(envios).toHaveLength(2);
    expect(envios[0]).toMatchObject({ por: "Pessoa campo", linhas: 2, assinou: false, comoComplemento: false });
    expect(new Date(envios[0].registradoEm).toISOString()).toBe("2026-11-10T10:42:00.000Z");
  });

  it("recusa inteiro o lançamento com uma linha errada, de outro login ou de quem não lança", async () => {
    const { obraId, atividade } = await obraEmExecucao();
    const ruim = pacote(campo, obraId, "2026-11-11", {
      linhas: [{ tipo: "efetivo", funcao: "Servente", quantidade: 2 }, { tipo: "ocorrencia", subtipo: "paralisacao", descricao: "Parou" }],
    });
    expect(await receberPacote(campo, ruim)).toMatchObject({ situacao: "recusado", mensagem: expect.stringMatching(/motivo/) });
    expect(await consulta("select id from diario where obra_id = $1 and data = '2026-11-11'", [obraId])).toHaveLength(0);
    expect(await consulta("select id from diario_envio where id = $1", [ruim.chave])).toHaveLength(0);

    const avanco = pacote(campo, obraId, "2026-11-11", { linhas: [{ tipo: "servico", descricao: "", atividadeId: atividade.id, avancoPct: 150 }] });
    expect((await receberPacote(campo, avanco)).situacao).toBe("recusado");

    expect(await receberPacote(eng, pacote(campo, obraId, "2026-11-11"))).toMatchObject({ situacao: "recusado", mensagem: expect.stringMatching(/outro login/) });
    expect(await receberPacote(gestor, pacote(gestor, obraId, "2026-11-11"))).toMatchObject({ situacao: "recusado", mensagem: expect.stringMatching(/não lança/) });
    expect((await receberPacote(campo, pacote(campo, obraId, "2099-01-01"))).mensagem).toMatch(/futura/);
    expect((await receberPacote(campo, pacote(campo, obraId, "2026-11-11", { registradoEm: "2099-01-01T00:00:00Z" }))).mensagem).toMatch(/adiantada/);
    expect((await receberPacote(campo, pacote(campo, obraId, "2026-11-11", { relato: null, linhas: [], climaManha: null, climaTarde: null, condicao: null }))).mensagem).toMatch(/vazio/);
  });

  it("assina pelo login no envio; diário assinado recebe o lançamento como complemento", async () => {
    const { obraId, atividade } = await obraEmExecucao();
    await vincular(direcao, obraId, eng.id, "responsavel_tecnico").catch(() => {});
    const p = pacote(eng, obraId, "2026-11-12", { assinar: true, linhas: [{ tipo: "servico", descricao: "", atividadeId: atividade.id, avancoPct: 30 }] });
    const r = await receberPacote(eng, p);
    expect(r).toMatchObject({ situacao: "enviado", assinado: true });
    const d = await obterDiario(eng, r.diarioId!);
    expect(d.situacao).toBe("assinado");
    expect(d.assinadoPor).toBe("Pessoa engenheiro");
    expect(Math.abs(new Date(d.assinadoEm!).getTime() - Date.now())).toBeLessThan(60_000);

    const tarde = pacote(campo, obraId, "2026-11-12", { relato: "Concretagem da cinta.", linhas: [] });
    const c1 = await receberPacote(campo, tarde);
    expect(c1).toMatchObject({ situacao: "conflito", numero: d.numero, assinado: true });
    expect(await consulta("select id from diario_envio where id = $1", [tarde.chave])).toHaveLength(0);
    const c2 = await receberPacote(campo, { ...tarde, comoComplemento: true });
    expect(c2.situacao).toBe("enviado");
    const depois = await obterDiario(eng, r.diarioId!);
    expect(depois.complementos).toHaveLength(1);
    expect(depois.complementos[0].texto).toContain("Concretagem da cinta.");
    expect(depois.relato).toBe(d.relato);
    expect((await enviosDoDiario(eng, r.diarioId!)).map((e) => e.comoComplemento)).toEqual([false, true]);
  });

  it("quem não assina envia sem assinatura; diário sem relato nem serviço não é assinado, mas o lançamento entra", async () => {
    const { obraId } = await obraEmExecucao();
    const r = await receberPacote(campo, pacote(campo, obraId, "2026-11-13", { assinar: true }));
    expect(r).toMatchObject({ situacao: "enviado", assinado: false, mensagem: expect.stringMatching(/não assina/) });
    await vincular(direcao, obraId, eng.id, "responsavel_tecnico").catch(() => {});
    const s = await receberPacote(eng, pacote(eng, obraId, "2026-11-16", { assinar: true, relato: null }));
    expect(s).toMatchObject({ situacao: "enviado", assinado: false, mensagem: expect.stringMatching(/Enviado sem assinatura/) });
    expect((await obterDiario(eng, s.diarioId!)).totalEfetivo).toBe(3);
  });

  it("leva para o campo as obras em execução e as atividades", async () => {
    const { obraId, atividade } = await obraEmExecucao();
    await receberPacote(campo, pacote(campo, obraId, "2026-11-10"));
    const d = await dadosParaCampo({ ...campo, nome: "Pessoa campo", orgaoNome: "Órgão" });
    const o = d.obras.find((x) => x.id === obraId)!;
    expect(o.atividades.map((x) => x.id)).toContain(atividade.id);
    expect(o.diarios[0]).toMatchObject({ data: "2026-11-10", situacao: "rascunho" });
    expect(d.usuario.id).toBe(campo.id);
    expect(d.rotulos.clima.chuva_forte).toBe("Chuva forte");
    await expect(dadosParaCampo({ ...gestor, nome: "G", orgaoNome: "O" })).rejects.toThrow(SemPermissao);
  });
});

describe("mapa das obras", () => {
  it("marca o local, mostra a situação e o semáforo", async () => {
    const { obraId } = await obraEmExecucao();
    let m = await mapaObras(direcao);
    let o = m.obras.find((x) => x.id === obraId)!;
    expect(o).toMatchObject({ situacao: "em_execucao", latitude: null });
    expect(m.comSemaforo).toBe(true);
    expect(o.nivel).not.toBeNull();
    expect(localValido(-22.9, -43.2)).toBe(true);
    expect(localValido(48.85, 2.35)).toBe(false);
    await expect(definirLocal(eng, obraId, 48.85, 2.35)).rejects.toThrow(/fora do Brasil/);
    await expect(definirLocal(fiscal, obraId, -22.9, -43.2)).rejects.toThrow(SemPermissao);
    await definirLocal(eng, obraId, -22.9068467, -43.1728965);
    m = await mapaObras(direcao);
    o = m.obras.find((x) => x.id === obraId)!;
    expect(o.latitude).toBeCloseTo(-22.906847, 6);
    expect(o.longitude).toBeCloseTo(-43.172897, 5);
    const deCampo = await mapaObras(campo);
    expect(deCampo.comSemaforo).toBe(false);
    expect(deCampo.obras.find((x) => x.id === obraId)?.nivel).toBeNull();
  });

  it("abre a ficha completa da obra conforme o perfil", async () => {
    const { obraId } = await obraEmExecucao();
    await receberPacote(campo, pacote(campo, obraId, "2026-11-10"));
    const f = await fichaDaObra(direcao, obraId);
    expect(f).toMatchObject({ id: obraId, situacao: "Em execução", ordemServico: "OS 001/2026", art: "RJ2026000123" });
    expect(f.contratos).toHaveLength(1);
    expect(f.contratos![0]).toMatchObject({ empresa: "Construtora Offline Ltda", terminoPrevisto: "2026-12-02" });
    expect(f.diario!.ultimo).toMatchObject({ data: "2026-11-10", efetivo: 3, clima: "Bom de manhã, nublado à tarde" });
    expect(f.responsaveis.map((r) => r.papel)).toContain("Fiscal");
    expect(f.qualidade).toMatchObject({ abertas: 0 });
    const doCampo = await fichaDaObra(campo, obraId);
    expect(doCampo.contratos).toBeNull();
    expect(doCampo.diario).not.toBeNull();
    const outro = await novoUsuario(await novoOrgao("Outro"), "direcao");
    await expect(fichaDaObra(outro, obraId)).rejects.toThrow(/não encontrada/);
  });
});

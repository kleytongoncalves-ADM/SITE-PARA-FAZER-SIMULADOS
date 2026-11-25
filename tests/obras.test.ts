import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { comContexto, ErroDeRegra, fecharPool } from "../src/lib/db";
import { listarAuditoria } from "../src/servicos/auditoria";
import {
  criarObra, DadosInvalidos, editarObra, encerrarVinculo, linhaDoTempo, listarObras, listarVinculos,
  mudarSituacao, obterObra, validarObra, vincular, type Ator,
} from "../src/servicos/obras";
import { SemPermissao } from "../src/servicos/permissoes";
import { criarUsuario } from "../src/servicos/usuarios";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string;
let direcao: Ator, engenheiro: Ator, fiscal: Ator, campo: Ator, admin: Ator;

beforeAll(async () => {
  orgao = await novoOrgao();
  direcao = await novoUsuario(orgao, "direcao");
  engenheiro = await novoUsuario(orgao, "engenheiro");
  fiscal = await novoUsuario(orgao, "fiscal");
  campo = await novoUsuario(orgao, "campo");
  admin = await novoUsuario(orgao, "administrativo", { administrador: true });
});
afterAll(fecharPool);

describe("cadastro de obra", () => {
  it("valida os campos obrigatórios e as datas", () => {
    const e = validarObra({ ...dadosObra(), codigo: " ", nome: "", dataInicioPrevista: "2026-05-01", dataFimPrevista: "2026-04-01", latitude: -22.9 });
    expect(Object.keys(e).sort()).toEqual(["codigo", "dataFimPrevista", "latitude", "nome"]);
    expect(validarObra(dadosObra())).toEqual({});
  });

  it("cria em estudo, registra na linha do tempo e na auditoria", async () => {
    const id = await criarObra(direcao, dadosObra());
    expect((await obterObra(direcao, id)).situacao).toBe("em_estudo");
    expect((await linhaDoTempo(direcao, id)).map((e) => e.resumo)).toContain("Obra cadastrada.");
    const trilha = await listarAuditoria(direcao, { tabela: "obra", registroId: id });
    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({ acao: "criou", autor: "Pessoa direcao" });
  });

  it("recusa dados inválidos, código repetido e perfil sem permissão", async () => {
    await expect(criarObra(direcao, { ...dadosObra(), nome: "" })).rejects.toBeInstanceOf(DadosInvalidos);
    const d = dadosObra();
    await criarObra(direcao, d);
    await expect(criarObra(direcao, { ...dadosObra(), codigo: d.codigo })).rejects.toThrow("Já existe uma obra com este código.");
    await expect(criarObra(campo, dadosObra())).rejects.toBeInstanceOf(SemPermissao);
  });

  it("a auditoria guarda o valor anterior de cada campo alterado", async () => {
    const d = dadosObra({ nome: "Nome antigo", municipio: "Vila Exemplo" });
    const id = await criarObra(direcao, d);
    await editarObra(direcao, id, { ...d, nome: "Nome novo" });
    const alteracoes = (await listarAuditoria(direcao, { tabela: "obra", registroId: id })).filter((l) => l.acao === "alterou");
    expect(alteracoes).toHaveLength(1);
    expect(alteracoes[0]).toMatchObject({ campo: "nome", valorAnterior: "Nome antigo", valorNovo: "Nome novo" });
  });

  it("o banco não deixa excluir obra nem mexer no histórico", async () => {
    const id = await criarObra(direcao, dadosObra());
    const c = { usuarioId: direcao.id, orgaoId: orgao };
    await expect(comContexto(c, (x) => x.query("delete from obra where id = $1", [id]))).rejects.toThrow(/não podem ser excluídos/);
    await expect(comContexto(c, (x) => x.query("update auditoria set valor_novo = 'x' where registro_id = $1", [id]))).rejects.toThrow(/não podem ser alterados/);
    await expect(comContexto(c, (x) => x.query("delete from obra_evento where obra_id = $1", [id]))).rejects.toThrow(/não podem ser excluídos/);
  });
});

describe("situação da obra", () => {
  it("segue a sequência e recusa pular etapas", async () => {
    const id = await criarObra(direcao, dadosObra());
    await expect(mudarSituacao(direcao, id, "em_execucao", "OS 1/2026")).rejects.toThrow('A obra não pode passar de "Em estudo" para "Em execução".');
    await mudarSituacao(direcao, id, "orcada", "Orçamento 12/2026");
    expect((await obterObra(direcao, id)).situacao).toBe("orcada");
  });

  it("exige o documento que justifica a mudança", async () => {
    const id = await criarObra(direcao, dadosObra());
    await expect(mudarSituacao(direcao, id, "orcada", "   ")).rejects.toThrow(/Informe o documento/);
  });

  it("não deixa mudar a situação por fora do fluxo, direto no banco", async () => {
    const id = await criarObra(direcao, dadosObra());
    await expect(
      comContexto({ usuarioId: direcao.id, orgaoId: orgao }, (c) => c.query("update obra set situacao = 'concluida' where id = $1", [id])),
    ).rejects.toThrow(/só muda pelo fluxo/);
  });

  it("só entra em execução com ordem de serviço, ART e fiscal", async () => {
    const d = dadosObra();
    const id = await criarObra(direcao, d);
    await mudarSituacao(direcao, id, "orcada", "Orçamento 1");
    await mudarSituacao(direcao, id, "licitada", "Edital 3/2026");
    await mudarSituacao(direcao, id, "contratada", "Contrato 7/2026");
    await expect(mudarSituacao(direcao, id, "em_execucao", "OS 9/2026")).rejects.toThrow(/ordem de serviço/);
    await editarObra(direcao, id, { ...d, ordemServicoNumero: "OS 9/2026", ordemServicoData: "2026-03-02" });
    await expect(mudarSituacao(direcao, id, "em_execucao", "OS 9/2026")).rejects.toThrow(/ART ou RRT/);
    await editarObra(direcao, id, { ...d, ordemServicoNumero: "OS 9/2026", ordemServicoData: "2026-03-02", artNumero: "ART 2020260001" });
    await expect(mudarSituacao(direcao, id, "em_execucao", "OS 9/2026")).rejects.toThrow(/fiscal vinculado/);
    await vincular(direcao, id, fiscal.id, "fiscal");
    await mudarSituacao(direcao, id, "em_execucao", "OS 9/2026");
    expect((await obterObra(direcao, id)).situacao).toBe("em_execucao");

    const resumos = (await linhaDoTempo(direcao, id)).map((e) => e.resumo);
    expect(resumos).toContain('Situação alterada de "Contratada" para "Em execução". Documento: OS 9/2026');
    expect(resumos).toContain("Pessoa fiscal vinculado como fiscal.");
  });

  it("obra em execução não fica sem fiscal", async () => {
    const d = dadosObra({ formaExecucao: "direta", ordemServicoNumero: "OS 1", ordemServicoData: "2026-02-01", artNumero: "ART 1" });
    const id = await criarObra(direcao, d);
    await vincular(direcao, id, fiscal.id, "fiscal");
    await mudarSituacao(direcao, id, "orcada", "Orçamento 2");
    await mudarSituacao(direcao, id, "em_execucao", "OS 1");
    const v = (await listarVinculos(direcao, id)).find((x) => x.papel === "fiscal")!;
    await expect(encerrarVinculo(direcao, v.id)).rejects.toThrow(/não pode ficar sem fiscal/);
  });

  it("paralisar exige o motivo", async () => {
    const d = dadosObra({ formaExecucao: "direta", ordemServicoNumero: "OS 2", ordemServicoData: "2026-02-01", artNumero: "ART 2" });
    const id = await criarObra(direcao, d);
    await vincular(direcao, id, fiscal.id, "fiscal");
    await mudarSituacao(direcao, id, "orcada", "Orçamento 3");
    await mudarSituacao(direcao, id, "em_execucao", "OS 2");
    await expect(mudarSituacao(direcao, id, "paralisada", "Ofício 4")).rejects.toThrow(/motivo/);
    await mudarSituacao(direcao, id, "paralisada", "Ofício 4", "Interferência de rede elétrica");
    expect((await obterObra(direcao, id)).situacao).toBe("paralisada");
  });

  it("perfil sem permissão não muda a situação", async () => {
    const id = await criarObra(direcao, dadosObra());
    await vincular(direcao, id, fiscal.id, "fiscal");
    await expect(mudarSituacao(fiscal, id, "orcada", "Orçamento")).rejects.toBeInstanceOf(SemPermissao);
  });
});

describe("quem vê o quê", () => {
  it("quem não é da direção só vê as obras a que está vinculado", async () => {
    const id = await criarObra(direcao, dadosObra({ nome: "Obra reservada" }));
    expect((await listarObras(campo)).map((o) => o.id)).not.toContain(id);
    await expect(obterObra(campo, id)).rejects.toBeInstanceOf(ErroDeRegra);
    await vincular(direcao, id, campo.id, "campo");
    expect((await listarObras(campo)).map((o) => o.id)).toContain(id);
    expect((await obterObra(campo, id)).nome).toBe("Obra reservada");
  });

  it("o engenheiro que cadastra fica vinculado como responsável técnico", async () => {
    const id = await criarObra(engenheiro, dadosObra());
    expect(await listarVinculos(engenheiro, id)).toMatchObject([{ usuarioId: engenheiro.id, papel: "responsavel_tecnico" }]);
  });

  it("um órgão não enxerga nem altera as obras de outro, nem direto no banco", async () => {
    const id = await criarObra(direcao, dadosObra({ nome: "Obra do órgão A" }));
    const outroOrgao = await novoOrgao("Outro órgão");
    const direcaoB = await novoUsuario(outroOrgao, "direcao");
    expect(await listarObras(direcaoB)).toEqual([]);
    await expect(obterObra(direcaoB, id)).rejects.toBeInstanceOf(ErroDeRegra);
    const ctxB = { usuarioId: direcaoB.id, orgaoId: outroOrgao };
    expect((await comContexto(ctxB, (c) => c.query("select id from obra"))).rowCount).toBe(0);
    expect((await comContexto(ctxB, (c) => c.query("update obra set nome = 'invadida' where id = $1", [id]))).rowCount).toBe(0);
    await expect(
      comContexto(ctxB, (c) => c.query("insert into obra (orgao_id, codigo, nome, tipo, forma_execucao) values ($1,'X','X','outro','direta')", [orgao])),
    ).rejects.toThrow(/row-level security/);
    expect((await obterObra(direcao, id)).nome).toBe("Obra do órgão A");
  });

  it("não vincula usuário de outro órgão", async () => {
    const id = await criarObra(direcao, dadosObra());
    const estranho = await novoUsuario(await novoOrgao("Terceiro órgão"), "fiscal");
    await expect(vincular(direcao, id, estranho.id, "fiscal")).rejects.toThrow(/Usuário não encontrado/);
  });
});

describe("usuários", () => {
  it("só o administrador cria usuário, e a senha nunca aparece na auditoria", async () => {
    const dados = { nome: "Nova Pessoa", email: `nova.${Date.now()}@teste.exemplo`, perfil: "fiscal" as const, senha: "Inicial@12" };
    await expect(criarUsuario(direcao, dados)).rejects.toBeInstanceOf(SemPermissao);
    const id = await criarUsuario(admin, dados);
    await expect(criarUsuario(admin, dados)).rejects.toThrow("Já existe um usuário com este e-mail.");
    await expect(criarUsuario(admin, { ...dados, email: "x@y.zz", senha: "fraca" })).rejects.toBeInstanceOf(DadosInvalidos);
    const trilha = await listarAuditoria(admin, { tabela: "usuario", registroId: id });
    expect(JSON.stringify(trilha)).not.toContain("scrypt");
  });
});

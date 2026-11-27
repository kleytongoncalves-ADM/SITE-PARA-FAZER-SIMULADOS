import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, ErroDeRegra, fecharPool, pool } from "../src/lib/db";
import { hashToken } from "../src/servicos/auth";
import {
  abrirConversa, conversaDoFornecedor, conversaDoOrgao, conversasDoFornecedor, conversasDoOrgao, envioAutomatico, enviarMensagemContratante,
  enviarMensagemFornecedor, historicoDeComunicacao, ligarEmailAutomatico, naoLidasDoFornecedor, naoLidasDoOrgao, obterConfig, registrarAberturaManual,
} from "../src/servicos/comunicacao";
import { convidarPorEmail, criarSolicitacao, enviarSolicitacao, materiaisDoOrcamento, obterSolicitacao } from "../src/servicos/cotacoes";
import {
  alterarUsuarioDaEmpresa, cadastrarFornecedor, criarNovaSenha, criarUsuarioDaEmpresa, entrarFornecedor, fornecedorDaSessao, linkDeSenhaValido, pedirNovaSenha,
  salvarRascunhoNaArea, usuariosDaEmpresa, type Fornecedor,
} from "../src/servicos/fornecedores";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { criarObra, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, criarOrcamento } from "../src/servicos/orcamentos";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, outroOrgao: string, eng: Ator, leitor: Ator, estranho: Ator, nd: string;
let serie = 0;
function cnpj() {
  serie += 1;
  const base = `${String(Date.now()).slice(-5)}7${String(serie).padStart(2, "0")}0001`;
  const dv = (d: string) => { const p = d.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((t, x, i) => t + x * Number(d[i]), 0) % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(base);
  return `${base}${d1}${dv(base + d1)}`;
}
const prazo = (dias: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(Date.now() + dias * 86400000)).replace(" ", "T");

beforeAll(async () => {
  delete process.env.RESEND_API_KEY;
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c, cargaDemonstracao(), "demonstracao");
    await c.query("commit");
    nd = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
  } catch { await c.query("rollback"); nd = (await pool().query("select id from tabela_preco where regime = 'nao_desonerado' limit 1")).rows[0].id; } finally { c.release(); }
  orgao = await novoOrgao("Prefeitura do Chat");
  outroOrgao = await novoOrgao("Outra Prefeitura");
  eng = await novoUsuario(orgao, "engenheiro", { administrador: true });
  leitor = await novoUsuario(orgao, "fiscal");
  estranho = await novoUsuario(outroOrgao, "engenheiro", { administrador: true });
});
afterAll(fecharPool);

async function conta(): Promise<{ f: Fornecedor; cnpj: string; email: string }> {
  const cn = cnpj();
  const email = `chat.${serie}.${Date.now()}@fornecedor.exemplo`;
  const s = await cadastrarFornecedor({ cnpj: cn, razaoSocial: `Depósito ${serie}`, nome: "Bruno Admin", email, senha: "Forn@123", uf: "RJ" }, `10.1.0.${serie}`);
  return { f: (await fornecedorDaSessao(s.token))!, cnpj: cn, email };
}

async function cotacaoCom(convidados: { razao: string; email: string; cnpj: string }[]) {
  const obraId = await criarObra(eng, dadosObra());
  const orcamentoId = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, orcamentoId, "Alvenaria");
  await adicionarComposicao(eng, orcamentoId, (await buscarComposicoes(eng, { tabelaId: nd, busca: "alvenaria" }))[0].id, { etapaId: etapa, quantidade: "20" });
  const { materiais } = await materiaisDoOrcamento(eng, orcamentoId);
  const id = await criarSolicitacao(eng, orcamentoId, { titulo: "Blocos", prazo: prazo(5), criterio: "item", chaves: materiais.slice(0, 2).map((m) => m.chave) });
  const extras = ["A", "B", "C"].map((x) => ({ razao: `Extra ${x}`, email: `${x.toLowerCase()}@x.co`, cnpj: cnpj() }));
  await convidarPorEmail(eng, id, [...convidados, ...extras].slice(0, Math.max(3, convidados.length + 2)).map((c) => ({ empresa: c.razao, email: c.email, cnpj: c.cnpj })));
  await enviarSolicitacao(eng, id);
  return { id, s: await obterSolicitacao(eng, id) };
}

describe("usuários da empresa fornecedora", () => {
  it("administrador cria usuários com permissão; consulta só lê", async () => {
    const { f } = await conta();
    const email = `leitura.${Date.now()}@fornecedor.exemplo`;
    await criarUsuarioDaEmpresa(f, { nome: "Carla Leitura", email, papel: "consulta", senha: "Ler@1234" });
    const lista = await usuariosDaEmpresa(f);
    expect(lista.map((u) => u.papel).sort()).toEqual(["administrador", "consulta"]);
    const r = await entrarFornecedor(email, "Ler@1234");
    expect(r.ok).toBe(true);
    const carla = (await fornecedorDaSessao((r as { token: string }).token))!;
    expect(carla.contaId).toBe(f.contaId);
    expect(carla.papel).toBe("consulta");
    await expect(criarUsuarioDaEmpresa(carla, { nome: "X", email: "x@y.co", papel: "administrador", senha: "Ler@1234" })).rejects.toBeInstanceOf(ErroDeRegra);
    await expect(salvarRascunhoNaArea(carla, "00000000-0000-0000-0000-000000000000", { responsavelNome: "", validadeDias: "", prazoEntrega: "", itens: {} })).rejects.toBeInstanceOf(ErroDeRegra);
  });

  it("não deixa a empresa sem administrador ativo", async () => {
    const { f } = await conta();
    await expect(alterarUsuarioDaEmpresa(f, f.acessoId, { papel: "consulta", ativo: true })).rejects.toThrow(/administrador/);
    await expect(alterarUsuarioDaEmpresa(f, f.acessoId, { papel: "administrador", ativo: false })).rejects.toThrow(/administrador/);
  });
});

describe("esqueci minha senha", () => {
  it("sem serviço de e-mail, não cria link nenhum", async () => {
    const { email } = await conta();
    await pedirNovaSenha(email, "10.9.9.1");
    const n = (await pool().query("select count(*)::int n from redefinicao_senha_fornecedor r join acesso_fornecedor a on a.id = r.acesso_id where a.email = $1", [email])).rows[0].n;
    expect(n).toBe(0);
  });

  it("link vale uma vez e troca a senha", async () => {
    const { f, email } = await conta();
    const token = randomBytes(30).toString("base64url");
    await pool().query("insert into redefinicao_senha_fornecedor (token_hash, acesso_id, expira_em) values ($1,$2, now() + interval '1 hour')", [hashToken(token), f.acessoId]);
    expect(await linkDeSenhaValido(token)).toBe(true);
    await expect(criarNovaSenha(token, "fraca")).rejects.toBeInstanceOf(ErroDeRegra);
    await criarNovaSenha(token, "Nova@123");
    expect(await linkDeSenhaValido(token)).toBe(false);
    expect((await entrarFornecedor(email, "Nova@123")).ok).toBe(true);
    expect((await entrarFornecedor(email, "Forn@123")).ok).toBe(false);
    await expect(criarNovaSenha(token, "Outra@123")).rejects.toBeInstanceOf(ErroDeRegra);
  });
});

describe("envio manual por padrão", () => {
  it("sem configuração, nada sai sozinho e a cotação fica com o envio manual", async () => {
    const cfg = await obterConfig(eng);
    expect(cfg.emailAutomatico).toBe(false);
    expect(cfg.whatsappAutomatico).toBe(false);
    expect(await comContexto({ usuarioId: null, orgaoId: orgao }, (c) => envioAutomatico(c))).toEqual({ email: null, whatsapp: null });
    await expect(ligarEmailAutomatico(eng, true)).rejects.toBeInstanceOf(ErroDeRegra);
    const { s } = await cotacaoCom([]);
    expect(s.convites.every((c) => c.emailSituacao === "sem_servico")).toBe(true);
    const enviados = await comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => (await c.query("select count(*)::int n from registro_comunicacao where situacao = 'enviado'")).rows[0].n);
    expect(enviados).toBe(0);
  });

  it("abertura manual do e-mail fica no histórico só do órgão", async () => {
    const { s } = await cotacaoCom([]);
    await registrarAberturaManual(eng, { canal: "email", conviteId: s.convites[0].id, destino: "a@x.co", assunto: "Cotação" });
    const h = await historicoDeComunicacao(eng);
    expect(h.some((l) => l.canal === "email" && l.modo === "manual" && l.situacao === "aberto")).toBe(true);
    expect((await historicoDeComunicacao(estranho)).length).toBe(0);
  });
});

describe("chat com fornecedor cadastrado", () => {
  it("conversa ligada à cotação, com não lidas dos dois lados e dados separados", async () => {
    const forn = await conta();
    const outra = await conta();
    const { id, s } = await cotacaoCom([{ razao: forn.f.razaoSocial, email: forn.email, cnpj: forn.cnpj }]);
    const convite = s.convites.find((c) => c.cnpj === forn.cnpj)!;
    const semConta = s.convites.find((c) => c.cnpj !== forn.cnpj)!;
    await expect(abrirConversa(eng, { empresaId: semConta.empresaId, solicitacaoId: id })).rejects.toThrow(/cadastrados/);
    await expect(abrirConversa(leitor, { empresaId: convite.empresaId, solicitacaoId: id })).rejects.toThrow();

    const conversa = await abrirConversa(eng, { empresaId: convite.empresaId, solicitacaoId: id });
    expect(await abrirConversa(eng, { empresaId: convite.empresaId, solicitacaoId: id })).toBe(conversa);
    await enviarMensagemContratante(eng, conversa, "Bom dia, o bloco é de 9 furos?");
    expect(await naoLidasDoFornecedor(forn.f)).toBe(1);
    expect(await naoLidasDoFornecedor(outra.f)).toBe(0);
    expect(await conversaDoFornecedor(outra.f, conversa)).toBeNull();
    expect(await conversaDoOrgao(estranho, conversa)).toBeNull();
    expect(await conversasDoOrgao(estranho)).toHaveLength(0);

    const vista = (await conversaDoFornecedor(forn.f, conversa))!;
    expect(vista.mensagens).toHaveLength(1);
    expect(vista.mensagens[0]).toMatchObject({ autor: "contratante", minha: false });
    expect(await naoLidasDoFornecedor(forn.f)).toBe(0);
    await enviarMensagemFornecedor(forn.f, conversa, "Sim, 9 furos, 14x19x29.");
    expect(await naoLidasDoOrgao(eng)).toBe(1);
    expect((await conversasDoFornecedor(forn.f))[0]).toMatchObject({ id: conversa, orgao: "Prefeitura do Chat" });

    const aberta = (await conversaDoOrgao(eng, conversa))!;
    expect(aberta.mensagens.map((m) => m.autor)).toEqual(["contratante", "fornecedor"]);
    expect(aberta.mensagens[1].autorNome).toMatch(/Bruno Admin/);
    expect(await naoLidasDoOrgao(eng)).toBe(0);
    expect((await conversaDoOrgao(leitor, conversa))!.podeEscrever).toBe(false);
    await expect(enviarMensagemContratante(leitor, conversa, "oi")).rejects.toThrow();

    // Usuário só de consulta lê, mas não escreve.
    const email = `ver.${Date.now()}@fornecedor.exemplo`;
    await criarUsuarioDaEmpresa(forn.f, { nome: "Davi Consulta", email, papel: "consulta", senha: "Ver@1234" });
    const davi = (await fornecedorDaSessao(((await entrarFornecedor(email, "Ver@1234")) as { token: string }).token))!;
    expect((await conversaDoFornecedor(davi, conversa))!.mensagens).toHaveLength(2);
    await expect(enviarMensagemFornecedor(davi, conversa, "oi")).rejects.toBeInstanceOf(ErroDeRegra);
  });
});

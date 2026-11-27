import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, ErroDeRegra, fecharPool, pool } from "../src/lib/db";
import { salvarEmpresa } from "../src/servicos/contratos";
import {
  adicionarConvite, cancelar, convidarPorEmail, criarSolicitacao, enviarSolicitacao, gerarLinkAberto, materiaisDoOrcamento, obterSolicitacao, prorrogar,
  type DadosProposta,
} from "../src/servicos/cotacoes";
import { emailDeConvite } from "../src/servicos/email";
import {
  adicionarExperiencia, cadastrarFornecedor, chegarPeloConvite, chegarPeloLinkAberto, cotacaoDoFornecedor, cotacoesDoFornecedor, declinarNaArea, EmpresaJaCadastrada,
  entrarFornecedor, enviarPropostaNaArea, fornecedorDaSessao, historicoDaConta, mascararEmail, mensagensDoFornecedor, naoLidas, salvarRascunhoNaArea, type Fornecedor,
} from "../src/servicos/fornecedores";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { criarObra, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, criarOrcamento } from "../src/servicos/orcamentos";
import { buscarComposicoes } from "../src/servicos/precos";
import { DadosInvalidos } from "../src/servicos/obras";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, nd: string;
let serie = 0;
function cnpj() {
  serie += 1;
  const base = `${String(Date.now()).slice(-5)}9${String(serie).padStart(2, "0")}0001`;
  const dv = (d: string) => { const p = d.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((t, x, i) => t + x * Number(d[i]), 0) % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(base);
  return `${base}${d1}${dv(base + d1)}`;
}
const prazo = (dias: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(Date.now() + dias * 86400000)).replace(" ", "T");
const consulta = (sql: string, p: unknown[] = []) => comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => (await c.query(sql, p)).rows);

beforeAll(async () => {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c, cargaDemonstracao(), "demonstracao");
    await c.query("commit");
    nd = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
  } catch { await c.query("rollback"); nd = (await pool().query("select id from tabela_preco where regime = 'nao_desonerado' limit 1")).rows[0].id; } finally { c.release(); }
  orgao = await novoOrgao("Prefeitura de Teste");
  eng = await novoUsuario(orgao, "engenheiro");
  direcao = await novoUsuario(orgao, "direcao");
});
afterAll(fecharPool);

async function rascunho() {
  const obraId = await criarObra(eng, dadosObra());
  const orcamentoId = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, orcamentoId, "Alvenaria");
  await adicionarComposicao(eng, orcamentoId, (await buscarComposicoes(eng, { tabelaId: nd, busca: "alvenaria" }))[0].id, { etapaId: etapa, quantidade: "20" });
  const { materiais } = await materiaisDoOrcamento(eng, orcamentoId);
  return criarSolicitacao(eng, orcamentoId, { titulo: "Blocos e argamassa", prazo: prazo(5), criterio: "item", chaves: materiais.slice(0, 2).map((m) => m.chave) });
}

async function contaNova(extra: Partial<Parameters<typeof cadastrarFornecedor>[0]> = {}): Promise<{ f: Fornecedor; cnpj: string; email: string }> {
  const cn = extra.cnpj ?? cnpj();
  const email = `vendas.${serie}.${Date.now()}@fornecedor.exemplo`;
  const s = await cadastrarFornecedor({ cnpj: cn, razaoSocial: `Casa de Materiais ${serie}`, nome: "Ana Vendas", email, senha: "Forn@123", uf: "RJ", ...extra }, `10.0.0.${serie}`);
  return { f: (await fornecedorDaSessao(s.token))!, cnpj: cn, email };
}

function propostaPara(materiais: { id: string }[], preco = "12,50"): DadosProposta {
  return { responsavelNome: "Ana Vendas", validadeDias: "30", prazoEntrega: "7", itens: Object.fromEntries(materiais.map((m) => [m.id, { preco, marca: "Marca Boa" }])) };
}

describe("conta do fornecedor", () => {
  it("cadastra, entra e lê a sessão", async () => {
    const { f, email, cnpj: cn } = await contaNova();
    expect(f.cnpj).toBe(cn);
    const r = await entrarFornecedor(email.toUpperCase(), "Forn@123");
    expect(r.ok).toBe(true);
    expect((await entrarFornecedor(email, "errada1!")).ok).toBe(false);
  });

  it("uma conta por CNPJ, com o e-mail mascarado", async () => {
    const { cnpj: cn } = await contaNova();
    await expect(contaNova({ cnpj: cn })).rejects.toBeInstanceOf(EmpresaJaCadastrada);
    expect(mascararEmail("joao@empresa.com.br")).toBe("j***@empresa.com.br");
  });

  it("confere CNPJ, e-mail e a regra de senha", async () => {
    await expect(cadastrarFornecedor({ cnpj: "11111111111111", razaoSocial: "X", nome: "Ana", email: "a@b.co", senha: "Forn@123" }, null)).rejects.toBeInstanceOf(DadosInvalidos);
    await expect(cadastrarFornecedor({ cnpj: cnpj(), razaoSocial: "X", nome: "Ana", email: "a@b.co", senha: "semnumero" }, null)).rejects.toBeInstanceOf(DadosInvalidos);
  });
});

describe("convite por e-mail (Fornecedor +)", () => {
  it("confere as linhas antes de gravar e aponta CNPJ repetido", async () => {
    const id = await rascunho();
    const cn = cnpj();
    const r = await convidarPorEmail(eng, id, [
      { empresa: "Alfa", email: "alfa@x.co", cnpj: cn },
      { empresa: "Beta", email: "beta@x.co", cnpj: cn },
      { empresa: "Gama", email: "gama", cnpj: cnpj() },
    ]);
    expect(r.criados).toBe(0);
    expect(r.erros[1]).toMatch(/repetido/);
    expect(r.erros[2]).toMatch(/E-mail/);
    expect((await obterSolicitacao(eng, id)).convites).toHaveLength(0);
  });

  it("grava vários de uma vez; sem serviço de e-mail, marca para copiar o link", async () => {
    const id = await rascunho();
    const r = await convidarPorEmail(eng, id, [1, 2, 3].map((i) => ({ empresa: `Fornecedor ${i}`, email: `f${i}@x.co`, cnpj: cnpj() })));
    expect(r.criados).toBe(3);
    let s = await obterSolicitacao(eng, id);
    expect(s.convites.every((c) => c.via === "email" && c.emailSituacao === "pendente")).toBe(true);
    await enviarSolicitacao(eng, id);
    s = await obterSolicitacao(eng, id);
    expect(s.convites.every((c) => c.emailSituacao === "sem_servico" && c.link)).toBe(true);
    // Já convidado: recusado na linha.
    const de2 = await convidarPorEmail(eng, id, [{ empresa: "Fornecedor 1", email: "f1@x.co", cnpj: s.convites[0].cnpj }]);
    expect(de2.erros[0]).toMatch(/já foi convidada/);
  });

  it("o fornecedor entra pelo link do e-mail, encontra a cotação e responde item a item", async () => {
    const id = await rascunho();
    const conta = await contaNova({ cnpj: cnpj() });
    const outro = await contaNova();
    await convidarPorEmail(eng, id, [
      { empresa: conta.f.razaoSocial, email: conta.email, cnpj: conta.cnpj },
      { empresa: "Outra", email: "outra@x.co", cnpj: cnpj() },
      { empresa: "Mais uma", email: "mais@x.co", cnpj: cnpj() },
    ]);
    await enviarSolicitacao(eng, id);
    const s = await obterSolicitacao(eng, id);
    const meu = s.convites.find((c) => c.cnpj === conta.cnpj)!;
    // Quem já tem conta recebe a cotação no painel sozinho, com aviso na caixa.
    expect(meu.contaId).toBe(conta.f.contaId);
    expect(await naoLidas(conta.f)).toBe(1);
    const token = meu.link!.replace("/cotacao/", "");
    expect(await chegarPeloConvite(outro.f, token, null)).toMatchObject({ tipo: "outra_empresa" });
    expect(await chegarPeloConvite(conta.f, token, null)).toEqual({ tipo: "cotacao", conviteId: meu.id });
    const lista = await cotacoesDoFornecedor(conta.f);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ estado: "pendente", itens: 2, orgao: "Prefeitura de Teste" });
    expect(await cotacoesDoFornecedor(outro.f)).toHaveLength(0);
    await expect(cotacaoDoFornecedor(outro.f, meu.id, null)).resolves.toBeNull();

    const p = (await cotacaoDoFornecedor(conta.f, meu.id, null))!;
    expect(await naoLidas(conta.f)).toBe(0);
    await salvarRascunhoNaArea(conta.f, meu.id, propostaPara(p.materiais));
    expect((await cotacoesDoFornecedor(conta.f))[0].estado).toBe("rascunho");
    const r = await enviarPropostaNaArea(conta.f, meu.id, propostaPara(p.materiais), "10.1.1.1");
    expect(r.versao).toBe(1);
    expect((await cotacoesDoFornecedor(conta.f))[0].estado).toBe("enviada");
    const depois = await obterSolicitacao(eng, id);
    expect(depois.convites.find((c) => c.id === meu.id)!.situacao).toBe("respondeu");
    await expect(enviarPropostaNaArea(outro.f, meu.id, propostaPara(p.materiais), null)).rejects.toBeInstanceOf(ErroDeRegra);
  });
});

describe("link compartilhado", () => {
  it("permite enviar sem três convidados e cria o convite de quem se cadastra", async () => {
    const id = await rascunho();
    await gerarLinkAberto(eng, id);
    let s = await obterSolicitacao(eng, id);
    expect(s.linkAberto).toMatch(/^\/convite\//);
    const token = s.linkAberto!.replace("/convite/", "");
    const antes = await contaNova();
    expect(await chegarPeloLinkAberto(antes.f, token, null)).toEqual({ tipo: "indisponivel", situacao: "rascunho" });
    await enviarSolicitacao(eng, id);
    const conta = await contaNova();
    const r = await chegarPeloLinkAberto(conta.f, token, null);
    expect(r.tipo).toBe("cotacao");
    // De novo, ou por outro aparelho: mesmo convite, sem duplicar.
    expect(await chegarPeloLinkAberto(conta.f, token, null)).toEqual(r);
    s = await obterSolicitacao(eng, id);
    expect(s.convites).toHaveLength(1);
    expect(s.convites[0]).toMatchObject({ via: "link", contaId: conta.f.contaId, situacao: "abriu" });
    const empresas = await consulta("select conta_fornecedor_id from empresa where cnpj = $1", [conta.cnpj]);
    expect(empresas).toEqual([{ conta_fornecedor_id: conta.f.contaId }]);
    // Link trocado: o antigo para de funcionar, quem tem conta continua vendo a cotação.
    await gerarLinkAberto(eng, id, true);
    expect(await chegarPeloLinkAberto(conta.f, token, null)).toEqual({ tipo: "indisponivel", situacao: "invalido" });
    expect(await cotacoesDoFornecedor(conta.f)).toHaveLength(1);
  });

  it("empresa já cadastrada no órgão e já convidada por e-mail entra no mesmo convite", async () => {
    const id = await rascunho();
    const conta = await contaNova();
    const e = await salvarEmpresa(direcao, { razaoSocial: "Nome no órgão", cnpj: conta.cnpj, tipo: "fornecedor" });
    await adicionarConvite(eng, id, { empresaId: e, email: "compras@x.co" });
    await gerarLinkAberto(eng, id);
    await enviarSolicitacao(eng, id);
    const s = await obterSolicitacao(eng, id);
    const r = await chegarPeloLinkAberto(conta.f, s.linkAberto!.replace("/convite/", ""), null);
    expect(r).toEqual({ tipo: "cotacao", conviteId: s.convites[0].id });
    expect((await obterSolicitacao(eng, id)).convites).toHaveLength(1);
  });
});

describe("avisos e histórico", () => {
  it("prorrogação e cancelamento chegam na caixa; declinar pela área", async () => {
    const id = await rascunho();
    await gerarLinkAberto(eng, id);
    await enviarSolicitacao(eng, id);
    const conta = await contaNova();
    const s = await obterSolicitacao(eng, id);
    const r = await chegarPeloLinkAberto(conta.f, s.linkAberto!.replace("/convite/", ""), null);
    if (r.tipo !== "cotacao") throw new Error("sem convite");
    await prorrogar(eng, id, prazo(8), "Pedido dos fornecedores da região.");
    expect((await mensagensDoFornecedor(conta.f)).map((m) => m.tipo)).toContain("prorrogacao");
    await declinarNaArea(conta.f, r.conviteId, "Sem estoque", null);
    expect((await cotacoesDoFornecedor(conta.f))[0].estado).toBe("declinada");
    await cancelar(eng, id, "Obra suspensa pela secretaria.");
    expect((await cotacoesDoFornecedor(conta.f))[0].estado).toBe("cancelada");
    expect((await mensagensDoFornecedor(conta.f)).map((m) => m.tipo)).toContain("cancelamento");
  });

  it("conta recebidas e respondidas, e guarda a experiência declarada", async () => {
    const { f } = await contaNova();
    await adicionarExperiencia(f, { cliente: "Prefeitura de Exemplo", servico: "Fornecimento de blocos", ano: "2025", uf: "rj", quantidade: "12.000 un" });
    await expect(adicionarExperiencia(f, { cliente: "", servico: "x" })).rejects.toThrow(/cliente/);
    expect((await historicoDaConta(f.contaId)).recebidas).toBe(0);
  });

  it("e-mail do convite traz quem pede, prazo, o link e os passos", () => {
    const m = emailDeConvite({ orgao: "Prefeitura X", fornecedor: "Casa Y", numero: 7, titulo: "Blocos", obra: "Muro", itens: 3, prazo: "10/12/2026 17:00", link: "https://exemplo/cotacao/abc", temConta: false });
    expect(m.assunto).toContain("Prefeitura X");
    expect(m.html).toContain("https://exemplo/cotacao/abc");
    expect(m.html).toContain("Cadastre a empresa");
    expect(m.texto).toContain("Nº 007".replace("Nº ", "nº "));
  });
});

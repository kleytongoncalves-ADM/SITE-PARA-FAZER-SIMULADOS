import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { apurar, comparar, validarPesos, type MaterialC, type PropostaC } from "../src/servicos/cotacao-calculo";
import { salvarEmpresa } from "../src/servicos/contratos";
import {
  adicionarConvite, avaliarItem, cancelar, criarSolicitacao, declinar, encerrarAntes, enviarProposta, enviarSolicitacao, excluirRascunho, homologar,
  lancarProposta, listarSolicitacoes, materiaisDoOrcamento, novoLink, obterSolicitacao, paginaDoFornecedor, prorrogar, reabrir, salvarRascunho,
  type DadosProposta,
} from "../src/servicos/cotacoes";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { criarObra, vincular, type Ator } from "../src/servicos/obras";
import { adicionarComposicao, adicionarEtapa, criarOrcamento, obterOrcamento } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, fiscal: Ator, campo: Ator, outro: Ator, nd: string;
let serie = 0;
function cnpj() {
  serie += 1;
  const base = `${String(Date.now()).slice(-6)}${String(serie).padStart(2, "0")}0001`;
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
  } finally { c.release(); }
  orgao = await novoOrgao();
  eng = await novoUsuario(orgao, "engenheiro");
  direcao = await novoUsuario(orgao, "direcao");
  fiscal = await novoUsuario(orgao, "fiscal");
  campo = await novoUsuario(orgao, "campo");
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
});
afterAll(fecharPool);

async function orcamento() {
  const obraId = await criarObra(eng, dadosObra());
  const id = await criarOrcamento(eng, { obraId, nome: "Muro", tabelaId: nd });
  const etapa = await adicionarEtapa(eng, id, "Alvenaria");
  for (const [b, q] of [["alvenaria", "20"], ["reboco", "40"]] as const)
    await adicionarComposicao(eng, id, (await buscarComposicoes(eng, { tabelaId: nd, busca: b }))[0].id, { etapaId: etapa, quantidade: q });
  return { obraId, id };
}

/** Solicitação aberta com n fornecedores. Devolve os links de cada um. */
async function aberta(n = 3, extra: Partial<Parameters<typeof criarSolicitacao>[2]> = {}) {
  const { id: orcamentoId } = await orcamento();
  const { materiais } = await materiaisDoOrcamento(eng, orcamentoId);
  const escolhidos = materiais.slice(0, 3);
  const id = await criarSolicitacao(eng, orcamentoId, { titulo: "Materiais do muro", prazo: prazo(5), criterio: "item", chaves: escolhidos.map((m) => m.chave), ...extra });
  const empresas: string[] = [];
  for (let i = 0; i < n; i++) {
    const cn = cnpj();
    const e = await salvarEmpresa(direcao, { razaoSocial: `Fornecedor ${String.fromCharCode(65 + i)} ${serie}`, cnpj: cn, tipo: "fornecedor" });
    empresas.push(cn);
    await adicionarConvite(eng, id, { empresaId: e, motivo: "Fornecedor da região" });
  }
  await enviarSolicitacao(eng, id, n < 3 ? "Só há dois fornecedores na região." : null);
  const s = await obterSolicitacao(eng, id);
  const links = s.convites.map((c) => c.link!.replace("/cotacao/", ""));
  const cnpjs = s.convites.map((c) => c.cnpj);
  return { id, orcamentoId, s, links, cnpjs, escolhidos };
}

function proposta(s: Awaited<ReturnType<typeof obterSolicitacao>>, cnpjEmpresa: string, precos: (string | null)[], extra: Partial<DadosProposta> = {}): DadosProposta {
  return {
    cnpj: cnpjEmpresa, responsavelNome: "Vendedor", prazoEntrega: "10", validadeDias: "30",
    itens: Object.fromEntries(s.materiais.map((m, i) => [m.id, precos[i] == null ? { indisponivel: true } : { preco: precos[i]!, marca: "Marca X" }])), ...extra,
  };
}

describe("contas da cotação", () => {
  const mat = (id: string, q: string, ref: string | null): MaterialC => ({ id, codigo: id, descricao: id, unidade: "un", quantidade: q, precoReferencia: ref, semSinapi: false });
  const prop = (id: string, itens: Record<string, string | null>, extra: Partial<PropostaC> = {}): PropostaC => ({
    conviteId: id, fornecedor: id, enviadaEm: `2026-01-0${id.length}T10:00:00Z`, prazoEntrega: 10, pagamentoDias: null, garantiaMeses: null, historico: null,
    itens: Object.fromEntries(Object.entries(itens).map(([k, v]) => [k, { preco: v, marca: v ? "M" : null, modelo: null, indisponivel: v == null }])), ...extra,
  });
  const materiais = [mat("m1", "100", "10.00"), mat("m2", "50", "20.00")];
  const propostas = [prop("a", { m1: "9.00", m2: "22.00" }), prop("bb", { m1: "9.50", m2: "18.00" }), prop("ccc", { m1: "8.00", m2: null })];

  it("mapa: menor por item, diferença sobre a referência e economia", () => {
    const m = comparar(materiais, propostas, [], "arredondar");
    expect(m.totalReferencia).toBe("2000.00");
    expect(m.linhas[0].menor).toMatchObject({ conviteId: "ccc", preco: "8.0000", total: "800.00" });
    expect(m.linhas[1].menor).toMatchObject({ conviteId: "bb", total: "900.00" });
    expect(m.linhas[0].ofertas[0]).toMatchObject({ difSinapi: -10, classe: "abaixo" });
    expect(m.linhas[1].ofertas[0]).toMatchObject({ difSinapi: 10, classe: "acima" });
    expect(m.linhas[0].diferencaPropostas).toBe(18.75);
    expect(m.fornecedores.map((f) => [f.total, f.completa])).toEqual([["2000.00", true], ["1850.00", true], ["800.00", false]]);
    expect(m.fornecedores[0].classe).toBe("igual");
    expect(m.menorGlobal).toMatchObject({ conviteId: "bb", total: "1850.00" });
    expect(m.economiaGlobal).toBe("150.00");
    expect(m.somaMenores).toBe("1700.00");
    expect(m.economiaPorItem).toBe("300.00");
    expect(m.economiaPorItemPct).toBe(15);
    expect(m.custoConcentrar).toBe("150.00");
  });

  it("preço desconsiderado sai da disputa e continua no mapa", () => {
    const m = comparar(materiais, propostas, [{ conviteId: "ccc", materialId: "m1", tipo: "desconsiderado", justificativa: "Preço de outra unidade" }], "arredondar");
    expect(m.linhas[0].menor!.conviteId).toBe("a");
    expect(m.linhas[0].ofertas[2]).toMatchObject({ preco: "8.0000", excluida: "desconsiderado", menor: false });
  });

  it("sinaliza preço discrepante sem excluir", () => {
    const m = comparar([mat("m1", "1", "10.00")], [prop("a", { m1: "10.00" }), prop("bb", { m1: "11.00" }), prop("ccc", { m1: "1.00" }), prop("dddd", { m1: "30.00" })], [], "arredondar");
    expect(m.linhas[0].ofertas.map((o) => o.discrepante)).toEqual([null, null, "baixo", "alto"]);
    expect(m.linhas[0].menor!.conviteId).toBe("ccc");
    expect(m.discrepantes).toBe(2);
  });

  it("apura por item, por total e por custo-benefício", () => {
    const m = comparar(materiais, propostas, [], "arredondar");
    const item = apurar(m, propostas, [], "item", { preco: 100, prazo: 0, pagamento: 0, garantia: 0, historico: 0 });
    expect(item.itens.map((i) => i.conviteId)).toEqual(["ccc", "bb"]);
    expect(item.totalResultado).toBe("1700.00");
    expect(item.economia).toBe("300.00");
    const global = apurar(m, propostas, [], "global", item.pesos);
    expect(global.classificacao.map((c) => c.conviteId)).toEqual(["bb", "a"]);
    expect(global.vencedor!.conviteId).toBe("bb");
    expect(global.totalResultado).toBe("1850.00");
    // "a" entrega em 2 dias, "bb" em 20: com prazo pesando 50, "a" passa à frente mesmo mais caro.
    const ps = [{ ...propostas[0], prazoEntrega: 2 }, { ...propostas[1], prazoEntrega: 20 }, propostas[2]];
    const cb = apurar(comparar(materiais, ps, [], "arredondar"), ps, [], "custo_beneficio", { preco: 50, prazo: 50, pagamento: 0, garantia: 0, historico: 0 });
    expect(cb.classificacao[0]).toMatchObject({ conviteId: "a", nota: 96.25, notas: { preco: 92.5, prazo: 100 } });
    expect(cb.classificacao[1]).toMatchObject({ conviteId: "bb", nota: 55 });
    const escolhido = apurar(m, propostas, [], "global", item.pesos, "a");
    expect(escolhido.vencedor!.conviteId).toBe("a");
    expect(escolhido.totalResultado).toBe("2000.00");
  });

  it("sem proposta completa não há vencedor pelo total; empate decide por prazo e ordem de envio", () => {
    const so = [prop("a", { m1: "9.00", m2: null })];
    const r = apurar(comparar(materiais, so, [], "arredondar"), so, [], "global", { preco: 100, prazo: 0, pagamento: 0, garantia: 0, historico: 0 });
    expect(r.vencedor).toBeNull();
    expect(r.semVencedor).toMatch(/completa/);
    const emp = [prop("a", { m1: "9.00", m2: "20.00" }, { prazoEntrega: 15 }), prop("bb", { m1: "9.00", m2: "20.00" }, { prazoEntrega: 5 })];
    expect(comparar(materiais, emp, [], "arredondar").linhas[0].menor!.conviteId).toBe("bb");
    const mesmo = [prop("bb", { m1: "9.00", m2: "20.00" }), prop("a", { m1: "9.00", m2: "20.00" })];
    expect(comparar(materiais, mesmo, [], "arredondar").menorGlobal!.conviteId).toBe("a");
  });

  it("pesos somam 100 e o preço pesa ao menos 50", () => {
    expect(validarPesos({ preco: 60, prazo: 20, pagamento: 10, garantia: 10, historico: 0 })).toBeNull();
    expect(validarPesos({ preco: 40, prazo: 60, pagamento: 0, garantia: 0, historico: 0 })).toMatch(/50/);
    expect(validarPesos({ preco: 60, prazo: 20, pagamento: 0, garantia: 0, historico: 0 })).toMatch(/100/);
  });
});

describe("solicitação de cotação", () => {
  it("lista os materiais do orçamento somados e congela a cópia", async () => {
    const { id: orcamentoId } = await orcamento();
    const { materiais } = await materiaisDoOrcamento(eng, orcamentoId);
    expect(materiais.length).toBeGreaterThan(2);
    expect(materiais.every((m) => Number(m.quantidade) > 0 && !m.jaCotado)).toBe(true);
    const id = await criarSolicitacao(eng, orcamentoId, { titulo: "Cimento e blocos", prazo: prazo(3), criterio: "item", chaves: [materiais[0].chave, materiais[1].chave] });
    const s = await obterSolicitacao(eng, id);
    expect(s).toMatchObject({ situacao: "rascunho", numero: 1, sigilo: true, precosVisiveis: false });
    expect(s.materiais.map((m) => [m.codigo, m.quantidade, m.precoReferencia])).toEqual(
      [materiais[0], materiais[1]].map((m) => [m.codigo, m.quantidade, m.preco]));
    expect((await materiaisDoOrcamento(eng, orcamentoId)).materiais.filter((m) => m.jaCotado)).toHaveLength(2);
    // O orçamento continua como estava.
    expect((await obterOrcamento(eng, orcamentoId)).situacao).toBe("rascunho");
    await excluirRascunho(eng, id);
    expect(await listarSolicitacoes(eng, { orcamentoId })).toHaveLength(0);
  });

  it("confere permissões, prazo, pesos e o mínimo de três fornecedores", async () => {
    const { id: orcamentoId } = await orcamento();
    const { materiais } = await materiaisDoOrcamento(eng, orcamentoId);
    const d = { titulo: "X", prazo: prazo(2), criterio: "item" as const, chaves: [materiais[0].chave] };
    await expect(criarSolicitacao(fiscal, orcamentoId, d)).rejects.toBeInstanceOf(SemPermissao);
    await expect(materiaisDoOrcamento(campo, orcamentoId)).rejects.toBeInstanceOf(SemPermissao);
    await expect(criarSolicitacao(outro, orcamentoId, d)).rejects.toThrow();
    await expect(criarSolicitacao(eng, orcamentoId, { ...d, prazo: prazo(-1) })).rejects.toThrow(/futuro/);
    await expect(criarSolicitacao(eng, orcamentoId, { ...d, chaves: [] })).rejects.toThrow(/material/);
    await expect(criarSolicitacao(eng, orcamentoId, { ...d, criterio: "custo_beneficio", pesos: { preco: 30, prazo: 70 } })).rejects.toThrow(/50/);
    const id = await criarSolicitacao(eng, orcamentoId, d);
    const e = await salvarEmpresa(direcao, { razaoSocial: "Depósito Único", cnpj: cnpj(), tipo: "fornecedor" });
    await adicionarConvite(eng, id, { empresaId: e });
    await expect(adicionarConvite(eng, id, { empresaId: e })).rejects.toThrow(/já foi convidado/);
    await expect(enviarSolicitacao(eng, id)).rejects.toThrow(/três fornecedores/);
    await expect(consulta("update solicitacao_cotacao set situacao = 'aberta' where id = $1", [id])).rejects.toThrow(/três fornecedores/);
    await adicionarConvite(eng, id, { razaoSocial: "Fornecedor Novo Ltda", cnpj: cnpj(), email: "vendas@novo.exemplo" });
    await enviarSolicitacao(eng, id, "Só há dois fornecedores na região.");
    const s = await obterSolicitacao(eng, id);
    expect(s.situacao).toBe("aberta");
    expect(s.justificativaMinimo).toMatch(/dois/);
    expect(s.convites.every((c) => c.link?.startsWith("/cotacao/"))).toBe(true);
    await expect(obterSolicitacao(fiscal, id)).rejects.toThrow(/fora do seu acesso/);
    await vincular(direcao, s.obraId, fiscal.id, "fiscal");
    expect((await obterSolicitacao(fiscal, id)).convites.every((c) => c.link == null)).toBe(true);
    // Depois do envio nada muda: nem materiais, nem dados, nem exclusão.
    await expect(consulta("update solicitacao_cotacao set titulo = 'Outro' where id = $1", [id])).rejects.toThrow(/não mudam/);
    await expect(consulta("update solicitacao_material set quantidade = 1 where solicitacao_id = $1", [id])).rejects.toThrow(/não mudam/);
    await expect(consulta("delete from solicitacao_material where solicitacao_id = $1", [id])).rejects.toThrow(/não mudam/);
    await expect(consulta("delete from solicitacao_cotacao where id = $1", [id])).rejects.toThrow(/Cancele/);
    await expect(excluirRascunho(eng, id)).rejects.toThrow(/Cancele/);
    // O banco não guarda o link, só o resumo dele.
    const links = await consulta("select token_hash from cotacao_link l join convite_cotacao c on c.id = l.convite_id where c.solicitacao_id = $1", [id]);
    expect(links).toHaveLength(2);
    expect(links.some((l) => s.convites.some((c) => c.link!.includes(l.token_hash)))).toBe(false);
  });
});

describe("página do fornecedor", () => {
  it("mostra só o convite do link, sem preço de referência nem outros fornecedores", async () => {
    const { s, links } = await aberta();
    expect(await paginaDoFornecedor("x".repeat(43), "1.1.1.1")).toBeNull();
    const p = (await paginaDoFornecedor(links[0], "10.0.0.1"))!;
    expect(p).toMatchObject({ estado: "aberta", situacao: "abriu", titulo: "Materiais do muro", fornecedor: s.convites[0].razaoSocial });
    expect(p.materiais).toHaveLength(3);
    const tudo = JSON.stringify(p);
    expect(tudo).not.toContain("precoReferencia");
    expect(tudo).not.toContain(s.convites[1].razaoSocial);
    expect((await obterSolicitacao(eng, s.id)).convites[0]).toMatchObject({ situacao: "abriu" });
  });

  it("recebe proposta, guarda versões e não aceita alteração de item", async () => {
    const { id, s, links, cnpjs } = await aberta();
    await salvarRascunho(links[0], proposta(s, cnpjs[0], ["10", null, null]), null);
    expect((await obterSolicitacao(eng, id)).convites[0].situacao).toBe("preenchendo");
    expect((await paginaDoFornecedor(links[0], null))!.rascunho!.responsavelNome).toBe("Vendedor");
    await expect(enviarProposta(links[0], proposta(s, "00000000000000", ["10", "20", "30"]), null)).rejects.toThrow(/CNPJ/);
    await expect(enviarProposta(links[0], { ...proposta(s, cnpjs[0], ["10", "20", "30"]), responsavelNome: " " }, null)).rejects.toThrow(/nome/);
    const semMarca = proposta(s, cnpjs[0], ["10", "20", "30"]);
    semMarca.itens[s.materiais[1].id].marca = "";
    await expect(enviarProposta(links[0], semMarca, null)).rejects.toThrow(/marca/);
    const semPreco = proposta(s, cnpjs[0], ["10", "20", "30"]);
    semPreco.itens[s.materiais[2].id] = { marca: "Y" };
    await expect(enviarProposta(links[0], semPreco, null)).rejects.toThrow(/indisponível/);
    await expect(enviarProposta(links[0], proposta(s, cnpjs[0], [null, null, null]), null)).rejects.toThrow(/ao menos um/);
    // Item que não é da solicitação é ignorado: a proposta grava só os materiais pedidos.
    const comExtra = proposta(s, cnpjs[0], ["1,50", "20", null]);
    comExtra.itens["00000000-0000-4000-8000-000000000000"] = { preco: "1", marca: "Z" };
    const r1 = await enviarProposta(links[0], comExtra, "10.0.0.2");
    expect(r1).toMatchObject({ versao: 1 });
    expect(r1.protocolo).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}\/v1$/);
    const r2 = await enviarProposta(links[0], proposta(s, cnpjs[0], ["1,40", "20", "31,5"]), "10.0.0.2");
    expect(r2.versao).toBe(2);
    const itens = await consulta("select count(*)::int as n from proposta_item i join proposta p on p.id = i.proposta_id join convite_cotacao c on c.id = p.convite_id where c.solicitacao_id = $1", [id]);
    expect(itens[0].n).toBe(6);
    await expect(consulta("update proposta_item set preco_unitario = 1 where proposta_id in (select id from proposta)")).rejects.toThrow(/históricos/);
    await expect(consulta("delete from proposta where convite_id = $1", [s.convites[0].id])).rejects.toThrow();
    const pagina = (await paginaDoFornecedor(links[0], null))!;
    expect(pagina.enviada).toMatchObject({ versao: 2, protocolo: r2.protocolo });
    expect(pagina.enviada!.dados.itens[s.materiais[0].id]).toMatchObject({ preco: "1,4", marca: "Marca X" });
    // Com sigilo, a equipe vê quem respondeu e a cobertura, mas não os preços.
    const v = await obterSolicitacao(eng, id);
    expect(v).toMatchObject({ precosVisiveis: false, mapa: null, respondidas: 1, pendentes: 2 });
    expect(v.propostas).toHaveLength(0);
    expect(v.convites[0]).toMatchObject({ situacao: "respondeu", versao: 2, cotados: 3 });
    expect(v.versoes.map((x) => [x.versao, x.total])).toEqual([[1, null], [2, null]]);
    expect(v.eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(["criacao", "envio", "convite", "acesso", "proposta"]));
  });

  it("declínio, link revogado e proposta lançada pela equipe", async () => {
    const { id, s, links, cnpjs } = await aberta();
    await declinar(links[1], "Sem estoque", null);
    expect((await obterSolicitacao(eng, id)).convites[1]).toMatchObject({ situacao: "declinou", declinouMotivo: "Sem estoque" });
    await novoLink(eng, id, s.convites[0].id);
    expect((await paginaDoFornecedor(links[0], null))!.estado).toBe("revogado");
    await expect(enviarProposta(links[0], proposta(s, cnpjs[0], ["1", "2", "3"]), null)).rejects.toThrow(/inválido/);
    const novo = (await obterSolicitacao(eng, id)).convites[0].link!.replace("/cotacao/", "");
    expect(novo).not.toBe(links[0]);
    expect((await enviarProposta(novo, proposta(s, cnpjs[0], ["1", "2", "3"]), null)).versao).toBe(1);
    await expect(lancarProposta(eng, id, s.convites[2].id, proposta(s, "", ["1", "2", "3"]))).rejects.toThrow(/documento de origem/);
    await expect(lancarProposta(fiscal, id, s.convites[2].id, proposta(s, "", ["1", "2", "3"], { documento: "E-mail" }))).rejects.toBeInstanceOf(SemPermissao);
    await lancarProposta(eng, id, s.convites[2].id, proposta(s, "", ["1", "2", "3"], { documento: "E-mail de 10/11" }));
    expect((await obterSolicitacao(eng, id)).convites[2]).toMatchObject({ situacao: "respondeu", origem: "equipe" });
  });
});

describe("encerramento e apuração", () => {
  it("depois do prazo nada entra, o mapa aparece e a apuração homologada não muda", async () => {
    const { id, s, links, cnpjs } = await aberta(3, { criterio: "global" });
    const ref = s.materiais.map((m) => Number(m.precoReferencia));
    const p = (f: number) => ref.map((r) => (r * f).toFixed(2).replace(".", ","));
    await enviarProposta(links[0], proposta(s, cnpjs[0], p(0.9)), null);
    await enviarProposta(links[1], proposta(s, cnpjs[1], p(1.1)), null);
    await enviarProposta(links[2], proposta(s, cnpjs[2], [p(0.8)[0], null, null]), null);
    await expect(homologar(direcao, id)).rejects.toThrow(/encerrada/);
    await expect(avaliarItem(eng, id, { conviteId: s.convites[0].id, materialId: s.materiais[0].id, tipo: "nao_atende", justificativa: "Não atende à NBR 6136" })).rejects.toThrow(/encerrada/);
    await expect(prorrogar(eng, id, prazo(9), "curta")).rejects.toThrow(/justificativa/);
    await prorrogar(eng, id, prazo(9), "Fornecedor pediu mais prazo.");
    await expect(encerrarAntes(fiscal, id)).rejects.toBeInstanceOf(SemPermissao);
    await encerrarAntes(eng, id);
    // Encerrada: o fornecedor só lê, e o banco recusa proposta nova.
    expect((await paginaDoFornecedor(links[0], null))!.estado).toBe("encerrada");
    await expect(enviarProposta(links[0], proposta(s, cnpjs[0], p(0.5)), null)).rejects.toThrow(/terminou/);
    await expect(salvarRascunho(links[0], proposta(s, cnpjs[0], p(0.5)), null)).rejects.toThrow(/terminou/);
    await expect(declinar(links[1], null, null)).rejects.toThrow(/terminou/);
    await expect(consulta(
      `insert into proposta (orgao_id, convite_id, versao, responsavel_nome, resumo) values ($1, $2, 2, 'x', $3)`, [orgao, s.convites[0].id, "a".repeat(64)])).rejects.toThrow(/terminou/);

    let v = await obterSolicitacao(eng, id);
    expect(v).toMatchObject({ situacao: "encerrada", precosVisiveis: true });
    expect(v.mapa!.menorGlobal!.conviteId).toBe(s.convites[0].id);
    expect(v.mapa!.fornecedores.map((f) => f.completa)).toEqual([true, true, false]);
    expect(v.mapa!.fornecedores[0].classe).toBe("abaixo");
    expect(v.mapa!.fornecedores[1].classe).toBe("acima");
    expect(v.previa!.vencedor!.conviteId).toBe(s.convites[0].id);
    expect(v.mapa!.linhas[0].menor!.conviteId).toBe(s.convites[2].id);

    await expect(avaliarItem(fiscal, id, { conviteId: s.convites[2].id, materialId: s.materiais[0].id, tipo: "desconsiderado", justificativa: "Preço fora da realidade" })).rejects.toBeInstanceOf(SemPermissao);
    await avaliarItem(eng, id, { conviteId: s.convites[2].id, materialId: s.materiais[0].id, tipo: "desconsiderado", justificativa: "Preço informado para outra unidade." });
    v = await obterSolicitacao(eng, id);
    expect(v.mapa!.linhas[0].menor!.conviteId).toBe(s.convites[0].id);

    await expect(homologar(eng, id)).rejects.toBeInstanceOf(SemPermissao);
    await expect(homologar(direcao, id, { escolhidoConviteId: s.convites[1].id })).rejects.toThrow(/Justifique/);
    await expect(homologar(direcao, id, { escolhidoConviteId: s.convites[2].id, justificativa: "Entrega mais rápida na região." })).rejects.toThrow(/todos os itens/);
    const codigo = await homologar(direcao, id);
    expect(codigo).toMatch(/^[0-9a-f]{64}$/);
    v = await obterSolicitacao(eng, id);
    expect(v.situacao).toBe("apurada");
    expect(v.apuracoes[0]).toMatchObject({ numero: 1, criterio: "global", vencedorConviteId: s.convites[0].id, escolhidoConviteId: s.convites[0].id, codigo });
    expect(v.apuracoes[0].resultado.desconsiderados).toHaveLength(1);
    expect(Number(v.apuracoes[0].economia)).toBeGreaterThan(0);
    await expect(consulta("update apuracao set justificativa = 'x' where solicitacao_id = $1", [id])).rejects.toThrow(/históricos/);
    await expect(consulta("delete from apuracao where solicitacao_id = $1", [id])).rejects.toThrow();
    await expect(consulta("delete from evento_cotacao where solicitacao_id = $1", [id])).rejects.toThrow(/histórico/);
    await expect(consulta("update evento_cotacao set resumo = 'x' where solicitacao_id = $1", [id])).rejects.toThrow(/históricos/);
    const lista = await listarSolicitacoes(eng, { orcamentoId: v.orcamentoId });
    expect(lista[0]).toMatchObject({ situacao: "apurada", convidados: 3, respondidas: 3 });
    expect(lista[0].economia).toBe(v.apuracoes[0].economia);

    // Reabertura: nova apuração exige justificativa e a anterior fica guardada.
    await reabrir(eng, id, prazo(4), "Fornecedor B pediu para corrigir o preço.");
    await enviarProposta(links[1], proposta(s, cnpjs[1], p(0.7)), null);
    await encerrarAntes(eng, id);
    await expect(homologar(direcao, id)).rejects.toThrow(/nova apuração/);
    await homologar(direcao, id, { justificativa: "Reabertura para correção de preço do fornecedor B." });
    v = await obterSolicitacao(eng, id);
    expect(v.apuracoes.map((a) => a.numero)).toEqual([2, 1]);
    expect(v.apuracoes[0].escolhidoConviteId).toBe(s.convites[1].id);
    expect(v.eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(["prorrogacao", "encerramento", "avaliacao", "homologacao", "reabertura"]));
  });

  it("prazo vencido encerra sozinho; cancelar guarda tudo e revoga os links", async () => {
    const { id, s, links, cnpjs } = await aberta(2);
    await enviarProposta(links[0], proposta(s, cnpjs[0], ["1", "2", "3"]), null);
    await comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => {
      await c.query("alter table solicitacao_cotacao disable trigger solicitacao_protecao");
      await c.query("update solicitacao_cotacao set prazo = now() - interval '1 minute' where id = $1", [id]);
      await c.query("alter table solicitacao_cotacao enable trigger solicitacao_protecao");
    });
    await expect(enviarProposta(links[1], proposta(s, cnpjs[1], ["1", "2", "3"]), null)).rejects.toThrow(/terminou/);
    const v = await obterSolicitacao(eng, id);
    expect(v.situacao).toBe("encerrada");
    expect(v.convites.map((c) => c.situacao)).toEqual(["respondeu", "nao_respondeu"]);
    expect(v.convites.every((c) => c.link == null)).toBe(true);
    await expect(homologar(direcao, id)).rejects.toThrow(/menos de três/);
    await expect(cancelar(eng, id, "x")).rejects.toThrow(/justificativa/);
    await cancelar(eng, id, "Compra suspensa pela direção.");
    expect((await obterSolicitacao(eng, id))).toMatchObject({ situacao: "cancelada", canceladaMotivo: "Compra suspensa pela direção." });
    expect((await paginaDoFornecedor(links[0], null))!.estado).toBe("revogado");
    await expect(reabrir(eng, id, prazo(3), "Tentativa de reabrir cancelada.")).rejects.toThrow();
    expect((await consulta("select count(*)::int as n from proposta p join convite_cotacao c on c.id = p.convite_id where c.solicitacao_id = $1", [id]))[0].n).toBe(1);
  });

  it("outro órgão não enxerga nada", async () => {
    const { id, links } = await aberta();
    await expect(obterSolicitacao(outro, id)).rejects.toThrow(/não encontrada/);
    expect(await listarSolicitacoes(outro)).toHaveLength(0);
    expect(await comContexto({ usuarioId: null, orgaoId: outro.orgaoId }, async (c) => (await c.query("select count(*)::int as n from convite_cotacao")).rows[0].n)).toBe(0);
    expect((await paginaDoFornecedor(links[0], null))!.orgao).toBe("Órgão de teste");
  });
});

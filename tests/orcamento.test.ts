import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { dec, texto } from "../src/lib/decimal";
import { lancarMuro, PADRAO_MURO, quantidadesMuro, sugerirMuro } from "../src/servicos/assistente-muro";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { criarObra, obterObra, type Ator } from "../src/servicos/obras";
import {
  adicionarComposicao, adicionarCotacao, adicionarEtapa, adicionarInsumo, adicionarItemCotado, aprovarOrcamento,
  compararComAnterior, compararRegimes, criarOrcamento, curvaAbcInsumos, curvaAbcServicos, cronogramaDo, editarItem,
  listarOrcamentos, novaVersao, obterOrcamento, removerItem, salvarCronograma, salvarDadosGerais, trocarBase,
} from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes, buscarInsumos } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

let orgao: string, eng: Ator, direcao: Ator, campo: Ator, outro: Ator;
let nd: string, des: string;

beforeAll(async () => {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c, cargaDemonstracao(), "demonstracao");
    await c.query("commit");
    nd = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
    des = r.find((x) => x.regime === "desonerado")!.tabelaId;
  } finally { c.release(); }
  orgao = await novoOrgao();
  eng = await novoUsuario(orgao, "engenheiro");
  direcao = await novoUsuario(orgao, "direcao");
  campo = await novoUsuario(orgao, "campo");
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
});
afterAll(fecharPool);

async function novo(nome = "Muro") {
  const obraId = await criarObra(eng, dadosObra());
  const id = await criarOrcamento(eng, { obraId, nome, tabelaId: nd });
  return { obraId, id };
}
const comp = async (busca: string) => (await buscarComposicoes(eng, { tabelaId: nd, busca }))[0];

describe("orçamento por serviço", () => {
  it("calcula o custo unitário pelos insumos, com as composições auxiliares abertas", async () => {
    const alv = await comp("alvenaria");
    // 25 x 1,37 + 0,0105 x argamassa (182x0,92 + 145x1,05 + 1,16x125 + 0,25x9,80 + 10x19,41 + 0,6x3,90 = 663,58) + 0,8 x 27,13 + 0,4 x 19,41
    expect(alv.custo).toBe("70.69");
    const { id } = await novo();
    const etapa = await adicionarEtapa(eng, id, "Alvenaria");
    await adicionarComposicao(eng, id, alv.id, { etapaId: etapa, quantidade: "20" });
    const o = await obterOrcamento(eng, id);
    const i = o.etapas[0].itens[0];
    expect(i).toMatchObject({ numero: "1.1", custoUnitario: "70.69", custoTotal: "1413.80", modo: "servico" });
    expect(texto(dec(i.material) + dec(i.maoDeObra) + dec(i.equipamento))).toBe("70.69");
    expect(o.bdiObraPct).toBe("23.54");
    expect(i.precoUnitario).toBe("87.33"); // 70,69 x 1,2354
    expect(o.totais.total).toBe("1746.60");
  });

  it("só engenheiro e direção editam; campo não vê orçamento", async () => {
    const { id } = await novo();
    await expect(adicionarEtapa(campo, id, "X")).rejects.toBeInstanceOf(SemPermissao);
    await expect(obterOrcamento(campo, id)).rejects.toBeInstanceOf(SemPermissao);
    await expect(obterOrcamento(outro, id)).rejects.toThrow(/não encontrado/);
  });

  it("arredondar ou truncar muda o total conforme a regra escolhida", async () => {
    const { id } = await novo();
    const etapa = await adicionarEtapa(eng, id, "Revestimento");
    await adicionarComposicao(eng, id, (await comp("reboco")).id, { etapaId: etapa, quantidade: "33,333" });
    const antes = await obterOrcamento(eng, id);
    await salvarDadosGerais(eng, id, { ...antes, arredondamento: "truncar" });
    const depois = await obterOrcamento(eng, id);
    expect(depois.arredondamento).toBe("truncar");
    expect(dec(depois.totais.total) <= dec(antes.totais.total)).toBe(true);
  });
});

describe("orçamento por material e por cotação", () => {
  it("material entra com o preço da data-base", async () => {
    const { id } = await novo();
    const etapa = await adicionarEtapa(eng, id, "Materiais");
    const areia = (await buscarInsumos(eng, { tabelaId: nd, busca: "areia" }))[0];
    await adicionarInsumo(eng, id, areia.id, { etapaId: etapa, quantidade: "2,5" });
    const i = (await obterOrcamento(eng, id)).etapas[0].itens[0];
    expect(i).toMatchObject({ modo: "material", custoUnitario: "125.00", custoTotal: "312.50" });
  });

  it("item cotado fica sem preço até ter três cotações", async () => {
    const { id } = await novo();
    const etapa = await adicionarEtapa(eng, id, "Portão");
    const item = await adicionarItemCotado(eng, id, { etapaId: etapa, quantidade: "1", descricao: "Portão metálico 3 x 2 m", unidade: "un", tipo: "material", criterio: "mediana", justificativa: "Sem composição na base." });
    await adicionarCotacao(eng, id, item, { fornecedor: "Serralheria A", data: "2026-10-01", valor: "4.200,00" });
    await adicionarCotacao(eng, id, item, { fornecedor: "Serralheria B", data: "2026-10-02", valor: "3.900,00" });
    let o = await obterOrcamento(eng, id);
    expect(o.etapas[0].itens[0].semPreco).toBe(true);
    expect(o.pendencias.join(" ")).toMatch(/menos de três cotações/);
    await adicionarCotacao(eng, id, item, { fornecedor: "Serralheria C", data: "2026-10-03", valor: "4.500,00" });
    o = await obterOrcamento(eng, id);
    expect(o.etapas[0].itens[0]).toMatchObject({ custoUnitario: "4200.00", semPreco: false });
  });
});

describe("assistente de muro", () => {
  it("calcula as quantidades do muro de 10 x 2 m", () => {
    const q = quantidadesMuro(PADRAO_MURO);
    const v = Object.fromEntries(q.linhas.map((l) => [l.chave, l.quantidade]));
    expect(q.pilaretes).toBe(5);
    expect(v).toMatchObject({ locacao: "10.000", alvenaria: "17.000", pilarete: "10.000", chapisco: "40.000", sapata: "0.450" });
  });

  it("os totais por serviço e por material conferem, com diferença só de arredondamento", async () => {
    const { id } = await novo();
    const sug = await sugerirMuro(eng, id, PADRAO_MURO);
    expect(sug.every((l) => l.escolhida)).toBe(true);
    const linhas = sug.map((l) => ({ composicaoId: l.escolhida!, quantidade: l.quantidade, memoria: l.memoria }));
    await lancarMuro(eng, id, { nomeEtapa: "Muro por serviço", modo: "servico", linhas });
    await lancarMuro(eng, id, { nomeEtapa: "Muro por material", modo: "material", linhas });
    const o = await obterOrcamento(eng, id);
    const [s, m] = o.etapas;
    expect(s.itens).toHaveLength(9);
    expect(m.itens.length).toBeGreaterThan(15);
    const dif = dec(s.totais.custo) - dec(m.totais.custo);
    expect(dif < dec(5) && dif > dec(-5)).toBe(true);
    expect(dec(m.totais.maoDeObra) > 0n).toBe(true);
  });
});

describe("aprovação, nota e versões", () => {
  async function pronto() {
    const { obraId, id } = await novo();
    const etapa = await adicionarEtapa(eng, id, "Alvenaria");
    await adicionarComposicao(eng, id, (await comp("alvenaria")).id, { etapaId: etapa, quantidade: "20" });
    return { obraId, id, etapa };
  }

  it("bloqueia a aprovação com pendências e aprova quando está tudo certo", async () => {
    const { obraId, id, etapa } = await pronto();
    await expect(aprovarOrcamento(eng, id)).rejects.toThrow(/Cronograma.*Responsável técnico/);
    const o = await obterOrcamento(eng, id);
    await salvarDadosGerais(eng, id, { ...o, responsavelTecnico: "Eng. Teste", registroProfissional: "CREA-RJ 1" });
    await salvarCronograma(eng, id, { periodos: 2, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "60", 2: "40" } } });
    const nota = await aprovarOrcamento(eng, id);
    expect(nota.numero).toBeGreaterThan(0);
    const aprovado = await obterOrcamento(eng, id);
    expect(aprovado).toMatchObject({ situacao: "aprovado" });
    expect(aprovado.nota?.numero).toBe(nota.numero);
    expect((await obterObra(eng, obraId)).situacao).toBe("orcada");
    const crono = cronogramaDo(aprovado);
    expect(crono.porPeriodo).toEqual(["1047.96", "698.64"]);
    // Congelado: nem o serviço nem o banco deixam mudar.
    await expect(adicionarEtapa(eng, id, "Nova")).rejects.toThrow(/não pode ser alterado/);
    await expect(comContexto({ usuarioId: eng.id, orgaoId: orgao }, (c) => c.query("update orcamento_item set quantidade = 1 where orcamento_id = $1", [id])))
      .rejects.toThrow(/não pode ser alterado/);
    await expect(comContexto({ usuarioId: eng.id, orgaoId: orgao }, (c) => c.query("update orcamento set nome = 'x' where id = $1", [id])))
      .rejects.toThrow(/não pode ser alterado/);
  });

  it("nova versão copia tudo, compara com a anterior e substitui ao ser aprovada", async () => {
    const { id, etapa } = await pronto();
    const o = await obterOrcamento(eng, id);
    await salvarDadosGerais(eng, id, { ...o, responsavelTecnico: "Eng. Teste" });
    await salvarCronograma(eng, id, { periodos: 1, unidadePeriodo: "mes", percentuais: { [etapa]: { 1: "100" } } });
    await aprovarOrcamento(eng, id);
    const v2 = await novaVersao(eng, id);
    await expect(novaVersao(eng, id)).rejects.toThrow(/em elaboração/);
    const nova = await obterOrcamento(eng, v2);
    expect(nova).toMatchObject({ versao: 2, situacao: "rascunho", totais: o.totais });
    const item = nova.etapas[0].itens[0];
    await editarItem(eng, v2, item.id, { quantidade: "25" });
    const cmp = (await compararComAnterior(eng, v2))!;
    expect(cmp.linhas).toHaveLength(1);
    expect(cmp.diferenca).toBe("436.65"); // 5 m² x 87,33
    await aprovarOrcamento(direcao, v2);
    expect((await obterOrcamento(eng, id)).situacao).toBe("substituido");
    const lista = await listarOrcamentos(eng, { obraId: nova.obraId });
    expect(lista.map((x) => `${x.versao}:${x.situacao}:${x.total}`)).toEqual(["2:aprovado:2183.25", "1:substituido:1746.60"]);
  });

  it("compara os regimes e troca para o desonerado", async () => {
    const { id, etapa } = await pronto();
    const r = (await compararRegimes(eng, id))!;
    expect(r.outro.regime).toBe("desonerado");
    expect(dec(r.diferenca) < 0n).toBe(true); // mão de obra mais barata, mesmo com a CPRB
    await trocarBase(eng, id, des);
    const o = await obterOrcamento(eng, id);
    expect(o).toMatchObject({ regime: "desonerado" });
    expect(o.bdiObra.cprb).toBe("2.70");
    expect(o.totais.total).toBe(r.outro.total);
    await removerItem(eng, id, o.etapas[0].itens[0].id);
    expect((await obterOrcamento(eng, id)).etapas[0].itens).toHaveLength(0);
    expect(etapa).toBeTruthy();
  });

  it("curva ABC de serviços e de insumos", async () => {
    const { id, etapa } = await pronto();
    await adicionarComposicao(eng, id, (await comp("pintura")).id, { etapaId: etapa, quantidade: "40" });
    await adicionarComposicao(eng, id, (await comp("chapisco")).id, { etapaId: etapa, quantidade: "40" });
    const s = await curvaAbcServicos(eng, id);
    expect(s.linhas[0].descricao).toMatch(/ALVENARIA/);
    expect(s.linhas.at(-1)!.acumulado).toBe("100.00");
    const i = await curvaAbcInsumos(eng, id);
    const pedreiro = i.linhas.find((l) => l.descricao === "PEDREIRO")!;
    // 20 x 0,8 + 40 x 0,07 = 18,8 h
    expect(pedreiro.quantidade).toBe("18.8000");
  });
});

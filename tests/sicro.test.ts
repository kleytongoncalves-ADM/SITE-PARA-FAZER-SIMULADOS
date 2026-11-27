import { afterAll, describe, expect, it } from "vitest";
import { fecharPool, pool } from "../src/lib/db";
import { gravarCargaSinapi, type Celula, type Planilha } from "../src/servicos/importador-sinapi";
import { codigoSicro, interpretarSicro, referenciaDoSicro, trimestresPendentes } from "../src/servicos/importador-sicro";
import { buscarComposicoes, buscarInsumos, listarTabelas } from "../src/servicos/precos";
import { arquivoDaPagina, paginasDoMes } from "../scripts/atualizar-sicro";
import { novoOrgao, novoUsuario } from "./apoio";

afterAll(fecharPool);

type Linha = Celula[];
const N = null;

/** Uma composição no layout do Relatório Analítico de Composições de Custos do DNIT. */
function composicao(d: {
  codigo: string; descricao: string; unidade: string; fic: number; producao: number;
  equipamentos?: [string, string, number, number, number][]; maoDeObra?: [string, string, number][];
  materiais?: [string, string, number, string, number][]; percentualMaterial?: number;
  auxiliares?: [string, string, number, string][]; tempoFixo?: [string, string, string, number][]; total: number;
}): Linha[] {
  return [
    ["SISTEMA DE CUSTOS REFERENCIAIS DE OBRAS - SICRO", N, N, "Rio de Janeiro", N, N, "FIC", d.fic, N],
    ["Custo Unitário de Referência", N, N, "Julho/2026", N, N, "Produção da equipe ", d.producao, d.unidade],
    [d.codigo, d.descricao, N, N, N, N, N, "Valores em reais (R$)", N],
    ["A - EQUIPAMENTOS", N, "Quantidade", "Utilização", N, "Custo Horário", N, N, "Custo"],
    [N, N, N, "Operativa", "Improdutiva", "Produtivo", "Improdutivo", N, "Horário Total"],
    ...(d.equipamentos ?? []).map(([c, n, q, op, imp]) => [c, n, q, op, imp, 1, 1, N, 1]),
    [N, N, N, N, N, N, "Custo horário total de equipamentos", N, N],
    ["B - MÃO DE OBRA", N, "Quantidade", "Unidade", N, "Custo Horário", "Custo Horário Total", N, N],
    ...(d.maoDeObra ?? []).map(([c, n, q]) => [c, n, q, "h", N, 1, N, N, 1]),
    [N, N, "Custo horário total de mão de obra", N, N, N, N, N, N],
    [N, N, "Custo unitário de execução", N, N, N, N, N, N],
    [N, N, N, N, N, N, "Custo do FIC", N, N],
    ["C - MATERIAL", N, "Quantidade", "Unidade", N, "Preço Unitário", "Custo Unitário", N, N],
    ...(d.materiais ?? []).map(([c, n, q, u, p]) => [c, n, q, u, N, p, N, N, q * p]),
    ...(d.percentualMaterial ? [[N, N, N, N, N, N, `Instalações hidráulicas, elétricas e telefônicas (${d.percentualMaterial.toFixed(2)}%)`, N, 1]] : []),
    [N, N, "Custo unitário total de material", N, N, N, N, N, N],
    ["D - ATIVIDADES AUXILIARES", N, "Quantidade", "Unidade", N, "Custo Unitário", "Custo Unitário", N, N],
    ...(d.auxiliares ?? []).map(([c, n, q, u]) => [c, n, q, u, N, 1, N, N, 1]),
    [N, N, N, N, N, N, "Subtotal", N, N],
    ["E - TEMPO FIXO", N, "Código", "Quantidade", "Unidade", N, "Custo Unitário", "Custo Unitário", N],
    ...(d.tempoFixo ?? []).map(([m, n, c, q]) => [m, n, c, q, "t", N, 1, N, 1]),
    ["F - MOMENTO DE TRANSPORTE", N, "Quantidade", "Unidade", "DMT", N, N, "FIT", "Custo Unitário"],
    [N, N, N, N, "LN", "RP", "P", N, N],
    ["M0798", "Apoio de neoprene fretado - Caminhão carroceria 15 t", 0.0032, "tkm", "5914449", "5914464", "5914479", N, N],
    [N, N, "Custo unitário total de transporte", N, N, N, N, N, N],
    [N, N, N, N, "Custo unitário direto total", N, N, N, d.total],
    ["Obs.", N, N, N, N, N, N, N, N],
    [N, N, N, N, N, N, N, N, N],
  ];
}

// Custos esperados (sem desoneração):
//  5914655: (300 + 32,2976) / 10                                     = 33,23
//  0307731: 2 x 40,25 x 1,03159 / 2 + 147,6265 + 0,0032 x 33,22976    = 189,2543 -> 189,25
//  2004504: (258,0144 + (0 + 0,03791) x 115,852 + 32,2976 x 1,03791) / 13,74 = 21,54
//  0903803: 10 x 6,3796 x 1,10                                        = 70,18
const analitico: Linha[] = [
  ...composicao({ codigo: "5914655", descricao: "Carga, manobra e descarga - caminhão carroceria 15 t", unidade: "t", fic: 0, producao: 10,
    equipamentos: [["E9571", "Caminhão carroceria 15 t", 1, 1, 0]], maoDeObra: [["P9824", "Servente", 1]], total: 33.23 }),
  ...composicao({ codigo: "0307731", descricao: "Aparelho de apoio de neoprene fretado - fornecimento e instalação", unidade: "dm³", fic: 0.03159, producao: 2,
    maoDeObra: [["P9821", "Pedreiro", 2]], materiais: [["M0798", "Apoio de neoprene fretado", 1, "dm³", 147.6265]],
    tempoFixo: [["M0798", "Apoio de neoprene fretado - Caminhão carroceria 15 t", "5914655", 0.0032]], total: 189.25 }),
  ...composicao({ codigo: "2004504", descricao: "Escavação mecânica de vala com valetadeira", unidade: "m³", fic: 0.03791, producao: 13.74,
    equipamentos: [["E9119", "Minicarregadeira com valetadeira", 1, 1, 0]], maoDeObra: [["P9824", "Servente", 1]], total: 21.54 }),
  ...composicao({ codigo: "0903803", descricao: "Edificação padrão - canteiro", unidade: "un", fic: 0, producao: 1,
    materiais: [["M0004", "Aço CA 50", 10, "kg", 6.3796]], percentualMaterial: 10, total: 70.18 }),
];

const arq = (r: string) => `RJ 07-2026 Relatório ${r}.xlsx`;
const planilhas = (custoNeoprene = 189.25): Planilha[] => [
  { arquivo: arq("Analítico de Composições de Custos"), aba: "Sheet1", linhas: analitico },
  { arquivo: arq("Sintético de Composições de Custos"), aba: "Sheet1", linhas: [
    ["Código", "Descrição do Serviço", "Unidade", "Custo Unitário\n(R$)"],
    ["0307731", "Aparelho de apoio de neoprene fretado - fornecimento e instalação", "dm³", custoNeoprene],
    ["2004504", "Escavação mecânica de vala com valetadeira", "m³", 21.54],
    ["0903803", "Edificação padrão - canteiro", "un", 70.18],
    ["5914655", "Carga, manobra e descarga - caminhão carroceria 15 t", "t", 33.23],
  ] },
  { arquivo: arq("Sintético de Materiais"), aba: "Sheet1", linhas: [
    ["Código", "Descrição", "Unidade", "Preço Unitário\n(R$)"],
    ["M0798", "Apoio de neoprene fretado", "dm³", 147.6265], ["M0004", "Aço CA 50", "kg", 6.3796],
  ] },
  ...(["", " - com desoneração"] as const).flatMap((sufixo) => {
    const d = sufixo !== "";
    return [
      { arquivo: arq(`Sintético de Equipamentos${sufixo}`), aba: "Sheet1", linhas: [
        ["Código", "Descrição", "Valor de Aquisição\n (R$)", "Depreciação\n (R$/h)", "Oportunidade de Capital\n (R$/h)", "Seguros e Impostos\n (R$/h)",
          "Manutenção\n (R$/h)", "Operação\n (R$/h)", "Mão de Obra de Operação\n (R$/h)", "Custo Produtivo\n (R$/h)", "Custo Improdutivo\n (R$/h)"],
        ["E9119", "Minicarregadeira sobre pneus com valetadeira - 55,40 kW", 1, 1, 1, 0, 1, 1, 1, d ? 250 : 258.0144, d ? 110 : 115.852],
        ["E9571", "Caminhão carroceria 15 t", 1, 1, 1, 0, 1, 1, 1, 300, 150],
      ] },
      { arquivo: arq(`Sintético de Mão de Obra${sufixo}`), aba: "Rel. Sintético de Mão de Obra", linhas: [
        ["Código", "Descrição", "Unidade", "Custo\n (R$)"],
        ["P9821", "Pedreiro", "h", d ? 38 : 40.25], ["P9824", "Servente", "h", d ? 30 : 32.2976],
      ] },
    ];
  }),
  // Relatório que a carga não usa.
  { arquivo: arq("Sintético de Origem de Preços do SICRO"), aba: "ENTREGA", linhas: [["CÓDIGO", "DESCRIÇÃO DO ITEM"], ["M0004", "Aço CA 50"]] },
];

describe("leitura do SICRO", () => {
  it("identifica UF e mês pelo nome do arquivo ou pelo cabeçalho", () => {
    expect(referenciaDoSicro("RJ 07-2026 Relatório Sintético de Materiais.xlsx")).toEqual({ uf: "RJ", mes: "2026-07-01" });
    expect(referenciaDoSicro("relatorio.xlsx", analitico.slice(0, 2))).toEqual({ uf: "RJ", mes: "2026-07-01" });
    expect(codigoSicro(307731)).toBe("0307731");
    expect(codigoSicro("E9119")).toBe("E9119");
  });

  it("transforma a equipe por hora em coeficientes por unidade, com FIC", () => {
    const c = interpretarSicro(planilhas());
    expect(c).toMatchObject({ uf: "RJ", mes: "2026-07-01" });
    const coef = (comp: string, item: string) => c.analitico.find((a) => a.composicao === comp && a.item === item)?.coeficiente;
    expect(coef("0307731", "P9821")).toBe("1.0315900"); // 2 x 1,03159 / 2
    expect(coef("2004504", "E9119")).toBe("0.0727802"); // 1 x 1 / 13,74
    expect(coef("2004504", "E9119-I")).toBe("0.0027591"); // 1 x (0 + 0,03791) / 13,74
    expect(coef("0307731", "5914655")).toBe("0.0032000"); // tempo fixo
    expect(coef("0903803", "M0004")).toBe("11.0000000"); // 10 kg + 10%
    expect(c.analitico.some((a) => a.item === "M0798" && a.coeficiente === "0.0032000")).toBe(false); // transporte fica de fora
    expect(c.precos.nao_desonerado.get("E9119-I")?.preco).toBe("115.8520");
    expect(c.precos.desonerado.get("P9824")?.preco).toBe("30.0000");
    expect(c.precos.desonerado.get("M0004")?.preco).toBe("6.3796");
    expect(c.custos.nao_desonerado.get("0307731")).toBe("189.25");
    expect(c.custos.desonerado.size).toBe(0);
    expect(c.insumos.get("E9119")?.tipo).toBe("equipamento");
  });

  it("recusa pacote sem o analítico", () => {
    expect(() => interpretarSicro(planilhas().slice(1))).toThrow(/Analítico/);
  });
});

describe("gravação do SICRO", () => {
  it("confere com o custo publicado e o regime desonerado segue a conferência", async () => {
    const c = await pool().connect();
    let r;
    try {
      await c.query("begin");
      r = await gravarCargaSinapi(c, interpretarSicro(planilhas()), "sicro");
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
    const nd = r.find((x) => x.regime === "nao_desonerado")!;
    const d = r.find((x) => x.regime === "desonerado")!;
    expect(nd).toMatchObject({ conferidas: 4, divergentes: 0, situacao: "liberada" });
    expect(d).toMatchObject({ conferidas: 0, situacao: "liberada" });

    const eng = await novoUsuario(await novoOrgao(), "engenheiro");
    const tabelas = await listarTabelas(eng, { somenteLiberadas: true });
    expect(tabelas.filter((t) => t.fonte === "sicro")).toHaveLength(2);
    const [neoprene] = await buscarComposicoes(eng, { tabelaId: nd.tabelaId, busca: "neoprene" });
    expect(neoprene).toMatchObject({ codigo: "0307731", custo: "189.25" });
    const [vala] = await buscarComposicoes(eng, { tabelaId: d.tabelaId, busca: "valetadeira" });
    // Desonerado: (250 + 0,03791 x 110 + 30 x 1,03791) / 13,74
    expect(vala.custo).toBe("20.76");
    const [eq] = await buscarInsumos(eng, { tabelaId: nd.tabelaId, busca: "minicarregadeira improdutiva" });
    expect(eq).toMatchObject({ codigo: "E9119-I", tipo: "equipamento" });
  });

  it("fica em conferência quando o custo publicado não bate, nos dois regimes", async () => {
    const c = await pool().connect();
    try {
      await c.query("begin");
      const carga = interpretarSicro(planilhas(250));
      carga.mes = "2026-04-01";
      const r = await gravarCargaSinapi(c, carga, "sicro");
      expect(r.map((x) => x.situacao)).toEqual(["em_conferencia", "em_conferencia"]);
      // Outra UF no mesmo mês é recusada: o FIC de cada UF fica no coeficiente.
      const outra = interpretarSicro(planilhas(), { uf: "SP" });
      outra.mes = "2026-04-01";
      await expect(gravarCargaSinapi(c, outra, "sicro")).rejects.toThrow(/já está carregado para RJ/);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });
});

describe("atualização automática do SICRO", () => {
  it("escolhe os trimestres que faltam", () => {
    expect(trimestresPendentes("2026-04", "2026-11-27")).toEqual(["2026-07"]);
    expect(trimestresPendentes("2026-07", "2026-11-27")).toEqual([]);
    expect(trimestresPendentes("2026-07", "2026-12-02")).toEqual(["2026-10"]);
    expect(trimestresPendentes(null, "2026-11-27")).toEqual(["2026-04", "2026-07"]);
    expect(trimestresPendentes("2024-01", "2026-11-27")).toEqual(["2026-04", "2026-07"]);
    expect(trimestresPendentes("2026-10", "2027-03-10")).toEqual(["2027-01"]);
  });

  it("acha a página do trimestre, a revisada primeiro, e o arquivo dentro dela", () => {
    const b = "https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro/relatorios/relatorios-sicro/sudeste";
    const lista = `<a href="${b}/rio-de-janeiro/2025/outubro-2025/outubro-2025">Outubro</a>
      <a href="${b}/rio-de-janeiro/2025/outubro-2025/outubro-2025-revisado">Outubro revisado</a>
      <a href="${b}/sao-paulo/2025/outubro-2025/outubro-2025">SP</a>
      <a href="${b}/rio-de-janeiro/2026/julho/julho-2026">Julho</a>`;
    expect(paginasDoMes(lista, "RJ", "2025-10")).toEqual([
      `${b}/rio-de-janeiro/2025/outubro-2025/outubro-2025-revisado`, `${b}/rio-de-janeiro/2025/outubro-2025/outubro-2025`]);
    expect(paginasDoMes(lista, "RJ", "2026-07")).toEqual([`${b}/rio-de-janeiro/2026/julho/julho-2026`]);
    expect(paginasDoMes(lista, "RJ", "2026-10")).toEqual([]);
    const pagina = `<a href="http://www.facebook.com/sharer.php?u=x">f</a><a href="${b}/rio-de-janeiro/2026/julho/rj-07-2026.7z">RJ</a>`;
    expect(arquivoDaPagina(pagina, `${b}/rio-de-janeiro/2026/julho/julho-2026`)).toBe(`${b}/rio-de-janeiro/2026/julho/rj-07-2026.7z`);
  });
});

describe("aviso da base com SICRO", () => {
  it("avisa quando a carga do SICRO parou em conferência", async () => {
    const { avisoDaBase } = await import("../src/servicos/precos");
    const t = (fonte: "sinapi" | "sicro", mes: string, situacao: "liberada" | "em_conferencia" = "liberada") => ({ fonte, mes, situacao });
    expect(avisoDaBase([t("sinapi", "2026-10"), t("sicro", "2026-07")], "2026-11-27")).toBeNull();
    expect(avisoDaBase([t("sinapi", "2026-10"), t("sicro", "2026-04"), t("sicro", "2026-07", "em_conferencia")], "2026-11-27")).toMatch(/SICRO de 07\/2026 ficou em conferência/);
  });
});

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { gravarCargaSinapi, interpretarSinapi, tipoDoInsumo, type Planilha } from "../src/servicos/importador-sinapi";
import { buscarComposicoes, buscarInsumos, listarTabelas } from "../src/servicos/precos";
import { lerPlanilhas } from "../scripts/ler-planilhas";
import { novoOrgao, novoUsuario } from "./apoio";

afterAll(fecharPool);

// Planilha no formato publicado a partir de 2025: títulos na linha 10 e uma coluna por UF.
const cabecalhoInsumos = ["Classificação", "Código do Insumo", "Descrição do Insumo", "Unidade", "Origem de Preço", "AC", "RJ", "SP"];
const insumos = (mo: [number, number]) => [
  ["MATERIAL", 370, "AREIA MEDIA - POSTO JAZIDA/FORNECEDOR (RETIRADO NA JAZIDA, SEM TRANSPORTE)", "M3", "C", "100,00", "120,00", "110,00"],
  ["MATERIAL", 1379, "CIMENTO PORTLAND COMPOSTO CP II-32", "KG", "C", "0,80", "0,92", "0,85"],
  ["MATERIAL", 7271, "BLOCO CERAMICO DE VEDACAO 9 X 19 X 19 CM", "UN", "AS", "1,10", "1,37", "1,20"],
  ["MÃO DE OBRA", 4750, "PEDREIRO", "H", "C", "20,00", mo[0], "25,00"],
  ["MÃO DE OBRA", 6111, "SERVENTE DE OBRAS", "H", "C", "15,00", mo[1], "18,00"],
];
const composicoes = (custos: [string, string]) => [
  ["ARGAMASSAS", 87292, "ARGAMASSA TRAÇO 1:3 (EM VOLUME DE CIMENTO E AREIA MÉDIA), PREPARO MANUAL", "M3", "", custos[0], ""],
  ["ALVENARIA", 103322, "ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS 9X19X19 CM", "M2", "", custos[1], ""],
];
const analitico = [
  ["Grupo", "Código da Composição", "Tipo Item", "Código do Item", "Descrição", "Unidade", "Coeficiente", "Situação"],
  ["ARGAMASSAS", 87292, "", "", "ARGAMASSA TRAÇO 1:3 (EM VOLUME DE CIMENTO E AREIA MÉDIA), PREPARO MANUAL", "M3", "", ""],
  ["ARGAMASSAS", 87292, "INSUMO", 370, "AREIA MEDIA", "M3", "1,1500000", "COM PREÇO"],
  ["ARGAMASSAS", 87292, "INSUMO", 1379, "CIMENTO", "KG", "430,0000000", "COM PREÇO"],
  ["ARGAMASSAS", 87292, "INSUMO", 6111, "SERVENTE DE OBRAS", "H", "10,0000000", "COM PREÇO"],
  ["ALVENARIA", 103322, "", "", "ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS 9X19X19 CM", "M2", "", ""],
  ["ALVENARIA", 103322, "INSUMO", 7271, "BLOCO CERAMICO", "UN", "25,0000000", "COM PREÇO"],
  ["ALVENARIA", 103322, "COMPOSICAO", 87292, "ARGAMASSA TRAÇO 1:3", "M3", "0,0105000", "COM CUSTO"],
  ["ALVENARIA", 103322, "INSUMO", 4750, "PEDREIRO", "H", "0,8000000", "COM PREÇO"],
  ["ALVENARIA", 103322, "INSUMO", 6111, "SERVENTE DE OBRAS", "H", "0,4000000", "COM PREÇO"],
];
// Custos publicados: argamassa ND = 1,15x120 + 430x0,92 + 10x19,41 = 727,70; alvenaria ND = 34,25 + 0,0105x727,70 + 0,8x27,13 + 0,4x19,41 = 71,36
const vazias = (n: number) => Array.from({ length: n }, () => [] as (string | number)[]);
const cabecalhoComp = ["Grupo", "Código da Composição", "Descrição", "Unidade", "AC", "RJ", "SP"];
const planilhas = (): Planilha[] => [
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "ISD", linhas: [["Mês de referência: 10/2026"], ...vazias(8), cabecalhoInsumos, ...insumos([27.13, 19.41])] },
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "ICD", linhas: [...vazias(9), cabecalhoInsumos, ...insumos([22.4, 16.02])] },
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "ISE", linhas: [...vazias(9), cabecalhoInsumos, ...insumos([12, 9])] },
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "CSD", linhas: [...vazias(8), ["", "", "", "", "AC", "RJ", ""], cabecalhoComp.map((v) => (v === "RJ" ? "Custo (R$)" : v)), ...composicoes(["727,70", "71,36"]).map((l) => l.slice(0, 7))] },
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "CCD", linhas: [...vazias(9), cabecalhoComp, ...composicoes(["693,60", "999,99"]).map((l) => l.slice(0, 7))] },
  { arquivo: "SINAPI_Referência_2026_10.xlsx", aba: "Analítico", linhas: [...vazias(9), ...analitico] },
];

describe("leitura do SINAPI", () => {
  it("identifica mês, regimes, insumos, composições e analítico", () => {
    const c = interpretarSinapi(planilhas(), { uf: "RJ" });
    expect(c.mes).toBe("2026-10-01");
    expect(c.insumos.size).toBe(5);
    expect(c.insumos.get("4750")?.tipo).toBe("mao_de_obra");
    expect(c.precos.nao_desonerado.get("4750")?.preco).toBe("27.13");
    expect(c.precos.desonerado.get("4750")?.preco).toBe("22.40");
    expect(c.precos.nao_desonerado.get("370")?.preco).toBe("120.00");
    expect(c.custos.nao_desonerado.get("103322")).toBe("71.36");
    expect(c.analitico).toHaveLength(7);
    expect(c.analitico.find((a) => a.item === "87292")?.tipo).toBe("composicao");
  });

  it("classifica o insumo pela descrição quando o arquivo não traz a classificação", () => {
    expect(tipoDoInsumo(null, "PEDREIRO", "H")).toBe("mao_de_obra");
    expect(tipoDoInsumo(null, "BETONEIRA 400 L", "H")).toBe("equipamento");
    expect(tipoDoInsumo(null, "AREIA MEDIA", "M3")).toBe("material");
  });

  it("recusa arquivo sem preços da UF", () => {
    expect(() => interpretarSinapi(planilhas(), { uf: "BA" })).toThrow(/Nenhum preço/);
  });

  it("lê o arquivo .xlsx de verdade, com o nome das abas", async () => {
    const wb = new ExcelJS.Workbook();
    for (const p of planilhas()) {
      const ws = wb.addWorksheet(p.aba);
      p.linhas.forEach((l) => ws.addRow(l));
    }
    const pasta = mkdtempSync(join(tmpdir(), "sinapi-"));
    const arquivo = join(pasta, "SINAPI_Referência_2026_10.xlsx");
    await wb.xlsx.writeFile(arquivo);
    const lidas = await lerPlanilhas([arquivo]);
    expect(lidas.map((p) => p.aba)).toEqual(["ISD", "ICD", "ISE", "CSD", "CCD", "Analítico"]);
    const c = interpretarSinapi(lidas, { uf: "RJ" });
    expect(c.precos.nao_desonerado.get("7271")?.preco).toBe("1.37");
    expect(c.analitico).toHaveLength(7);
  });
});

describe("gravação da carga", () => {
  it("grava os dois regimes, confere os custos e libera só o que confere", async () => {
    const c = await pool().connect();
    let r;
    try {
      await c.query("begin");
      r = await gravarCargaSinapi(c, interpretarSinapi(planilhas(), { uf: "RJ" }));
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
    const nd = r.find((x) => x.regime === "nao_desonerado")!;
    const d = r.find((x) => x.regime === "desonerado")!;
    expect(nd).toMatchObject({ insumos: 5, composicoes: 2, conferidas: 2, divergentes: 0, situacao: "liberada" });
    // O custo desonerado da alvenaria foi publicado errado de propósito (999,99): a tabela fica em conferência.
    expect(d).toMatchObject({ divergentes: 1, situacao: "em_conferencia" });

    const orgao = await novoOrgao();
    const eng = await novoUsuario(orgao, "engenheiro");
    const tabelas = await listarTabelas(eng, { somenteLiberadas: true });
    expect(tabelas.map((t) => t.regime)).toContain("nao_desonerado");
    const comps = await buscarComposicoes(eng, { tabelaId: nd.tabelaId, busca: "alvenaria blocos" });
    expect(comps[0]).toMatchObject({ codigo: "103322", custo: "71.36" });
    const ins = await buscarInsumos(eng, { tabelaId: nd.tabelaId, busca: "cimento" });
    expect(ins[0]).toMatchObject({ codigo: "1379", preco: "0.92" });
  });

  it("o sistema não grava na base oficial fora da carga mensal", async () => {
    const orgao = await novoOrgao();
    await expect(comContexto({ usuarioId: null, orgaoId: orgao }, (c) =>
      c.query("insert into insumo (orgao_id, fonte, codigo, descricao, unidade, tipo) values (null, 'sinapi', '999', 'X', 'UN', 'material')"),
    )).rejects.toThrow();
    await expect(comContexto({ usuarioId: null, orgaoId: orgao }, (c) =>
      c.query("update preco_insumo set preco = 0 returning 1").then((x) => { if (x.rowCount) throw new Error("alterou"); }),
    )).resolves.toBeUndefined();
  });
});

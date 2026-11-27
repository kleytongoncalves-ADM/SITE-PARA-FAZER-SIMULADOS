import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { abaComparativo, calcularComparativo, type DadosComparativo } from "../src/lib/excel-comparativo";

const base = (nf: number, ni: number, frete = false): DadosComparativo => ({
  titulo: "Comparativo de preços · Cotação nº 001", subtitulo: "Teste", rodape: "CiviObras",
  identificacao: [["Obra", "OB-01 · Escola"], ["Referência de preços", "SINAPI RJ out/2026"]],
  fonte: "SINAPI", regra: "arredondar",
  itens: Array.from({ length: ni }, (_, i) => ({ codigo: String(1000 + i), descricao: `Material ${i + 1}`, unidade: "m³", quantidade: 10 + i, referencia: i === 1 ? null : 100 + i * 10 })),
  fornecedores: Array.from({ length: nf }, (_, k) => ({
    nome: `Fornecedor ${k + 1}`, cnpj: "00.000.000/0001-00", frete: frete && k === 0 ? 150 : 0,
    precos: Array.from({ length: ni }, (_, i) => (k === nf - 1 && i === 0 ? null : 90 + i * 10 + k * 7.5)),
  })),
});

async function gerar(d: DadosComparativo) {
  const wb = new ExcelJS.Workbook();
  const ws = await abaComparativo(wb, d, null);
  return ws;
}

describe("planilha comparativa", () => {
  it("tem exatamente as colunas e linhas do processo", async () => {
    for (const [nf, ni] of [[3, 4], [4, 7], [6, 2]]) {
      const ws = await gerar(base(nf, ni));
      expect(ws.columnCount).toBe(8 + 3 * nf + 5);
      // faixa (4) + identificação (2) + espaço + cabeçalho (3) + itens + total + espaço + análise (11)
      expect(ws.rowCount).toBe(4 + 2 + 1 + 3 + ni + 1 + 1 + 11);
      ws.eachRow((row) => row.eachCell((c) => expect(c.alignment?.wrapText ?? false).toBe(false)));
    }
  });

  it("acrescenta a linha de frete só quando há frete", async () => {
    expect((await gerar(base(3, 3, true))).rowCount).toBe((await gerar(base(3, 3))).rowCount + 1);
  });

  it("apura como o modelo: totais, variação nos mesmos itens e classificação só entre propostas completas", () => {
    const d = base(3, 3, true);
    const c = calcularComparativo(d);
    // Item 1: 10 × 100 = 1000; item 3: 12 × 120 = 1440; item 2 sem referência.
    expect(c.totalReferencia).toBe(2440);
    expect(c.forn[0].total).toBe(10 * 90 + 11 * 100 + 12 * 110);
    expect(c.forn[0].global).toBe(c.forn[0].total! + 150);
    expect(c.forn[2].completa).toBe("Não");
    expect(c.forn[2].refMesmos).toBe(1440);
    expect(c.forn[2].variacao).toBeCloseTo((12 * 125) / 1440 - 1, 10);
    expect(c.classificacao).toEqual(["1º lugar", "2º lugar", "Fora da classificação"]);
    expect(c.porItem[0]).toMatchObject({ n: 2, menor: 900, quem: "Fornecedor 1" });
    expect(c.itensComTres).toBe("✖ Faltam 1 de 3 itens");
    expect(c.fornecedorMenorGlobal).toBe("Fornecedor 1");
  });

  it("trunca quando a cotação usa truncamento", () => {
    const d = base(3, 1);
    d.itens[0] = { ...d.itens[0], quantidade: 3, referencia: 0.335 }; // 1,005
    expect(calcularComparativo(d).refTot[0]).toBe(1.01);
    expect(calcularComparativo({ ...d, regra: "truncar" }).refTot[0]).toBe(1);
  });
});

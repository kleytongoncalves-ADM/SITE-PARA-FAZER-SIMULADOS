import { describe, expect, it } from "vitest";
import { montarObra, papelNaObra, secaoDaDescricao } from "../src/servicos/obra-3d";

describe("obra 3D a partir do orçamento", () => {
  it("reconhece o papel do serviço pela descrição e unidade", () => {
    expect(papelNaObra("ALVENARIA DE VEDAÇÃO COM BLOCO CERÂMICO 9 X 19 X 19 CM", "m²")?.papel).toBe("alvenaria");
    expect(papelNaObra("PINTURA LÁTEX ACRÍLICA EM PAREDE", "m²")?.acabamento).toBe("pintura");
    expect(papelNaObra("SAPATA CORRIDA EM CONCRETO ARMADO", "m³")?.papel).toBe("fundacao");
    expect(papelNaObra("LOCAÇÃO DE OBRA COM GABARITO", "m")).toBeNull();
  });
  it("lê a seção escrita na descrição", () => {
    expect(secaoDaDescricao("CINTA DE AMARRAÇÃO 15 X 10 CM")).toEqual([0.15, 0.1]);
    expect(secaoDaDescricao("PINTURA")).toBeNull();
  });
  it("tira o comprimento do muro da área de alvenaria e da altura informada", () => {
    const itens = [
      { itemId: "a", descricao: "ALVENARIA DE VEDAÇÃO COM BLOCO CERÂMICO 9 X 19 X 19 CM", unidade: "m²", quantidade: 17 },
      { itemId: "b", descricao: "CHAPISCO EM PAREDE", unidade: "m²", quantidade: 40 },
      { itemId: "c", descricao: "PILARETE EM CONCRETO ARMADO 15 X 15 CM", unidade: "m", quantidade: 10 },
      { itemId: "d", descricao: "LOCAÇÃO DE OBRA", unidade: "m", quantidade: 10 },
      { itemId: "e", descricao: "REBOCO", unidade: "m²", quantidade: 40 },
    ];
    const m = { local: "Muro", altura: 1.7, comprimento: null };
    const obra = montarObra(itens, { a: m, b: m, c: m, d: m });
    expect(obra.locais).toHaveLength(1);
    expect(obra.locais[0].comprimento).toBeCloseTo(10, 5);
    expect(obra.representados.sort()).toEqual(["a", "b", "c"]);
    const parede = obra.locais[0].partes.find((p) => p.itemId === "a")!;
    expect(parede.tam).toEqual([10, 1.7, 0.09]);
    expect(obra.locais[0].partes.filter((p) => p.itemId === "c")).toHaveLength(6);
  });
  it("sem medidas, não desenha nada", () => {
    expect(montarObra([{ itemId: "a", descricao: "ALVENARIA", unidade: "m²", quantidade: 17 }], {}).locais).toHaveLength(0);
  });
});

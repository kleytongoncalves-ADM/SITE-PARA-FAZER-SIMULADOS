import { describe, expect, it } from "vitest";
import { modeloDoInsumo, modeloDoServico, normalizar } from "../src/servicos/vinculo-3d";
import { cenaDoItem, montarCena, TETO, type InsumoEntrada, type ItemEntrada } from "../src/servicos/cena-3d";

const etapa = { id: "e1", ordem: 1, nome: "Muro" };
const item = (p: Partial<ItemEntrada>): ItemEntrada => ({ id: "i1", numero: "1.1", etapaId: "e1", modo: "material", descricao: "", unidade: "UN", quantidade: "1", ...p });

describe("vínculo dos insumos com a biblioteca 3D", () => {
  it("normaliza acentos, nº e medidas", () => {
    expect(normalizar("Areia média lavada nº 2")).toBe("AREIA MEDIA LAVADA N 2");
    expect(normalizar("Bloco 9 x 19  x 19")).toBe("BLOCO 9X19X19");
  });

  it("acha o modelo pela descrição do insumo", () => {
    expect(modeloDoInsumo("AREIA MÉDIA LAVADA", "material")).toBe("ALV-AGR-002");
    expect(modeloDoInsumo("CIMENTO PORTLAND COMPOSTO CP II-32", "material")).toBe("EST-CIM-001");
    expect(modeloDoInsumo("AÇO CA-50 12,5 MM", "material")).toBe("EST-ACO-004");
    expect(modeloDoInsumo("BLOCO CERÂMICO DE VEDAÇÃO 9 X 19 X 19 CM", "material")).toBe("ALV-BLC-002");
    expect(modeloDoInsumo("PEDREIRO", "mao_de_obra")).toBe("MDO-OBR-002");
    expect(modeloDoInsumo("SERVENTE", "mao_de_obra")).toBe("MDO-OBR-001");
    expect(modeloDoInsumo("BETONEIRA 400 L", "equipamento")).toBe("EQP-CON-001");
  });

  it("não representa água, frete nem taxas", () => {
    expect(modeloDoInsumo("ÁGUA", "material")).toBeNull();
    expect(modeloDoInsumo("FRETE", "material")).toBeNull();
    expect(modeloDoInsumo("TAXA DE ART", "taxa")).toBeNull();
  });

  it("liga a composição ao serviço montado", () => {
    expect(modeloDoServico("ALVENARIA DE VEDAÇÃO COM BLOCO CERÂMICO 9 X 19 X 19 CM, ARGAMASSA 1:2:8")).toBe("KIT-ALV-01");
  });
});

describe("cena do orçamento", () => {
  const insumos: InsumoEntrada[] = [
    { descricao: "AREIA MÉDIA LAVADA", unidade: "M3", tipo: "material", coeficiente: "0.0125", preco: "125" },
    { descricao: "PEDREIRO", unidade: "H", tipo: "mao_de_obra", coeficiente: "0.8", preco: "30" },
    { descricao: "SERVENTE", unidade: "H", tipo: "mao_de_obra", coeficiente: "2", preco: "20" },
    { descricao: "ÁGUA", unidade: "M3", tipo: "material", coeficiente: "0.01", preco: "10" },
  ];
  const servico = cenaDoItem(item({ modo: "servico", descricao: "ALVENARIA DE VEDAÇÃO COM BLOCO CERÂMICO 9 X 19 X 19 CM, ARGAMASSA 1:2:8", unidade: "M2", quantidade: "17" }), etapa, insumos);

  it("serviço traz o kit, os materiais e a equipe, nessa ordem", () => {
    expect(servico.pecas.map((p) => p.papel)).toEqual(["kit", "material", "mao_de_obra", "mao_de_obra"]);
    expect(servico.unidade).toBe("m²");
    expect(servico.pecas[0]).toMatchObject({ codigo: "KIT-ALV-01", rotulo: "17 m²", visual: { tipo: "kit", visiveis: 4 } });
    expect(servico.semModelo).toEqual([]);
  });

  it("equipe acende um anel de 24 h por figura", () => {
    const servente = servico.pecas.find((p) => p.codigo === "MDO-OBR-001")!;
    expect(servente.rotulo).toBe("34 h");
    expect(servente.visual).toEqual({ tipo: "figura", horas: 34, figuras: 2, segmentos: 10 });
    expect(servente.custo).toBeCloseTo(680);
  });

  it("monte de areia cresce com o volume, até o teto", () => {
    const escala = (q: string) => {
      const v = cenaDoItem(item({ descricao: "AREIA MÉDIA LAVADA", unidade: "M3", quantidade: q }), etapa, []).pecas[0].visual;
      return v.tipo === "monte" ? v.escala : NaN;
    };
    expect(escala("3.5")).toBeGreaterThan(escala("1"));
    expect(escala("50")).toBeCloseTo(escala(String(TETO.monteM3)));
  });

  it("converte kg em sacos e limita as peças visíveis", () => {
    const pouco = cenaDoItem(item({ descricao: "CIMENTO PORTLAND COMPOSTO CP II-32", unidade: "KG", quantidade: "20" }), etapa, []).pecas[0];
    expect(pouco.rotulo).toBe("1 saco");
    const muito = cenaDoItem(item({ descricao: "CIMENTO PORTLAND COMPOSTO CP II-32", unidade: "KG", quantidade: "500000" }), etapa, []).pecas[0];
    expect(muito.visual).toMatchObject({ tipo: "pilha", pecas: 10000, visiveis: TETO.pecaMedia });
  });

  it("item sem modelo aparece na lista e fica sem peças", () => {
    const c = cenaDoItem(item({ descricao: "ITEM QUALQUER SEM FORMA", quantidade: "2" }), etapa, []);
    expect(c.pecas).toEqual([]);
    expect(c.semModelo).toEqual(["ITEM QUALQUER SEM FORMA"]);
  });

  it("monta a cena de todas as etapas", () => {
    const cena = montarCena([{ ...etapa, itens: [item({ id: "a", descricao: "AREIA MÉDIA LAVADA", unidade: "M3" }), item({ id: "b", descricao: "PEDREIRO" })] }], new Map());
    expect(cena.map((c) => c.itemId)).toEqual(["a", "b"]);
  });
});

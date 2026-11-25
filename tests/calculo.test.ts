import { describe, expect, it } from "vitest";
import { ajustar, dec, lerNumeroBr, texto } from "../src/lib/decimal";
import {
  bdiPadrao, calcularBdi, calcularCronograma, calcularItem, conferirBdi, cprbDoAno, curvaAbc, custoUnitario,
  distribuirIgual, precoDasCotacoes,
} from "../src/servicos/calculo";

describe("decimal exato", () => {
  it("arredonda e trunca em duas casas", () => {
    expect(texto(ajustar(dec("10.005"), 2, "arredondar"))).toBe("10.01");
    expect(texto(ajustar(dec("10.009"), 2, "truncar"))).toBe("10.00");
    expect(texto(ajustar(dec("-2.345"), 2, "arredondar"))).toBe("-2.35");
    expect(texto(dec("0.1") + dec("0.2"))).toBe("0.30");
  });
  it("lê números no padrão brasileiro", () => {
    expect(texto(lerNumeroBr("1.234,56")!)).toBe("1234.56");
    expect(texto(lerNumeroBr("20")!)).toBe("20.00");
    expect(lerNumeroBr("abc")).toBeNull();
    expect(lerNumeroBr("")).toBeNull();
  });
});

describe("BDI", () => {
  it("segue a fórmula do Acórdão TCU 2.622/2013", () => {
    // (1 + 4% + 0,8% + 1,27%) x (1 + 1,23%) x (1 + 7,4%) / (1 - 6,65%) - 1 = 23,54%
    const b = bdiPadrao("edificacoes", false, 2026);
    expect(texto(calcularBdi(b))).toBe("23.54");
  });
  it("inclui a CPRB da reoneração gradual quando desonerado", () => {
    expect(cprbDoAno(2024)).toBe("4.50");
    expect(cprbDoAno(2026)).toBe("2.70");
    expect(cprbDoAno(2028)).toBe("0.00");
    expect(bdiPadrao("edificacoes", true, 2026).cprb).toBe("2.70");
    expect(calcularBdi(bdiPadrao("edificacoes", true, 2026)) > calcularBdi(bdiPadrao("edificacoes", false, 2026))).toBe(true);
  });
  it("avisa parcelas e BDI fora da faixa de referência", () => {
    const b = { ...bdiPadrao("edificacoes", false, 2026), l: "12.00" };
    const avisos = conferirBdi(b, "edificacoes").map((a) => a.parcela);
    expect(avisos).toContain("l");
    expect(avisos).toContain("bdi");
  });
});

describe("custo unitário e item", () => {
  const linhas = [
    { coeficiente: dec("25"), preco: dec("1.37"), tipo: "material" as const },
    { coeficiente: dec("0.0105"), preco: dec("612.30"), tipo: "material" as const },
    { coeficiente: dec("0.8"), preco: dec("27.13"), tipo: "mao_de_obra" as const },
    { coeficiente: dec("0.4"), preco: dec("19.41"), tipo: "mao_de_obra" as const },
  ];
  it("soma coeficiente x preço e separa material e mão de obra", () => {
    const c = custoUnitario(linhas, "arredondar");
    // 34,25 + 6,42915 + 21,704 + 7,764 = 70,14715
    expect(texto(c.total)).toBe("70.15");
    expect(texto(c.material + c.maoDeObra + c.equipamento)).toBe("70.15");
    expect(texto(custoUnitario(linhas, "truncar").total)).toBe("70.14");
    expect(c.semPreco).toBe(false);
  });
  it("marca o item sem preço", () => {
    expect(custoUnitario([...linhas, { coeficiente: dec(1), preco: null, tipo: "material" }], "arredondar").semPreco).toBe(true);
    const i = calcularItem({ quantidade: dec(2), custoUnitario: null, material: 0n, maoDeObra: 0n, equipamento: 0n, tipoBdi: "obra" }, { obra: dec(25), fornecimento: dec(15) }, "arredondar");
    expect(i.semPreco).toBe(true);
  });
  it("aplica o BDI no preço unitário e a regra do orçamento no total", () => {
    const i = calcularItem(
      { quantidade: dec("16.65"), custoUnitario: dec("70.15"), material: dec("40.68"), maoDeObra: dec("29.47"), equipamento: 0n, tipoBdi: "obra" },
      { obra: dec("23.54"), fornecimento: dec("14.02") }, "arredondar",
    );
    expect(texto(i.custoTotal)).toBe("1168.00"); // 16,65 x 70,15 = 1.167,9975
    expect(texto(i.precoUnitario)).toBe("86.66"); // 70,15 x 1,2354 = 86,66331
    expect(texto(i.total)).toBe("1442.89"); // 16,65 x 86,66 = 1.442,889
    const t = calcularItem(
      { quantidade: dec("16.65"), custoUnitario: dec("70.15"), material: dec("40.68"), maoDeObra: dec("29.47"), equipamento: 0n, tipoBdi: "obra" },
      { obra: dec("23.54"), fornecimento: dec("14.02") }, "truncar",
    );
    expect(texto(t.custoTotal)).toBe("1167.99");
    expect(texto(t.total)).toBe("1442.88");
  });
  it("adota o preço das cotações pelo critério escolhido", () => {
    const v = [dec("100"), dec("120"), dec("90")];
    expect(precoDasCotacoes(v.slice(0, 2), "media", "arredondar")).toBeNull();
    expect(texto(precoDasCotacoes(v, "menor", "arredondar")!)).toBe("90.00");
    expect(texto(precoDasCotacoes(v, "mediana", "arredondar")!)).toBe("100.00");
    expect(texto(precoDasCotacoes(v, "media", "arredondar")!)).toBe("103.33");
  });
});

describe("curva ABC e cronograma", () => {
  it("classifica A até 80%, B até 95% e C o restante", () => {
    const abc = curvaAbc([
      { k: "a", valor: dec(50) }, { k: "b", valor: dec(30) }, { k: "c", valor: dec(10) },
      { k: "d", valor: dec(6) }, { k: "e", valor: dec(4) },
    ]);
    expect(abc.map((l) => `${l.k}${l.classe}`)).toEqual(["aA", "bA", "cB", "dB", "eC"]);
    expect(texto(abc[4].acumulado)).toBe("100.00");
  });
  it("distribui as etapas nos períodos e fecha no total exato", () => {
    const pct = distribuirIgual(3);
    expect(texto(pct[1] + pct[2] + pct[3])).toBe("100.00");
    const c = calcularCronograma([{ id: "e1", total: dec("1000.00"), percentuais: pct }, { id: "e2", total: dec("500"), percentuais: { 2: dec(100) } }], 3, "arredondar");
    expect(c.linhas[0].valores.map((v) => texto(v))).toEqual(["333.33", "333.33", "333.34"]);
    expect(c.linhas.every((l) => l.fechada)).toBe(true);
    expect(texto(c.acumulado[2])).toBe("1500.00");
    expect(texto(c.porPeriodo[1])).toBe("833.33");
  });
});

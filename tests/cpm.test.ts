import { describe, expect, it } from "vitest";
import {
  calcularCpm, CicloNoCronograma, criarRelogio, curvaS, datasDasAtividades, escreverPredecessoras, indicadoresPrazo,
  lerPredecessoras, periodos, type Calendario,
} from "../src/servicos/cpm";

const corridos: Calendario = { tipo: "corridos", feriados: new Set() };
const uteis: Calendario = { tipo: "uteis", feriados: new Set(["2026-11-20"]) };

describe("caminho crítico", () => {
  // A(3) → B(2) → D(1); A → C(4) → D. Caminho crítico: A, C, D (8 dias). B tem 2 dias de folga.
  const ats = [{ id: "A", duracao: 3 }, { id: "B", duracao: 2 }, { id: "C", duracao: 4 }, { id: "D", duracao: 1 }];
  const deps = [
    { atividadeId: "B", predecessoraId: "A", tipo: "TI" as const, defasagem: 0 },
    { atividadeId: "C", predecessoraId: "A", tipo: "TI" as const, defasagem: 0 },
    { atividadeId: "D", predecessoraId: "B", tipo: "TI" as const, defasagem: 0 },
    { atividadeId: "D", predecessoraId: "C", tipo: "TI" as const, defasagem: 0 },
  ];

  it("calcula prazo, folgas e atividades críticas", () => {
    const r = calcularCpm(ats, deps);
    expect(r.prazo).toBe(8);
    expect(r.atividades.get("A")).toMatchObject({ es: 0, ef: 3, folga: 0, critica: true });
    expect(r.atividades.get("B")).toMatchObject({ es: 3, ef: 5, ls: 5, folga: 2, critica: false });
    expect(r.atividades.get("C")).toMatchObject({ es: 3, ef: 7, folga: 0, critica: true });
    expect(r.atividades.get("D")).toMatchObject({ es: 7, ef: 8, folga: 0, critica: true });
  });

  it("respeita os quatro tipos de dependência e a defasagem", () => {
    const base = [{ id: "P", duracao: 5 }, { id: "S", duracao: 3 }];
    const es = (tipo: "TI" | "II" | "TT" | "IT", defasagem = 0) =>
      calcularCpm(base, [{ atividadeId: "S", predecessoraId: "P", tipo, defasagem }]).atividades.get("S")!.es;
    expect(es("TI")).toBe(5);
    expect(es("TI", 2)).toBe(7);
    expect(es("II", 1)).toBe(1);
    expect(es("TT")).toBe(2);
    expect(es("IT", 4)).toBe(1);
  });

  it("marco tem duração zero e não ocupa dia", () => {
    const r = calcularCpm([{ id: "M", duracao: 0 }, { id: "X", duracao: 2 }], [{ atividadeId: "X", predecessoraId: "M", tipo: "TI", defasagem: 0 }]);
    expect(r.atividades.get("X")!.es).toBe(0);
    expect(r.prazo).toBe(2);
  });

  it("recusa ciclo nas dependências", () => {
    expect(() => calcularCpm([{ id: "A", duracao: 1 }, { id: "B", duracao: 1 }], [
      { atividadeId: "A", predecessoraId: "B", tipo: "TI", defasagem: 0 },
      { atividadeId: "B", predecessoraId: "A", tipo: "TI", defasagem: 0 },
    ])).toThrow(CicloNoCronograma);
  });
});

describe("calendário", () => {
  it("em dias úteis pula fim de semana e feriado", () => {
    // 2026-11-19 é quinta; 20 é feriado; 21 e 22 fim de semana.
    const r = criarRelogio("2026-11-19", uteis);
    expect(r.data(0)).toBe("2026-11-19");
    expect(r.data(1)).toBe("2026-11-23");
    expect(r.indice("2026-11-22")).toBe(0);
    expect(r.indice("2026-11-24")).toBe(2);
  });

  it("início em sábado começa na segunda", () => {
    expect(criarRelogio("2026-11-28", uteis).data(0)).toBe("2026-11-30");
  });

  it("converte o CPM em datas", () => {
    const cpm = calcularCpm([{ id: "A", duracao: 3 }], []);
    const d = datasDasAtividades(cpm, "2026-11-19", uteis);
    expect(d.atividades.get("A")).toMatchObject({ inicio: "2026-11-19", fim: "2026-11-24" });
    expect(d.termino).toBe("2026-11-24");
    expect(datasDasAtividades(cpm, "2026-11-19", corridos).termino).toBe("2026-11-21");
  });
});

describe("curva S e indicadores", () => {
  const ats = [
    { id: "A", inicio: "2026-12-01", fim: "2026-12-04", duracao: 4, valor: 400, avancos: [{ data: "2026-12-02", percentual: 50 }] },
    { id: "B", inicio: "2026-12-05", fim: "2026-12-08", duracao: 4, valor: 600, avancos: [] },
  ];

  it("distribui o valor pelos dias e acumula até 100%", () => {
    const lista = periodos("2026-12-01", "2026-12-08", "semana");
    expect(lista).toHaveLength(2);
    const c = curvaS(ats, lista, corridos, "2026-12-03");
    expect(c[0].previstoAcumulado).toBeCloseTo(400 + 450);
    expect(c[1].previstoPct).toBeCloseTo(100);
    expect(c[0].realizadoAcumulado).toBeCloseTo(200);
    expect(c[1].realizado).toBeNull();
  });

  it("IDP compara valor agregado com o planejado", () => {
    const i = indicadoresPrazo(ats, corridos, "2026-12-02");
    expect(i.vp).toBeCloseTo(200);
    expect(i.va).toBeCloseTo(200);
    expect(i.idp).toBeCloseTo(1);
    expect(indicadoresPrazo(ats, corridos, "2026-12-04").idp).toBeCloseTo(0.5);
  });

  it("períodos mensais seguem o calendário", () => {
    const m = periodos("2026-11-20", "2027-01-10", "mes");
    expect(m.map((p) => p.rotulo)).toEqual(["nov/26", "dez/26", "jan/27"]);
    expect(m[0].inicio).toBe("2026-11-20");
    expect(m[1].fim).toBe("2026-12-31");
  });
});

describe("predecessoras em texto", () => {
  it("lê e escreve", () => {
    const r = lerPredecessoras("1.2; 1.3TI+2, 1.4II-1;M1TT");
    expect(r.ok && r.lista).toEqual([
      { codigo: "1.2", tipo: "TI", defasagem: 0 },
      { codigo: "1.3", tipo: "TI", defasagem: 2 },
      { codigo: "1.4", tipo: "II", defasagem: -1 },
      { codigo: "M1", tipo: "TT", defasagem: 0 },
    ]);
    if (r.ok) expect(escreverPredecessoras(r.lista)).toBe("1.2; 1.3TI+2; 1.4II-1; M1TT");
  });

  it("recusa texto inválido", () => {
    expect(lerPredecessoras("1.2 abc").ok).toBe(false);
    const vazio = lerPredecessoras("");
    expect(vazio.ok && vazio.lista).toEqual([]);
  });
});

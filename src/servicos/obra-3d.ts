/**
 * Desenha a obra a partir do orçamento: cada item com medidas vira um elemento construído
 * (alvenaria, camadas de revestimento, fundação, pilares, cinta, piso, cobertura).
 * Função pura. Usa só quantidades do orçamento, medidas informadas pela equipe e as
 * seções escritas na descrição do serviço ("15 x 10 cm"). Sem medida suficiente, o item fica de fora.
 */
export type MedidaItem = { local: string; altura: number | null; comprimento: number | null };
export type Acabamento = "bloco" | "chapisco" | "reboco" | "massa" | "pintura" | "concreto" | "piso" | "telha";
export type PapelObra = "alvenaria" | "camada" | "fundacao" | "pilar" | "cinta" | "piso" | "cobertura";

export type ParteObra = {
  itemId: string; papel: PapelObra; acabamento: Acabamento;
  /** Centro e tamanho em metros, no eixo do local: x ao longo do comprimento, y para cima, z na espessura. */
  pos: [number, number, number]; tam: [number, number, number];
  /** Inclinação em graus em torno do eixo x (cobertura). */
  inclinacao?: number;
};
export type LocalObra = { nome: string; comprimento: number; altura: number; profundidade: number; partes: ParteObra[] };
export type Obra = { locais: LocalObra[]; representados: string[] };

export type ItemObra = { itemId: string; descricao: string; unidade: string; quantidade: number };

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const unidade = (u: string) => sem(u).replace("²", "2").replace("³", "3").trim();

const CAMADAS: [RegExp, Acabamento][] = [
  [/chapisco/, "chapisco"], [/emboco|reboco|massa unica/, "reboco"], [/massa corrida|massa acrilica|emassamento/, "massa"],
  [/pintura|tinta|latex|textura/, "pintura"],
];
const ORDEM: Record<Acabamento, number> = { bloco: 0, chapisco: 1, reboco: 2, massa: 3, pintura: 4, concreto: 0, piso: 0, telha: 0 };

/** Que elemento da obra o serviço representa, pela descrição e pela unidade. */
export function papelNaObra(descricao: string, un: string): { papel: PapelObra; acabamento: Acabamento } | null {
  const d = sem(descricao), u = unidade(un);
  if (/telha|telhamento|cobertura/.test(d) && u === "m2") return { papel: "cobertura", acabamento: "telha" };
  if (/\bpiso\b|contrapiso|porcelanato|laje|lastro/.test(d) && (u === "m2" || u === "m3")) return { papel: "piso", acabamento: /contrapiso|laje|lastro|concreto/.test(d) ? "concreto" : "piso" };
  if (/sapata|baldrame|fundacao|radier|bloco de coroamento/.test(d) && (u === "m3" || u === "m")) return { papel: "fundacao", acabamento: "concreto" };
  if (/pilarete|pilar/.test(d) && (u === "m" || u === "m3")) return { papel: "pilar", acabamento: "concreto" };
  if (/cinta|viga|verga/.test(d) && (u === "m" || u === "m3")) return { papel: "cinta", acabamento: "concreto" };
  if (u !== "m2") return null;
  if (/alvenaria/.test(d)) return { papel: "alvenaria", acabamento: "bloco" };
  for (const [re, a] of CAMADAS) if (re.test(d)) return { papel: "camada", acabamento: a };
  return null;
}

/** Medidas em centímetros escritas na descrição: "15 X 10 CM", "9 X 19 X 19 CM". */
export function secaoDaDescricao(descricao: string): number[] | null {
  const m = sem(descricao).match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*x\s*(\d+(?:[.,]\d+)?))?\s*cm/);
  if (!m) return null;
  return m.slice(1).filter(Boolean).map((v) => Number(v.replace(",", ".")) / 100);
}

const CAMADA_ESP = 0.012;

export function montarObra(itens: ItemObra[], medidas: Record<string, MedidaItem>): Obra {
  const grupos = new Map<string, { nome: string; itens: (ItemObra & MedidaItem & NonNullable<ReturnType<typeof papelNaObra>>)[] }>();
  for (const i of itens) {
    const m = medidas[i.itemId];
    const p = papelNaObra(i.descricao, i.unidade);
    if (!m || !p || !(i.quantidade > 0)) continue;
    const chave = sem(m.local).trim();
    if (!grupos.has(chave)) grupos.set(chave, { nome: m.local.trim(), itens: [] });
    grupos.get(chave)!.itens.push({ ...i, ...m, ...p });
  }

  const locais: LocalObra[] = [];
  for (const g of grupos.values()) {
    const partes: ParteObra[] = [];
    const de = (papel: PapelObra) => g.itens.filter((i) => i.papel === papel);
    const altura = Math.max(0, ...g.itens.map((i) => i.altura ?? 0));
    const alvenaria = de("alvenaria"), camadas = de("camada").sort((a, b) => ORDEM[a.acabamento] - ORDEM[b.acabamento]);
    const parede = alvenaria.length > 0 || camadas.length > 0;

    // Comprimento do elemento: informado; senão, área da alvenaria ÷ altura; senão, o maior trecho linear.
    let L = Math.max(0, ...g.itens.map((i) => i.comprimento ?? 0));
    if (!L && alvenaria.length && altura) L = alvenaria.reduce((t, i) => t + i.quantidade, 0) / altura;
    if (!L) L = Math.max(0, ...g.itens.filter((i) => unidade(i.unidade) === "m" && i.papel !== "pilar").map((i) => i.quantidade));
    if (!L && camadas.length && altura) L = Math.max(...camadas.map((i) => i.quantidade)) / altura;
    if (!L) continue;

    const esp = (alvenaria[0] && secaoDaDescricao(alvenaria[0].descricao)?.[0]) || 0.14;
    let profundidade = esp;

    // Fundação apoiada no terreno, sob o elemento.
    let base = 0;
    for (const f of de("fundacao")) {
      const s = secaoDaDescricao(f.descricao);
      const area = unidade(f.unidade) === "m3" ? f.quantidade / L : s ? s[0] * s[1] : 0;
      if (!area) continue;
      const larg = s ? Math.max(s[0], s[1]) : Math.max(esp + 0.2, Math.sqrt(area * 1.6));
      const alt = area / larg;
      partes.push({ itemId: f.itemId, papel: "fundacao", acabamento: "concreto", pos: [0, base + alt / 2, 0], tam: [L + 0.2, alt, larg] });
      base += alt; profundidade = Math.max(profundidade, larg);
    }

    if (parede && altura) {
      for (const a of alvenaria.slice(0, 1)) partes.push({ itemId: a.itemId, papel: "alvenaria", acabamento: "bloco", pos: [0, base + altura / 2, 0], tam: [L, altura, esp] });
      // Camadas em corte: cada uma começa um pouco adiante, deixando a anterior à vista.
      camadas.forEach((c, k) => {
        const inicio = alvenaria.length || k > 0 ? ((k + 1) / (camadas.length + 1)) * 0.72 * L : 0;
        const z = esp / 2 + CAMADA_ESP * (k + 0.5);
        partes.push({ itemId: c.itemId, papel: "camada", acabamento: c.acabamento, pos: [inicio / 2, base + altura / 2, z], tam: [L - inicio, altura, CAMADA_ESP] });
        // Área que dá para as duas faces: a de trás aparece inteira.
        if (c.quantidade >= L * altura * 1.5) partes.push({ itemId: c.itemId, papel: "camada", acabamento: c.acabamento, pos: [0, base + altura / 2, -z], tam: [L, altura, CAMADA_ESP] });
      });
      for (const p of de("pilar")) {
        const s = secaoDaDescricao(p.descricao) ?? [0.15, 0.15];
        const metros = unidade(p.unidade) === "m" ? p.quantidade : p.quantidade / (s[0] * s[1]);
        const n = Math.max(1, Math.round(metros / altura));
        for (let k = 0; k < n; k++) {
          const x = n === 1 ? 0 : -L / 2 + s[0] / 2 + (k * (L - s[0])) / (n - 1);
          partes.push({ itemId: p.itemId, papel: "pilar", acabamento: "concreto", pos: [x, base + altura / 2, 0], tam: [s[0], altura, Math.max(esp, s[1]) + 0.004] });
        }
      }
    }
    let topo = base + (parede ? altura : 0);
    for (const c of de("cinta")) {
      const s = secaoDaDescricao(c.descricao) ?? [0.15, 0.1];
      const comp = unidade(c.unidade) === "m" ? Math.min(c.quantidade, L) : L;
      const larg = Math.max(s[0], s[1]), alt = Math.min(s[0], s[1]);
      partes.push({ itemId: c.itemId, papel: "cinta", acabamento: "concreto", pos: [-(L - comp) / 2, topo + alt / 2, 0], tam: [comp, alt, Math.max(larg, esp) + 0.004] });
      topo += alt; profundidade = Math.max(profundidade, larg);
    }
    let nivel = 0;
    for (const p of de("piso")) {
      const esp2 = unidade(p.unidade) === "m3" ? null : 0.03;
      const comp = p.comprimento ?? (parede ? L : 0);
      if (!comp) continue;
      const area = esp2 ? p.quantidade : 0;
      const larg = esp2 ? area / comp : 0;
      if (!larg) continue;
      partes.push({ itemId: p.itemId, papel: "piso", acabamento: p.acabamento, pos: [0, nivel + esp2! / 2, esp / 2 + larg / 2 + 0.05], tam: [comp, esp2!, larg] });
      nivel += esp2!; profundidade = Math.max(profundidade, larg * 2);
    }
    for (const c of de("cobertura")) {
      const comp = c.comprimento ?? (parede ? L : 0);
      if (!comp || !altura) continue;
      const larg = c.quantidade / comp;
      partes.push({ itemId: c.itemId, papel: "cobertura", acabamento: "telha", pos: [0, topo + 0.25 + larg * 0.13, esp / 2 + larg / 2 - 0.3], tam: [comp, 0.04, larg], inclinacao: 15 });
      profundidade = Math.max(profundidade, larg * 2);
    }
    if (partes.length) locais.push({ nome: g.nome, comprimento: L, altura: topo, profundidade, partes });
  }
  return { locais, representados: [...new Set(locais.flatMap((l) => l.partes.map((p) => p.itemId)))] };
}

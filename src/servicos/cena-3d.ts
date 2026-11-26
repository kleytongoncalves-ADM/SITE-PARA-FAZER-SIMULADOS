/**
 * Monta a cena 3D do orçamento: para cada item, quais modelos aparecem e em que quantidade visível
 * (monte que cresce, pilha de peças, feixe de barras, kit em módulos, figura de equipe com anel de horas).
 * Função pura: recebe o orçamento já carregado e devolve dados prontos para o visualizador.
 */
import catalogoJson from "../dados/biblioteca-3d.json";
import { modeloDoInsumo, modeloDoServico, semFormaFisica, type TipoVinculo } from "./vinculo-3d";

export type ModeloCatalogo = {
  codigo: string; nome: string; classe: string; animacao: string; unidade: string;
  dimensoes: [number, number, number];
  conteudo: { valor: number; unidade: string };
  etapas?: string[]; funcao?: string;
  animado: boolean; video: boolean;
};

const CATALOGO = new Map((catalogoJson as ModeloCatalogo[]).map((m) => [m.codigo, m]));
export const modeloDoCatalogo = (codigo: string) => CATALOGO.get(codigo) ?? null;

export type Papel = "kit" | "material" | "mao_de_obra" | "equipamento";

export type Visual =
  | { tipo: "monte"; escala: number; volume: number }
  | { tipo: "pilha"; pecas: number; visiveis: number; arranjo: "pilha" | "feixe" | "rolos" | "chapas" }
  | { tipo: "kit"; modulos: number; visiveis: number }
  | { tipo: "figura"; horas: number; figuras: number; segmentos: number }
  | { tipo: "maquina"; horas: number };

export type Peca = {
  codigo: string; papel: Papel; nome: string;
  /** Descrição do insumo ou do serviço que trouxe o modelo. */
  origem: string;
  quantidade: number; unidade: string;
  visual: Visual;
  /** Texto curto que acompanha o modelo: "14 barras de 12 m", "0,53 m³", "16 h". */
  rotulo: string;
  custo: number | null;
  animado: boolean; video: boolean; animacao: string;
};

export type CenaItem = {
  itemId: string; numero: string; etapaId: string; etapa: string; etapaOrdem: number;
  descricao: string; quantidade: number; unidade: string; modo: "servico" | "material" | "cotacao";
  pecas: Peca[];
  semModelo: string[];
};

export type ItemEntrada = {
  id: string; numero: string; etapaId: string; modo: "servico" | "material" | "cotacao";
  descricao: string; unidade: string; quantidade: string;
};
export type InsumoEntrada = { descricao: string; unidade: string; tipo: TipoVinculo; coeficiente: string; preco: string | null };
export type EtapaEntrada = { id: string; ordem: number; nome: string; itens: ItemEntrada[] };

/** Limites do que se desenha no navegador. Acima deles, a cena mostra o teto e o rótulo traz o total. */
export const TETO = { pecaPequena: 240, pecaMedia: 60, equipamento: 6, kit: 4, figuras: 6, monteM3: 20 };
const HORAS_POR_ANEL = 24;

/** Unidade da base de preços para a forma escrita: M3 vira m³, KG vira kg. */
export function unidadeNormal(u: string): string {
  const t = u.trim().toUpperCase().replace("²", "2").replace("³", "3");
  const mapa: Record<string, string> = {
    M2: "m²", M3: "m³", M: "m", KG: "kg", L: "L", UN: "un", UND: "un", UNID: "un", PC: "un", PECA: "un", PCT: "un", CJ: "un", JG: "un", PAR: "un",
    H: "h", CHP: "h", CHI: "h", T: "t", SC: "saco", SACO: "saco", CENTO: "cento", MES: "mês", ROLO: "rolo", LATA: "un", GL: "un", KIT: "un",
  };
  return mapa[t] ?? u.trim().toLowerCase();
}

const fmt = (v: number, casas = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });

/** Converte a quantidade do orçamento para a unidade do conteúdo de uma peça. null quando não há conversão segura. */
export function converter(qtd: number, de: string, para: string, m: ModeloCatalogo): number | null {
  if (de === para) return qtd;
  const par = `${de}>${para}`;
  if (par === "m³>L") return qtd * 1000;
  if (par === "L>m³") return qtd / 1000;
  if (par === "t>kg") return qtd * 1000;
  if (par === "kg>t") return qtd / 1000;
  // Massa de granel: densidades médias aparentes.
  if (de === "t" && para === "m³") return qtd / (/PAV-ASF/.test(m.codigo) ? 2.4 : 1.6);
  if (de === "kg" && para === "m³") return qtd / 1600;
  // Saco, lata ou balde contados na unidade do próprio recipiente.
  if (["saco", "un", "rolo"].includes(de) && ["kg", "L", "m", "m²"].includes(para)) return qtd * m.conteudo.valor;
  if (de === "cento" && para === "un") return qtd * 100;
  return null;
}

const ARRANJO: Record<string, "pilha" | "feixe" | "rolos" | "chapas"> = { C: "pilha", D: "feixe", E: "rolos", F: "chapas", B: "pilha", H: "pilha" };

function nomePeca(m: ModeloCatalogo, n: number): string {
  const um = n === 1;
  const t = m.nome.toLowerCase();
  if (m.animacao === "D" && /vergalh|fio ca/.test(t)) return um ? "barra de 12 m" : "barras de 12 m";
  if (/\bsaco\b/.test(t)) return um ? "saco" : "sacos";
  if (/\bcaixa\b/.test(t)) return um ? "caixa" : "caixas";
  if (/\blata\b/.test(t)) return um ? "lata" : "latas";
  if (/\bbalde\b/.test(t)) return um ? "balde" : "baldes";
  if (/\bgalão\b/.test(t)) return um ? "galão" : "galões";
  if (/\bbombona\b/.test(t)) return um ? "bombona" : "bombonas";
  if (/\btambor\b/.test(t)) return um ? "tambor" : "tambores";
  if (/\bbobina\b/.test(t)) return um ? "bobina" : "bobinas";
  if (/\brolo\b/.test(t)) return um ? "rolo" : "rolos";
  if (/\bbarra\b|\bpeça \d/.test(t)) return um ? "barra" : "barras";
  if (/\bpainel\b/.test(t)) return um ? "painel" : "painéis";
  if (/\bchapa\b|\bplaca\b/.test(t)) return um ? "chapa" : "chapas";
  if (/\btelha\b/.test(t)) return um ? "telha" : "telhas";
  return um ? "peça" : "peças";
}

/** Quanto aparece na cena para uma quantidade do orçamento. */
export function visualDe(m: ModeloCatalogo, qtd: number, unidade: string): { visual: Visual; rotulo: string } {
  const u = unidadeNormal(unidade);
  if (m.codigo.startsWith("MDO-")) {
    const horas = u === "mês" ? qtd * 220 : qtd;
    const figuras = Math.max(1, Math.min(TETO.figuras, Math.ceil(horas / HORAS_POR_ANEL)));
    const resto = horas - HORAS_POR_ANEL * (figuras - 1);
    const segmentos = horas > HORAS_POR_ANEL * TETO.figuras ? HORAS_POR_ANEL : Math.max(1, Math.min(HORAS_POR_ANEL, Math.round(resto)));
    return { visual: { tipo: "figura", horas, figuras, segmentos }, rotulo: `${fmt(horas, 1)} h` };
  }
  if (m.animacao === "H" && (u === "h" || m.classe === "equipamento")) {
    return { visual: { tipo: "maquina", horas: qtd }, rotulo: u === "h" ? `${fmt(qtd, 1)} h` : `${fmt(qtd)} ${u}` };
  }
  const c = m.conteudo;
  if (m.classe === "kit" || m.animacao === "G") {
    const q = converter(qtd, u, c.unidade, m);
    const modulos = q == null || c.valor <= 0 ? 1 : q / c.valor;
    const visiveis = Math.max(1, Math.min(TETO.kit, Math.ceil(modulos - 1e-9)));
    return { visual: { tipo: "kit", modulos, visiveis }, rotulo: `${fmt(qtd)} ${u}` };
  }
  if (m.classe === "granel" && c.unidade === "m³") {
    const v = converter(qtd, u, "m³", m);
    const volume = v ?? c.valor;
    const escala = Math.cbrt(Math.max(Math.min(volume, TETO.monteM3), c.valor * 0.15) / c.valor);
    return { visual: { tipo: "monte", escala, volume }, rotulo: v == null ? `${fmt(qtd)} ${u}` : `${fmt(volume)} m³` };
  }
  const q = converter(qtd, u, c.unidade, m);
  const pecas = q == null ? 1 : Math.max(1, Math.ceil(q / c.valor - 1e-9));
  const teto = m.classe === "peca_pequena" ? TETO.pecaPequena : m.classe === "equipamento" ? TETO.equipamento : TETO.pecaMedia;
  const visiveis = Math.min(pecas, teto);
  const rotulo = q == null ? `${fmt(qtd)} ${u}` : `${fmt(pecas, 0)} ${nomePeca(m, pecas)}`;
  return { visual: { tipo: "pilha", pecas, visiveis, arranjo: ARRANJO[m.animacao] ?? "pilha" }, rotulo };
}

function peca(m: ModeloCatalogo, papel: Papel, origem: string, qtd: number, unidade: string, custo: number | null): Peca {
  const { visual, rotulo } = visualDe(m, qtd, unidade);
  return {
    codigo: m.codigo, papel, nome: m.nome, origem, quantidade: qtd, unidade: unidadeNormal(unidade),
    visual, rotulo, custo, animado: m.animado, video: m.video, animacao: m.animacao,
  };
}

const PAPEL_DO_TIPO: Record<string, Papel> = { material: "material", mao_de_obra: "mao_de_obra", equipamento: "equipamento", servico: "material", taxa: "material" };

/** Cena de um item: kit do serviço, materiais, equipe e equipamentos. */
export function cenaDoItem(item: ItemEntrada, etapa: { id: string; ordem: number; nome: string }, insumos: InsumoEntrada[]): CenaItem {
  const qtd = Number(item.quantidade) || 0;
  const pecas: Peca[] = [];
  const semModelo: string[] = [];

  if (item.modo === "servico") {
    const kit = modeloDoServico(item.descricao);
    const mk = kit ? modeloDoCatalogo(kit) : null;
    if (mk) pecas.push(peca(mk, "kit", item.descricao, qtd, item.unidade, null));
  }

  // Insumos somados por modelo: dois insumos que caem no mesmo modelo viram uma só pilha.
  const porModelo = new Map<string, { m: ModeloCatalogo; papel: Papel; origem: string; qtd: number; unidade: string; custo: number | null }>();
  const lista: InsumoEntrada[] = insumos.length ? insumos : item.modo !== "servico"
    ? [{ descricao: item.descricao, unidade: item.unidade, tipo: "material", coeficiente: "1", preco: null }] : [];
  for (const i of lista) {
    const codigo = modeloDoInsumo(i.descricao, i.tipo);
    const m = codigo ? modeloDoCatalogo(codigo) : null;
    if (!m) { if (!semFormaFisica(i.descricao, i.tipo)) semModelo.push(i.descricao); continue; }
    const q = Number(i.coeficiente) * qtd;
    if (!(q > 0)) continue;
    const custo = i.preco != null ? Number(i.preco) * q : null;
    const chave = `${m.codigo}|${unidadeNormal(i.unidade)}`;
    const atual = porModelo.get(chave);
    if (atual) { atual.qtd += q; atual.custo = atual.custo != null && custo != null ? atual.custo + custo : atual.custo ?? custo; }
    else porModelo.set(chave, { m, papel: PAPEL_DO_TIPO[i.tipo] ?? "material", origem: i.descricao, qtd: q, unidade: i.unidade, custo });
  }
  for (const p of porModelo.values()) pecas.push(peca(p.m, p.papel, p.origem, p.qtd, p.unidade, p.custo));

  const ordem: Record<Papel, number> = { kit: 0, material: 1, equipamento: 2, mao_de_obra: 3 };
  pecas.sort((a, b) => ordem[a.papel] - ordem[b.papel]);
  return {
    itemId: item.id, numero: item.numero, etapaId: etapa.id, etapa: etapa.nome, etapaOrdem: etapa.ordem,
    descricao: item.descricao, quantidade: qtd, unidade: unidadeNormal(item.unidade), modo: item.modo,
    pecas, semModelo,
  };
}

export function montarCena(etapas: EtapaEntrada[], insumosPorItem: Map<string, InsumoEntrada[]>): CenaItem[] {
  return etapas.flatMap((e) => e.itens.map((i) => cenaDoItem(i, e, insumosPorItem.get(i.id) ?? [])));
}

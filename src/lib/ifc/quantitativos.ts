/**
 * Quantitativos de um arquivo IFC, agrupados por classe, tipo e material.
 *
 * As quantidades vêm, nesta ordem:
 *  1. das quantidades gravadas no próprio arquivo (IfcElementQuantity, como "BaseQuantities"
 *     ou "Qto_WallBaseQuantities"), convertidas para m, m², m³ e kg pelas unidades do projeto;
 *  2. da geometria, quando o elemento não traz a quantidade: volume do sólido, área lateral
 *     das paredes, área da face de cima de lajes, coberturas, revestimentos e ambientes, e o
 *     maior lado para vigas, pilares, barras e tubos. Essas ficam marcadas como calculadas.
 *
 * Funciona no navegador e no Node: recebe a instância do web-ifc já iniciada.
 */
import type { IfcAPI } from "web-ifc";
import * as W from "web-ifc";

export type Medida = "comprimento" | "area" | "volume" | "peso";

export type GrupoIfc = {
  classe: string; rotulo: string; tipo: string; material: string | null; pavimentos: string[];
  elementos: number; comprimento: number | null; area: number | null; volume: number | null; peso: number | null;
  /** Medidas que vieram, em algum elemento do grupo, da geometria e não do arquivo. */
  calculadas: Medida[];
};

export type LeituraIfc = {
  schema: string; projeto: string | null; aplicativo: string | null; elementos: number; grupos: GrupoIfc[]; avisos: string[];
};

/** Classes lidas, com o nome em português e a medida de área preferida. */
const CLASSES: [number, string, string, "lateral" | "topo" | null][] = [
  [W.IFCWALL, "IfcWall", "Parede", "lateral"],
  [W.IFCWALLSTANDARDCASE, "IfcWallStandardCase", "Parede", "lateral"],
  [W.IFCCURTAINWALL, "IfcCurtainWall", "Fachada cortina", "lateral"],
  [W.IFCSLAB, "IfcSlab", "Laje", "topo"],
  [W.IFCROOF, "IfcRoof", "Cobertura", "topo"],
  [W.IFCCOVERING, "IfcCovering", "Revestimento", "topo"],
  [W.IFCSPACE, "IfcSpace", "Ambiente", "topo"],
  [W.IFCCOLUMN, "IfcColumn", "Pilar", null],
  [W.IFCBEAM, "IfcBeam", "Viga", null],
  [W.IFCMEMBER, "IfcMember", "Barra estrutural", null],
  [W.IFCPLATE, "IfcPlate", "Chapa", "topo"],
  [W.IFCFOOTING, "IfcFooting", "Fundação", null],
  [W.IFCPILE, "IfcPile", "Estaca", null],
  [W.IFCDOOR, "IfcDoor", "Porta", null],
  [W.IFCWINDOW, "IfcWindow", "Janela", null],
  [W.IFCSTAIR, "IfcStair", "Escada", null],
  [W.IFCSTAIRFLIGHT, "IfcStairFlight", "Lance de escada", null],
  [W.IFCRAMP, "IfcRamp", "Rampa", "topo"],
  [W.IFCRAMPFLIGHT, "IfcRampFlight", "Lance de rampa", "topo"],
  [W.IFCRAILING, "IfcRailing", "Guarda-corpo", null],
  [W.IFCPIPESEGMENT, "IfcPipeSegment", "Tubo", null],
  [W.IFCPIPEFITTING, "IfcPipeFitting", "Conexão", null],
  [W.IFCDUCTSEGMENT, "IfcDuctSegment", "Duto", null],
  [W.IFCFLOWSEGMENT, "IfcFlowSegment", "Tubo", null],
  [W.IFCFLOWFITTING, "IfcFlowFitting", "Conexão", null],
  [W.IFCSANITARYTERMINAL, "IfcSanitaryTerminal", "Louça sanitária", null],
  [W.IFCFLOWTERMINAL, "IfcFlowTerminal", "Terminal hidráulico ou elétrico", null],
  [W.IFCFURNISHINGELEMENT, "IfcFurnishingElement", "Mobiliário", null],
  [W.IFCBUILDINGELEMENTPROXY, "IfcBuildingElementProxy", "Elemento genérico", null],
];
const LINEARES = new Set(["IfcColumn", "IfcBeam", "IfcMember", "IfcPile", "IfcRailing", "IfcPipeSegment", "IfcDuctSegment", "IfcFlowSegment"]);

const NOMES: Record<Medida, string[]> = {
  comprimento: ["netlength", "length", "grosslength", "comprimento"],
  area: [], // por classe, abaixo
  volume: ["netvolume", "grossvolume", "volume"],
  peso: ["netweight", "grossweight", "weight", "massa", "peso"],
};
const AREAS: Record<string, string[]> = {
  lateral: ["netsidearea", "grosssidearea", "netarea", "grossarea", "area"],
  topo: ["netfloorarea", "netarea", "grossfloorarea", "grossarea", "netsurfacearea", "area"],
  outro: ["area", "netarea", "grossarea", "netsurfacearea", "grosssurfacearea", "outersurfacearea"],
};

type Valor = { value?: unknown } | null | undefined;
const val = (x: Valor): unknown => (x && typeof x === "object" && "value" in x ? x.value : x);
const txt = (x: Valor) => { const v = val(x); return typeof v === "string" && v.trim() ? v.trim() : null; };
const ref = (x: Valor) => { const v = val(x); return typeof v === "number" ? v : null; };
const lista = (x: unknown): Valor[] => (Array.isArray(x) ? x : x == null ? [] : [x as Valor]);

const PREFIXOS: Record<string, number> = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 10, DECI: 0.1, CENTI: 0.01, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9 };

/** Fator para converter cada tipo de unidade do projeto para m, m², m³ e kg. */
function unidades(api: IfcAPI, m: number) {
  const f = { LENGTHUNIT: 1, AREAUNIT: 1, VOLUMEUNIT: 1, MASSUNIT: 1 };
  const ids = api.GetLineIDsWithType(m, W.IFCUNITASSIGNMENT);
  if (!ids.size()) return f;
  const ua = api.GetLine(m, ids.get(0));
  for (const u of lista(ua.Units)) {
    const id = ref(u);
    if (id == null) continue;
    const l = api.GetLine(m, id);
    const tipo = String(val(l.UnitType) ?? "") as keyof typeof f;
    if (!(tipo in f)) continue;
    if (l.type === W.IFCSIUNIT) {
      const p = PREFIXOS[String(val(l.Prefix) ?? "")] ?? 1;
      const base = String(val(l.Name) ?? "");
      f[tipo] = tipo === "AREAUNIT" ? p * p : tipo === "VOLUMEUNIT" ? p * p * p : base === "GRAM" ? p / 1000 : p;
    } else if (l.type === W.IFCCONVERSIONBASEDUNIT) {
      const fator = api.GetLine(m, ref(l.ConversionFactor) ?? -1);
      const numero = Number(val(val(fator?.ValueComponent) as Valor) ?? NaN);
      const sub = ref(fator?.UnitComponent) != null ? api.GetLine(m, ref(fator.UnitComponent)!) : null;
      const pSub = sub ? PREFIXOS[String(val(sub.Prefix) ?? "")] ?? 1 : 1;
      const k = tipo === "AREAUNIT" ? pSub * pSub : tipo === "VOLUMEUNIT" ? pSub ** 3 : String(val(sub?.Name) ?? "") === "GRAM" ? pSub / 1000 : pSub;
      if (Number.isFinite(numero) && numero > 0) f[tipo] = numero * k;
    }
  }
  return f;
}

type Elemento = {
  id: number; classe: string; rotulo: string; area: "lateral" | "topo" | null; tipo: string; material: string | null; pavimento: string | null;
  q: Partial<Record<Medida, number>>;
};

/**
 * `grupoDoElemento`, quando passado, recebe a ordem do grupo (a partir de 1) de cada elemento com
 * geometria visível, para montar o modelo 3D. Ambientes ficam de fora: são volumes de ar.
 */
export function extrairQuantitativos(api: IfcAPI, m: number, grupoDoElemento?: Map<number, number>): LeituraIfc {
  const avisos: string[] = [];
  const fator = unidades(api, m);
  const elementos = new Map<number, Elemento>();

  for (const [tipoIfc, classe, rotulo, area] of CLASSES) {
    const ids = api.GetLineIDsWithType(m, tipoIfc);
    for (let i = 0; i < ids.size(); i++) {
      const id = ids.get(i);
      if (elementos.has(id)) continue;
      const l = api.GetLine(m, id);
      elementos.set(id, { id, classe, rotulo, area, tipo: txt(l.ObjectType) ?? "", material: null, pavimento: null, q: {} });
    }
  }

  // Tipo (IfcRelDefinesByType), material, pavimento e quantidades, pelas relações.
  const porRelacao = (tipo: number, fn: (rel: Record<string, Valor>) => void) => {
    const ids = api.GetLineIDsWithType(m, tipo);
    for (let i = 0; i < ids.size(); i++) fn(api.GetLine(m, ids.get(i)));
  };
  const relacionados = (rel: Record<string, Valor>) => lista(val(rel.RelatedObjects) ?? rel.RelatedObjects).concat(lista(rel.RelatedElements as unknown))
    .map(ref).filter((x): x is number => x != null && elementos.has(x));

  porRelacao(W.IFCRELDEFINESBYTYPE, (rel) => {
    const t = ref(rel.RelatingType);
    const nome = t != null ? txt(api.GetLine(m, t).Name) : null;
    if (nome) for (const e of relacionados(rel)) elementos.get(e)!.tipo = nome;
  });
  porRelacao(W.IFCRELASSOCIATESMATERIAL, (rel) => {
    const nome = nomeDoMaterial(api, m, ref(rel.RelatingMaterial));
    if (nome) for (const e of relacionados(rel)) elementos.get(e)!.material = nome;
  });
  porRelacao(W.IFCRELCONTAINEDINSPATIALSTRUCTURE, (rel) => {
    const s = ref(rel.RelatingStructure);
    const nome = s != null ? txt(api.GetLine(m, s).Name) : null;
    for (const e of relacionados(rel)) elementos.get(e)!.pavimento = nome;
  });
  porRelacao(W.IFCRELAGGREGATES, (rel) => {
    // Ambientes ficam no pavimento por agregação.
    const s = ref(rel.RelatingObject);
    if (s == null) return;
    const pai = api.GetLine(m, s);
    if (pai.type !== W.IFCBUILDINGSTOREY) return;
    for (const e of relacionados(rel)) if (!elementos.get(e)!.pavimento) elementos.get(e)!.pavimento = txt(pai.Name);
  });
  porRelacao(W.IFCRELDEFINESBYPROPERTIES, (rel) => {
    const alvos = relacionados(rel);
    if (!alvos.length) return;
    const pd = api.GetLine(m, ref(rel.RelatingPropertyDefinition) ?? -1);
    if (!pd || pd.type !== W.IFCELEMENTQUANTITY) return;
    const valores = new Map<string, { medida: Medida | "area"; v: number }>();
    for (const qr of lista(pd.Quantities)) {
      const q = api.GetLine(m, ref(qr) ?? -1);
      if (!q) continue;
      const nome = (txt(q.Name) ?? "").toLowerCase().replace(/[\s_]/g, "");
      const [medida, bruto, f] =
        q.type === W.IFCQUANTITYLENGTH ? ["comprimento", val(q.LengthValue), fator.LENGTHUNIT] as const
          : q.type === W.IFCQUANTITYAREA ? ["area", val(q.AreaValue), fator.AREAUNIT] as const
            : q.type === W.IFCQUANTITYVOLUME ? ["volume", val(q.VolumeValue), fator.VOLUMEUNIT] as const
              : q.type === W.IFCQUANTITYWEIGHT ? ["peso", val(q.WeightValue), fator.MASSUNIT] as const : [null, null, 1] as const;
      if (!medida || typeof bruto !== "number" || !Number.isFinite(bruto) || bruto <= 0) continue;
      valores.set(nome, { medida, v: bruto * f });
    }
    for (const a of alvos) {
      const e = elementos.get(a)!;
      const escolher = (nomes: string[]) => { for (const n of nomes) { const x = valores.get(n); if (x) return x.v; } return undefined; };
      const c = escolher(e.classe === "IfcColumn" ? ["length", "netlength", "height"] : NOMES.comprimento);
      const ar = escolher(AREAS[e.area ?? "outro"]);
      const vo = escolher(NOMES.volume), pe = escolher(NOMES.peso);
      if (c != null && e.q.comprimento == null) e.q.comprimento = c;
      if (ar != null && e.q.area == null) e.q.area = ar;
      if (vo != null && e.q.volume == null) e.q.volume = vo;
      if (pe != null && e.q.peso == null) e.q.peso = pe;
    }
  });

  // Geometria para o que o arquivo não trouxe.
  const calculado = new Map<number, Set<Medida>>();
  const faltando = [...elementos.values()].filter((e) =>
    e.q.volume == null || (e.area && e.q.area == null) || (LINEARES.has(e.classe) && e.q.comprimento == null)).map((e) => e.id);
  if (faltando.length) {
    try {
      const geo = medirGeometria(api, m, faltando);
      for (const [id, g] of geo) {
        const e = elementos.get(id)!;
        const marcas = new Set<Medida>();
        if (e.q.volume == null && g.volume > 1e-9) { e.q.volume = g.volume; marcas.add("volume"); }
        if (e.area && e.q.area == null) {
          const a = e.area === "lateral" ? g.lateral / 2 : g.topo;
          if (a > 1e-6) { e.q.area = a; marcas.add("area"); }
        }
        if (LINEARES.has(e.classe) && e.q.comprimento == null && g.maiorLado > 1e-6) { e.q.comprimento = g.maiorLado; marcas.add("comprimento"); }
        if (marcas.size) calculado.set(id, marcas);
      }
    } catch (erro) {
      avisos.push(`Geometria não lida: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }

  // Agrupa por classe (rótulo), tipo e material.
  const grupos = new Map<string, GrupoIfc>();
  const chaveDe = (e: Elemento) => `${e.rotulo}|${e.tipo || "Sem tipo"}|${e.material ?? ""}`;
  for (const e of elementos.values()) {
    const tipo = e.tipo || "Sem tipo";
    const chave = chaveDe(e);
    let g = grupos.get(chave);
    if (!g) {
      g = { classe: e.classe, rotulo: e.rotulo, tipo, material: e.material, pavimentos: [], elementos: 0, comprimento: null, area: null, volume: null, peso: null, calculadas: [] };
      grupos.set(chave, g);
    }
    g.elementos += 1;
    if (e.pavimento && !g.pavimentos.includes(e.pavimento)) g.pavimentos.push(e.pavimento);
    for (const k of ["comprimento", "area", "volume", "peso"] as Medida[]) {
      const v = e.q[k];
      if (v != null) g[k] = (g[k] ?? 0) + v;
    }
    for (const k of calculado.get(e.id) ?? []) if (!g.calculadas.includes(k)) g.calculadas.push(k);
  }
  const ordem = CLASSES.map((c) => c[2]);
  const lidos = [...grupos.values()].map((g) => ({
    ...g,
    comprimento: arred(g.comprimento, 3), area: arred(g.area, 3), volume: arred(g.volume, 4), peso: arred(g.peso, 3),
  })).sort((a, b) => ordem.indexOf(a.rotulo) - ordem.indexOf(b.rotulo) || a.tipo.localeCompare(b.tipo, "pt-BR"));

  if (grupoDoElemento) {
    const ordemDe = new Map<string, number>();
    lidos.forEach((g, i) => ordemDe.set(`${g.rotulo}|${g.tipo}|${g.material ?? ""}`, i + 1));
    for (const e of elementos.values()) {
      const o = ordemDe.get(chaveDe(e));
      if (o != null && e.classe !== "IfcSpace") grupoDoElemento.set(e.id, o);
    }
  }

  if (!elementos.size) avisos.push("Nenhum elemento construtivo encontrado no arquivo.");
  return {
    schema: api.GetModelSchema(m) ?? "",
    projeto: nomeDoProjeto(api, m),
    aplicativo: aplicativo(api, m),
    elementos: elementos.size,
    grupos: lidos,
    avisos,
  };
}

const arred = (v: number | null, casas: number) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

function nomeDoMaterial(api: IfcAPI, m: number, id: number | null, profundidade = 0): string | null {
  if (id == null || profundidade > 4) return null;
  const l = api.GetLine(m, id);
  if (!l) return null;
  switch (l.type) {
    case W.IFCMATERIAL: return txt(l.Name);
    case W.IFCMATERIALLAYERSETUSAGE: return nomeDoMaterial(api, m, ref(l.ForLayerSet), profundidade + 1);
    case W.IFCMATERIALLAYERSET: {
      const nome = txt(l.LayerSetName);
      if (nome) return nome;
      const camadas = lista(l.MaterialLayers).map((c) => nomeDoMaterial(api, m, ref(c), profundidade + 1)).filter(Boolean);
      return camadas.length ? [...new Set(camadas)].join(" + ") : null;
    }
    case W.IFCMATERIALLAYER: return txt(l.Name) ?? nomeDoMaterial(api, m, ref(l.Material), profundidade + 1);
    case W.IFCMATERIALLIST: {
      const nomes = lista(l.Materials).map((c) => nomeDoMaterial(api, m, ref(c), profundidade + 1)).filter(Boolean);
      return nomes.length ? [...new Set(nomes)].join(" + ") : null;
    }
    case W.IFCMATERIALCONSTITUENTSET: {
      const nome = txt(l.Name);
      if (nome) return nome;
      const nomes = lista(l.MaterialConstituents).map((c) => nomeDoMaterial(api, m, ref(c), profundidade + 1)).filter(Boolean);
      return nomes.length ? [...new Set(nomes)].join(" + ") : null;
    }
    case W.IFCMATERIALCONSTITUENT: return txt(l.Name) ?? nomeDoMaterial(api, m, ref(l.Material), profundidade + 1);
    case W.IFCMATERIALPROFILESETUSAGE: return nomeDoMaterial(api, m, ref(l.ForProfileSet), profundidade + 1);
    case W.IFCMATERIALPROFILESET: {
      const nome = txt(l.Name);
      if (nome) return nome;
      const nomes = lista(l.MaterialProfiles).map((c) => nomeDoMaterial(api, m, ref(api.GetLine(m, ref(c) ?? -1)?.Material), profundidade + 1)).filter(Boolean);
      return nomes.length ? [...new Set(nomes)].join(" + ") : null;
    }
    default: return null;
  }
}

function nomeDoProjeto(api: IfcAPI, m: number) {
  const ids = api.GetLineIDsWithType(m, W.IFCPROJECT);
  if (!ids.size()) return null;
  const p = api.GetLine(m, ids.get(0));
  return txt(p.LongName) ?? txt(p.Name);
}

function aplicativo(api: IfcAPI, m: number) {
  try {
    const h = api.GetHeaderLine(m, W.FILE_NAME);
    const args = (h?.arguments ?? []) as Valor[];
    const original = txt(args[5]) ?? txt(args[6]);
    return original;
  } catch {
    return null;
  }
}

type Geo = { volume: number; lateral: number; topo: number; maiorLado: number };

/** Volume, área lateral, área de cima e maior lado de cada elemento, em metros (o web-ifc entrega com Y para cima). */
function medirGeometria(api: IfcAPI, m: number, ids: number[]): Map<number, Geo> {
  const saida = new Map<number, Geo>();
  // GetFlatMesh por elemento: o StreamMeshes do web-ifc 0.0.78 tem assinatura diferente no navegador.
  for (const id of ids) {
    let malha: ReturnType<IfcAPI["GetFlatMesh"]>;
    try { malha = api.GetFlatMesh(m, id); } catch { continue; }
    if (!malha || malha.geometries.size() === 0) { malha?.delete?.(); continue; }
    const g: Geo = saida.get(id) ?? { volume: 0, lateral: 0, topo: 0, maiorLado: 0 };
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < malha.geometries.size(); i++) {
      const pg = malha.geometries.get(i);
      const geo = api.GetGeometry(m, pg.geometryExpressID);
      const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
      const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
      const t = pg.flatTransformation;
      const p = (k: number) => {
        const x = v[k * 6], y = v[k * 6 + 1], z = v[k * 6 + 2];
        return [t[0] * x + t[4] * y + t[8] * z + t[12], t[1] * x + t[5] * y + t[9] * z + t[13], t[2] * x + t[6] * y + t[10] * z + t[14]];
      };
      for (let k = 0; k + 2 < ix.length; k += 3) {
        const a = p(ix[k]), b = p(ix[k + 1]), c = p(ix[k + 2]);
        for (const q of [a, b, c]) for (let d = 0; d < 3; d++) { if (q[d] < min[d]) min[d] = q[d]; if (q[d] > max[d]) max[d] = q[d]; }
        // Volume pelo teorema da divergência (tetraedros até a origem).
        g.volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const dobro = Math.hypot(n[0], n[1], n[2]);
        if (dobro < 1e-12) continue;
        const area = dobro / 2, ny = n[1] / dobro;
        if (Math.abs(ny) < 0.3) g.lateral += area;
        else if (ny > 0.5) g.topo += area;
      }
      geo.delete();
    }
    if (Number.isFinite(min[0])) g.maiorLado = Math.max(g.maiorLado, max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    saida.set(id, g);
    malha.delete?.();
  }
  for (const g of saida.values()) g.volume = Math.abs(g.volume);
  return saida;
}

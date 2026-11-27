/**
 * Quantitativos de projeto IFC no orçamento. O arquivo é lido no navegador (web-ifc) e só o
 * resultado chega aqui: cada grupo de elementos (classe, tipo e material) com comprimento,
 * área, volume, peso e número de elementos. Do grupo, a pessoa lança um ou mais itens no
 * orçamento (a mesma área de parede pode virar alvenaria, chapisco, reboco e pintura).
 */
import { comContexto, ErroDeRegra, type Contexto } from "../lib/db";
import { dec, lerNumeroBr, mul, texto } from "../lib/decimal";
import type { GrupoIfc, LeituraIfc, Medida } from "../lib/ifc/quantitativos";
import type { Ator } from "./obras";
import { adicionarComposicao, adicionarInsumo } from "./orcamentos";
import { exigir } from "./permissoes";

const ctx = (a: Ator): Contexto => ({ usuarioId: a.id, orgaoId: a.orgaoId });
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export type MedidaLancamento = Medida | "elementos";
/** Guardado quando o elemento não tem tipo no modelo; não aparece na tela. */
export const SEM_TIPO = "Sem tipo";

export const ROTULO_MEDIDA: Record<MedidaLancamento, string> = {
  comprimento: "Comprimento", area: "Área", volume: "Volume", peso: "Peso", elementos: "Elementos",
};
export const UNIDADE_MEDIDA: Record<MedidaLancamento, string> = { comprimento: "M", area: "M2", volume: "M3", peso: "KG", elementos: "UN" };

/** Medida que combina com a unidade do serviço ou do material, para vir escolhida. */
export function medidaDaUnidade(unidade: string): MedidaLancamento | null {
  const u = unidade.trim().toUpperCase().replace("²", "2").replace("³", "3");
  if (u === "M2") return "area";
  if (u === "M3") return "volume";
  if (u === "M") return "comprimento";
  if (u === "KG") return "peso";
  if (u === "T") return "peso";
  if (["UN", "UND", "PC", "PÇ", "CJ", "JG"].includes(u)) return "elementos";
  return null;
}

const LIMITE_GRUPOS = 3000;
const numeroOuNulo = (v: unknown, nome: string) => {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e12) throw new ErroDeRegra(`Valor inválido em ${nome}.`);
  return v;
};
const textoCurto = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

async function orcamentoEmRascunho(a: Ator, orcamentoId: string) {
  exigir(a, "orcamento.editar");
  if (!uuid(orcamentoId)) throw new ErroDeRegra("Orçamento não encontrado.");
  const r = await comContexto(ctx(a), (c) => c.query("select situacao from orcamento where id = $1", [orcamentoId]));
  if (!r.rows[0]) throw new ErroDeRegra("Orçamento não encontrado.");
  if (r.rows[0].situacao !== "rascunho") throw new ErroDeRegra("Orçamento aprovado não pode ser alterado. Crie uma nova versão.");
}

/** Guarda o resultado da leitura feita no navegador. Confere tudo, porque vem do cliente. */
export async function registrarLeituraIfc(a: Ator, orcamentoId: string, d: { arquivo: string; tamanho: number; leitura: LeituraIfc }): Promise<string> {
  await orcamentoEmRascunho(a, orcamentoId);
  const arquivo = textoCurto(d.arquivo, 200);
  if (!arquivo || !/\.ifc$/i.test(arquivo)) throw new ErroDeRegra("Envie um arquivo .ifc.");
  const l = d.leitura;
  if (!l || !Array.isArray(l.grupos)) throw new ErroDeRegra("Leitura inválida.");
  if (!l.grupos.length) throw new ErroDeRegra("O arquivo não tem elementos construtivos com quantidades.");
  if (l.grupos.length > LIMITE_GRUPOS) throw new ErroDeRegra("O arquivo tem grupos demais para uma leitura.");
  const grupos = l.grupos.map((g: GrupoIfc) => {
    const elementos = Number(g.elementos);
    if (!Number.isInteger(elementos) || elementos <= 0) throw new ErroDeRegra("Leitura inválida.");
    return {
      classe: textoCurto(g.classe, 60) ?? "IfcBuildingElementProxy", rotulo: textoCurto(g.rotulo, 60) ?? "Elemento", tipo: textoCurto(g.tipo) ?? SEM_TIPO,
      material: textoCurto(g.material), pavimentos: (Array.isArray(g.pavimentos) ? g.pavimentos : []).map((p) => textoCurto(p, 120)).filter(Boolean).slice(0, 50) as string[],
      elementos, comprimento: numeroOuNulo(g.comprimento, "comprimento"), area: numeroOuNulo(g.area, "área"),
      volume: numeroOuNulo(g.volume, "volume"), peso: numeroOuNulo(g.peso, "peso"),
      calculadas: (Array.isArray(g.calculadas) ? g.calculadas : []).filter((x) => ["comprimento", "area", "volume", "peso"].includes(x)),
    };
  });
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `insert into ifc_leitura (orgao_id, orcamento_id, arquivo, tamanho, schema_ifc, projeto, aplicativo, elementos, avisos, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [a.orgaoId, orcamentoId, arquivo, Math.max(0, Math.round(Number(d.tamanho) || 0)), textoCurto(l.schema, 30), textoCurto(l.projeto), textoCurto(l.aplicativo),
        Math.max(0, Math.round(Number(l.elementos) || 0)), JSON.stringify((Array.isArray(l.avisos) ? l.avisos : []).map((x) => textoCurto(x, 300)).filter(Boolean).slice(0, 20)), a.id],
    );
    const id = r.rows[0].id as string;
    await c.query(
      `insert into ifc_quantitativo (orgao_id, leitura_id, ordem, classe, rotulo, tipo, material, pavimentos, elementos, comprimento, area, volume, peso, calculadas)
       select $1, $2, x.ordem, x.classe, x.rotulo, x.tipo, x.material, coalesce(array(select jsonb_array_elements_text(x.pavimentos)), '{}'), x.elementos,
              x.comprimento, x.area, x.volume, x.peso, coalesce(array(select jsonb_array_elements_text(x.calculadas)), '{}')
         from jsonb_to_recordset($3::jsonb) as x(ordem int, classe text, rotulo text, tipo text, material text, pavimentos jsonb, elementos int,
              comprimento numeric, area numeric, volume numeric, peso numeric, calculadas jsonb)`,
      [a.orgaoId, id, JSON.stringify(grupos.map((g, i) => ({ ...g, ordem: i + 1 })))],
    );
    return id;
  });
}

export type ResumoLeituraIfc = {
  id: string; arquivo: string; tamanho: number; schema: string | null; projeto: string | null; aplicativo: string | null;
  elementos: number; grupos: number; lancamentos: number; criadoEm: Date; criadoPor: string | null;
};

export async function listarLeiturasIfc(a: Ator, orcamentoId: string): Promise<ResumoLeituraIfc[]> {
  exigir(a, "orcamento.ver");
  if (!uuid(orcamentoId)) return [];
  return comContexto(ctx(a), async (c) => (await c.query(
    `select l.id, l.arquivo, l.tamanho::float8 as tamanho, l.schema_ifc as schema, l.projeto, l.aplicativo, l.elementos, l.criado_em as "criadoEm", u.nome as "criadoPor",
            (select count(*)::int from ifc_quantitativo q where q.leitura_id = l.id) as grupos,
            (select count(*)::int from ifc_lancamento x join ifc_quantitativo q on q.id = x.quantitativo_id where q.leitura_id = l.id) as lancamentos
       from ifc_leitura l left join usuario u on u.id = l.criado_por
      where l.orcamento_id = $1 order by l.criado_em desc`, [orcamentoId])).rows);
}

export type LancamentoIfc = { id: string; itemId: string; codigo: string | null; descricao: string; unidade: string; quantidade: string; medida: MedidaLancamento; multiplicador: string };
export type QuantitativoIfc = Omit<GrupoIfc, "comprimento" | "area" | "volume" | "peso"> & {
  id: string; ordem: number; comprimento: string | null; area: string | null; volume: string | null; peso: string | null; lancamentos: LancamentoIfc[];
};
export type DetalheLeituraIfc = ResumoLeituraIfc & { orcamentoId: string; avisos: string[]; quantitativos: QuantitativoIfc[] };

export async function obterLeituraIfc(a: Ator, leituraId: string): Promise<DetalheLeituraIfc> {
  exigir(a, "orcamento.ver");
  if (!uuid(leituraId)) throw new ErroDeRegra("Leitura não encontrada.");
  return comContexto(ctx(a), async (c) => {
    const l = (await c.query(
      `select l.id, l.orcamento_id as "orcamentoId", l.arquivo, l.tamanho::float8 as tamanho, l.schema_ifc as schema, l.projeto, l.aplicativo, l.elementos, l.avisos,
              l.criado_em as "criadoEm", u.nome as "criadoPor"
         from ifc_leitura l left join usuario u on u.id = l.criado_por where l.id = $1`, [leituraId])).rows[0];
    if (!l) throw new ErroDeRegra("Leitura não encontrada.");
    const q = (await c.query(
      `select id, ordem, classe, rotulo, tipo, material, pavimentos, elementos, comprimento::text, area::text, volume::text, peso::text, calculadas
         from ifc_quantitativo where leitura_id = $1 order by ordem`, [leituraId])).rows as QuantitativoIfc[];
    const lanc = (await c.query(
      `select x.id, x.quantitativo_id as q, i.id as "itemId", i.codigo, i.descricao, i.unidade, i.quantidade::text, x.medida, x.multiplicador::text
         from ifc_lancamento x join ifc_quantitativo q on q.id = x.quantitativo_id join orcamento_item i on i.id = x.item_id
        where q.leitura_id = $1 order by x.criado_em`, [leituraId])).rows;
    for (const g of q) g.lancamentos = lanc.filter((x) => x.q === g.id).map((x) => { const { q: _, ...resto } = x; void _; return resto; });
    return { ...l, grupos: q.length, lancamentos: lanc.length, quantitativos: q };
  });
}

/** Quantidade do grupo na medida escolhida, já multiplicada. Texto com 4 casas. */
export function quantidadeDoGrupo(g: Pick<QuantitativoIfc, "comprimento" | "area" | "volume" | "peso" | "elementos">, medida: MedidaLancamento, multiplicador: string): string {
  const base = medida === "elementos" ? String(g.elementos) : g[medida];
  if (base == null || dec(base) <= 0n) throw new ErroDeRegra(`O grupo não tem ${ROTULO_MEDIDA[medida].toLowerCase()}.`);
  const f = lerNumeroBr(multiplicador || "1");
  if (f == null || f <= 0n) throw new ErroDeRegra("Informe um multiplicador maior que zero.");
  const v = mul(dec(base), f);
  if (v <= 0n) throw new ErroDeRegra("Quantidade resultante igual a zero.");
  return texto(v, 4);
}

const numBr = (v: string, casas: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });

export async function lancarQuantitativo(
  a: Ator, orcamentoId: string, quantitativoId: string,
  d: { tipo: "composicao" | "insumo"; refId: string; etapaId: string; medida: MedidaLancamento; multiplicador?: string; tipoBdi?: "obra" | "fornecimento" },
): Promise<string> {
  await orcamentoEmRascunho(a, orcamentoId);
  if (!uuid(quantitativoId)) throw new ErroDeRegra("Grupo não encontrado.");
  if (!(d.medida in ROTULO_MEDIDA)) throw new ErroDeRegra("Escolha a medida.");
  const g = await comContexto(ctx(a), async (c) => (await c.query(
    `select q.*, q.comprimento::text, q.area::text, q.volume::text, q.peso::text, l.arquivo, l.orcamento_id
       from ifc_quantitativo q join ifc_leitura l on l.id = q.leitura_id where q.id = $1`, [quantitativoId])).rows[0]);
  if (!g || g.orcamento_id !== orcamentoId) throw new ErroDeRegra("Grupo não encontrado.");
  const multiplicador = d.multiplicador?.trim() || "1";
  const quantidade = quantidadeDoGrupo(g, d.medida, multiplicador);
  const fator = lerNumeroBr(multiplicador)!;
  const base = d.medida === "elementos" ? `${g.elementos} elementos` : `${ROTULO_MEDIDA[d.medida].toLowerCase()} ${numBr(g[d.medida], 4)} ${({ comprimento: "m", area: "m²", volume: "m³", peso: "kg" } as const)[d.medida]}`;
  const memoria = [
    `IFC ${g.arquivo}: ${g.rotulo}${g.tipo !== SEM_TIPO ? ` · ${g.tipo}` : ""}${g.material ? ` · ${g.material}` : ""} (${g.elementos} ${g.elementos === 1 ? "elemento" : "elementos"})`,
    `${base}${fator !== dec(1) ? ` × ${numBr(texto(fator, 4), 4)}` : ""} = ${numBr(quantidade, 4)}`,
    g.calculadas.includes(d.medida) ? "Medida calculada pela geometria do modelo." : null,
  ].filter(Boolean).join("\n");
  const item = { etapaId: d.etapaId, quantidade: quantidade.replace(".", ","), memoria, tipoBdi: d.tipoBdi };
  const itemId = d.tipo === "insumo" ? await adicionarInsumo(a, orcamentoId, d.refId, item) : await adicionarComposicao(a, orcamentoId, d.refId, item);
  await comContexto(ctx(a), (c) => c.query(
    "insert into ifc_lancamento (orgao_id, quantitativo_id, item_id, medida, multiplicador, criado_por) values ($1,$2,$3,$4,$5,$6)",
    [a.orgaoId, quantitativoId, itemId, d.medida, texto(fator, 4), a.id]));
  return itemId;
}

export async function removerLeituraIfc(a: Ator, orcamentoId: string, leituraId: string) {
  await orcamentoEmRascunho(a, orcamentoId);
  if (!uuid(leituraId)) throw new ErroDeRegra("Leitura não encontrada.");
  await comContexto(ctx(a), (c) => c.query("delete from ifc_leitura where id = $1 and orcamento_id = $2", [leituraId, orcamentoId]));
}

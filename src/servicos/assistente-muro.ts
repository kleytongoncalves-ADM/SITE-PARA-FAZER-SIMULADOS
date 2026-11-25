/**
 * Assistente de muro: a partir do comprimento e da altura, calcula as quantidades de cada serviço
 * e sugere a composição da base do orçamento. O usuário revisa e lança por serviço ou por material.
 */
import { comContexto, ErroDeRegra } from "../lib/db";
import { ajustar, dec, div, lerNumeroBr, mul, texto, type Dec } from "../lib/decimal";
import { adicionarComposicao, adicionarEtapa, adicionarInsumo, obterOrcamento } from "./orcamentos";
import type { Ator } from "./obras";
import { buscarComposicoes, type ComposicaoComCusto } from "./precos";

export type ParametrosMuro = {
  comprimento: string; altura: string; vaoPilaretes: string; larguraSapata: string; alturaSapata: string;
  profundidadeVala: string; larguraVala: string; faces: "1" | "2";
};

export const PADRAO_MURO: ParametrosMuro = {
  comprimento: "10", altura: "2", vaoPilaretes: "2,5", larguraSapata: "0,30", alturaSapata: "0,15",
  profundidadeVala: "0,40", larguraVala: "0,40", faces: "2",
};

type Servico = { chave: string; nome: string; unidade: string; busca: string[] };
const SERVICOS: Servico[] = [
  { chave: "locacao", nome: "Locação da obra", unidade: "M", busca: ["locação gabarito", "locação"] },
  { chave: "escavacao", nome: "Escavação da vala", unidade: "M3", busca: ["escavação manual vala", "escavação manual"] },
  { chave: "sapata", nome: "Sapata corrida", unidade: "M3", busca: ["sapata corrida", "baldrame"] },
  { chave: "alvenaria", nome: "Alvenaria", unidade: "M2", busca: ["alvenaria vedação bloco cerâmico 9", "alvenaria vedação blocos cerâmicos", "alvenaria vedação"] },
  { chave: "pilarete", nome: "Pilaretes", unidade: "M", busca: ["pilarete", "pilar concreto armado"] },
  { chave: "cinta", nome: "Cinta de amarração", unidade: "M", busca: ["cinta amarração", "verga"] },
  { chave: "chapisco", nome: "Chapisco", unidade: "M2", busca: ["chapisco parede", "chapisco"] },
  { chave: "reboco", nome: "Reboco", unidade: "M2", busca: ["reboco", "emboço", "massa única"] },
  { chave: "pintura", nome: "Pintura", unidade: "M2", busca: ["pintura látex acrílica", "pintura látex"] },
];

export type LinhaMuro = {
  chave: string; nome: string; unidade: string; quantidade: string; memoria: string;
  opcoes: ComposicaoComCusto[]; escolhida: string | null;
};

const ler = (v: string, nome: string, min = 0) => {
  const x = lerNumeroBr(v);
  if (x == null || x <= dec(min)) throw new ErroDeRegra(`Informe ${nome}.`);
  return x;
};
const fmt = (v: Dec, casas = 2) => texto(v, casas).replace(".", ",");

/** Quantidades do muro. Pilaretes nas pontas e a cada vão; cinta no topo; revestimento nas faces. */
export function quantidadesMuro(p: ParametrosMuro) {
  const L = ler(p.comprimento, "o comprimento"), H = ler(p.altura, "a altura");
  const vao = ler(p.vaoPilaretes, "o vão entre pilaretes"), bs = ler(p.larguraSapata, "a largura da sapata"), hs = ler(p.alturaSapata, "a altura da sapata");
  const pv = ler(p.profundidadeVala, "a profundidade da vala"), lv = ler(p.larguraVala, "a largura da vala");
  const faces = p.faces === "1" ? 1n : 2n;
  const vaos = div(L, vao);
  const inteiro = vaos / 10n ** 12n;
  const nVaos = vaos % 10n ** 12n === 0n ? inteiro : inteiro + 1n;
  const pilaretes = nVaos + 1n;
  const secao = dec("0.15");
  const alvenaria = ajustar(mul(L, H) - mul(dec(pilaretes), mul(secao, H)) - mul(L, secao), 2, "arredondar");
  const revest = ajustar(mul(dec(faces), mul(L, H)), 2, "arredondar");
  const q: Record<string, [Dec, string]> = {
    locacao: [L, `${fmt(L)} m de comprimento`],
    escavacao: [ajustar(mul(mul(L, lv), pv), 3, "arredondar"), `${fmt(L)} x ${fmt(lv)} x ${fmt(pv)} m`],
    sapata: [ajustar(mul(mul(L, bs), hs), 3, "arredondar"), `${fmt(L)} x ${fmt(bs)} x ${fmt(hs)} m`],
    alvenaria: [alvenaria, `${fmt(L)} x ${fmt(H)} m, menos ${pilaretes} pilaretes e a cinta (0,15 m)`],
    pilarete: [mul(dec(pilaretes), H), `${pilaretes} pilaretes de ${fmt(H)} m`],
    cinta: [L, `${fmt(L)} m no topo do muro`],
    chapisco: [revest, `${faces} ${faces === 1n ? "face" : "faces"} de ${fmt(L)} x ${fmt(H)} m`],
    reboco: [revest, `${faces} ${faces === 1n ? "face" : "faces"} de ${fmt(L)} x ${fmt(H)} m`],
    pintura: [revest, `${faces} ${faces === 1n ? "face" : "faces"} de ${fmt(L)} x ${fmt(H)} m`],
  };
  return { pilaretes: Number(pilaretes), linhas: SERVICOS.map((s) => ({ ...s, quantidade: texto(q[s.chave][0], 3), memoria: q[s.chave][1] })) };
}

export async function sugerirMuro(a: Ator, orcamentoId: string, p: ParametrosMuro): Promise<LinhaMuro[]> {
  const o = await obterOrcamento(a, orcamentoId);
  const { linhas } = quantidadesMuro(p);
  const saida: LinhaMuro[] = [];
  for (const l of linhas) {
    let opcoes: ComposicaoComCusto[] = [];
    for (const termo of l.busca) {
      opcoes = (await buscarComposicoes(a, { tabelaId: o.tabelaId, busca: termo, limite: 6, regra: o.arredondamento }))
        .filter((k) => k.unidade.toUpperCase() === l.unidade && k.aprovada);
      if (opcoes.length) break;
    }
    saida.push({ chave: l.chave, nome: l.nome, unidade: l.unidade, quantidade: l.quantidade, memoria: l.memoria, opcoes, escolhida: opcoes[0]?.id ?? null });
  }
  return saida;
}

export type LancamentoMuro = { composicaoId: string; quantidade: string; memoria: string };

/**
 * Lança o muro numa etapa nova. Por serviço: uma linha por composição.
 * Por material: os insumos das composições somados, cada um como item, com a mão de obra pela produtividade.
 */
export async function lancarMuro(a: Ator, orcamentoId: string, d: { nomeEtapa: string; modo: "servico" | "material"; linhas: LancamentoMuro[] }) {
  const linhas = d.linhas.filter((l) => l.composicaoId);
  if (!linhas.length) throw new ErroDeRegra("Escolha ao menos um serviço.");
  const etapaId = await adicionarEtapa(a, orcamentoId, d.nomeEtapa || "Muro");
  if (d.modo === "servico") {
    for (const l of linhas) await adicionarComposicao(a, orcamentoId, l.composicaoId, { etapaId, quantidade: l.quantidade, memoria: l.memoria });
    return etapaId;
  }
  const o = await obterOrcamento(a, orcamentoId);
  const soma = new Map<string, { quantidade: Dec; memoria: string[] }>();
  await comContexto({ usuarioId: a.id, orgaoId: a.orgaoId }, async (c) => {
    for (const l of linhas) {
      const q = lerNumeroBr(l.quantidade);
      if (q == null || q <= 0n) continue;
      const r = await c.query(
        `select x.insumo_id, round(x.coeficiente, 7)::text as coef, k.descricao as servico
           from insumos_da_composicao($1, (select mes from tabela_preco where id = $2)) x, composicao k where k.id = $1`,
        [l.composicaoId, o.tabelaId]);
      for (const i of r.rows) {
        const atual = soma.get(i.insumo_id) ?? { quantidade: 0n, memoria: [] };
        atual.quantidade += mul(q, dec(i.coef));
        atual.memoria.push(`${texto(mul(q, dec(i.coef)), 4).replace(".", ",")} em ${i.servico.toLowerCase()}`);
        soma.set(i.insumo_id, atual);
      }
    }
  });
  for (const [insumoId, v] of soma) {
    const q = ajustar(v.quantidade, 4, "arredondar");
    if (q <= 0n) continue;
    await adicionarInsumo(a, orcamentoId, insumoId, { etapaId, quantidade: texto(q, 4), memoria: v.memoria.join("; ") });
  }
  return etapaId;
}

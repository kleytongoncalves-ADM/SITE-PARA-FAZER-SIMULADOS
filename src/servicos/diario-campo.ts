import { comContexto, ErroDeRegra } from "../lib/db";
import {
  CLIMAS, CONDICOES, ctxCampo, dataValida, exigirVer, FUNCOES_SUGERIDAS, hoje, inserirLinha, lerDiario, limpo, MOTIVOS, obraNoAcesso, obrasVisiveis,
  ROTULO_CLIMA, ROTULO_CONDICAO, ROTULO_MOTIVO, ROTULO_OCORRENCIA_DIARIO, uuid,
  type Clima, type Condicao, type LinhaDiario, type Motivo, type TipoOcorrenciaDiario,
} from "./campo";
import type { Ator } from "./obras";
import { exigir, pode, SemPermissao } from "./permissoes";

/**
 * Diário sem internet. O aparelho baixa as obras e as atividades antes de ir a
 * campo, guarda os lançamentos localmente e envia quando a conexão volta.
 * Cada lançamento tem uma chave gerada no aparelho: repetir o envio não duplica.
 */

// ---------------------------------------------------------------------------
// Dados levados para o campo
// ---------------------------------------------------------------------------
export type AtividadeCampo = { id: string; codigo: string; nome: string; avanco: number };
export type ObraParaCampo = {
  id: string; codigo: string; nome: string; situacao: string; municipio: string | null;
  atividades: AtividadeCampo[];
  diarios: { data: string; numero: number; situacao: "rascunho" | "assinado" }[];
};
export type DadosCampo = {
  usuario: { id: string; nome: string; orgao: string };
  preparadoEm: string; hoje: string; podeAssinar: boolean;
  obras: ObraParaCampo[];
  funcoes: string[];
  rotulos: { clima: Record<Clima, string>; condicao: Record<Condicao, string>; motivo: Record<Motivo, string>; ocorrencia: Record<TipoOcorrenciaDiario, string> };
};

/** Obras em campo do usuário, com as atividades do cronograma e os diários dos últimos 45 dias. */
export async function dadosParaCampo(a: Ator & { nome: string; orgaoNome: string }): Promise<DadosCampo> {
  exigir(a, "diario.lancar");
  return comContexto(ctxCampo(a), async (c) => {
    const v = obrasVisiveis(a, "o.id", 1);
    const obras = (await c.query(
      `select o.id, o.codigo, o.nome, o.situacao, o.municipio from obra o
        where o.situacao in ('em_execucao', 'paralisada') and ${v.sql} order by o.codigo`, v.params)).rows;
    const ids = obras.map((o) => o.id as string);
    const atividades = ids.length ? (await c.query(
      `select c.obra_id, a.id, a.codigo, a.nome,
              coalesce((select percentual from avanco x where x.atividade_id = a.id order by x.data desc, x.criado_em desc limit 1), 0)::float8 as avanco
         from atividade a join cronograma c on c.id = a.cronograma_id
        where c.obra_id = any($1::uuid[]) and c.situacao = 'linha_base' and a.duracao > 0
          and not exists (select 1 from atividade f where f.cronograma_id = a.cronograma_id and f.codigo like a.codigo || '.%')
        order by a.ordem`, [ids])).rows : [];
    const diarios = ids.length ? (await c.query(
      `select obra_id, to_char(data, 'YYYY-MM-DD') as data, numero, situacao from diario
        where obra_id = any($1::uuid[]) and data >= $2::date - 45 order by data desc`, [ids, hoje()])).rows : [];
    return {
      usuario: { id: a.id, nome: a.nome, orgao: a.orgaoNome },
      preparadoEm: new Date().toISOString(), hoje: hoje(), podeAssinar: pode(a, "diario.assinar"),
      obras: obras.map((o) => ({
        ...o,
        atividades: atividades.filter((x) => x.obra_id === o.id).map(({ id, codigo, nome, avanco }) => ({ id, codigo, nome, avanco })),
        diarios: diarios.filter((x) => x.obra_id === o.id).map(({ data, numero, situacao }) => ({ data, numero, situacao })),
      })),
      funcoes: FUNCOES_SUGERIDAS,
      rotulos: { clima: ROTULO_CLIMA, condicao: ROTULO_CONDICAO, motivo: ROTULO_MOTIVO, ocorrencia: ROTULO_OCORRENCIA_DIARIO },
    };
  });
}

// ---------------------------------------------------------------------------
// Lançamento enviado pelo aparelho
// ---------------------------------------------------------------------------
export type PacoteCampo = {
  chave: string; usuarioId: string; obraId: string; data: string; registradoEm: string;
  climaManha: Clima | null; climaTarde: Clima | null; condicao: Condicao | null; relato: string | null;
  linhas: LinhaDiario[]; assinar: boolean; comoComplemento: boolean;
};
export type ResultadoEnvio = {
  chave: string;
  situacao: "enviado" | "ja_enviado" | "conflito" | "recusado";
  diarioId?: string; numero?: number; assinado?: boolean; mensagem?: string;
};

export const MAX_LINHAS = 200;
const texto = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const numeroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);

/** Confere o formato do que chegou do aparelho. Devolve o pacote limpo ou a mensagem do problema. */
export function lerPacote(bruto: unknown): PacoteCampo | string {
  const p = (bruto ?? {}) as Record<string, unknown>;
  if (!uuid(p.chave as string)) return "Lançamento sem identificação.";
  if (!uuid(p.usuarioId as string)) return "Lançamento sem autor.";
  if (!uuid(p.obraId as string)) return "Lançamento sem obra.";
  if (!dataValida(p.data as string)) return "Lançamento sem data.";
  const registrado = new Date(String(p.registradoEm ?? ""));
  if (Number.isNaN(registrado.getTime())) return "Lançamento sem hora de registro.";
  const clima = (v: unknown) => (v == null || v === "" ? null : CLIMAS.includes(v as Clima) ? (v as Clima) : undefined);
  const climaManha = clima(p.climaManha), climaTarde = clima(p.climaTarde);
  if (climaManha === undefined || climaTarde === undefined) return "Clima inválido.";
  const condicao = p.condicao == null || p.condicao === "" ? null : CONDICOES.includes(p.condicao as Condicao) ? (p.condicao as Condicao) : undefined;
  if (condicao === undefined) return "Condição de trabalho inválida.";
  if (!Array.isArray(p.linhas)) return "Lançamento sem linhas.";
  if (p.linhas.length > MAX_LINHAS) return `Um lançamento aceita até ${MAX_LINHAS} linhas.`;
  const linhas: LinhaDiario[] = [];
  for (const b of p.linhas as Record<string, unknown>[]) {
    const tipo = b?.tipo;
    const inteiro = (v: unknown) => { const x = numeroOuNulo(v); return x == null ? 1 : Math.round(x); };
    if (tipo === "efetivo") linhas.push({ tipo, funcao: texto(b.funcao, 120), empresa: texto(b.empresa, 200) || null, quantidade: inteiro(b.quantidade) });
    else if (tipo === "equipamento") linhas.push({ tipo, descricao: texto(b.descricao, 200), quantidade: inteiro(b.quantidade), horas: numeroOuNulo(b.horas) });
    else if (tipo === "servico") linhas.push({ tipo, descricao: texto(b.descricao, 500), local: texto(b.local, 200) || null, atividadeId: uuid(b.atividadeId as string) ? (b.atividadeId as string) : null, avancoPct: numeroOuNulo(b.avancoPct) });
    else if (tipo === "ocorrencia") {
      const subtipo = b.subtipo as TipoOcorrenciaDiario;
      if (!["ocorrencia", "visita", "paralisacao"].includes(subtipo)) return "Tipo de ocorrência inválido.";
      linhas.push({ tipo, subtipo, descricao: texto(b.descricao, 2000), motivo: MOTIVOS.includes(b.motivo as Motivo) ? (b.motivo as string) : null, horas: numeroOuNulo(b.horas) });
    } else return "Linha de tipo desconhecido.";
  }
  if (linhas.some((l) => Number.isNaN((l as { horas?: number | null }).horas) || Number.isNaN((l as { avancoPct?: number | null }).avancoPct) || Number.isNaN((l as { quantidade?: number }).quantidade)))
    return "Número inválido em uma das linhas.";
  return {
    chave: (p.chave as string).toLowerCase(), usuarioId: p.usuarioId as string, obraId: p.obraId as string, data: p.data as string,
    registradoEm: registrado.toISOString(), climaManha, climaTarde, condicao, relato: limpo(texto(p.relato, 20000)),
    linhas, assinar: p.assinar === true, comoComplemento: p.comoComplemento === true,
  };
}

/** Junta o relato feito no aparelho ao que já está no diário, sem repetir. */
export function juntarRelato(atual: string | null, novo: string | null): string | null {
  const a = limpo(atual), n = limpo(novo);
  if (!n) return a;
  if (!a) return n;
  if (a.includes(n)) return a;
  return `${a}\n\n${n}`;
}

const dataHoraBr = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)).replace(",", "");

/** Texto do complemento quando o diário do dia já foi assinado. */
export function textoComplemento(p: PacoteCampo): string {
  const partes: string[] = [`Registrado em campo em ${dataHoraBr(p.registradoEm)}.`];
  if (p.climaManha || p.climaTarde) partes.push(`Clima: manhã ${ROTULO_CLIMA[p.climaManha ?? "bom"].toLowerCase()}, tarde ${ROTULO_CLIMA[p.climaTarde ?? "bom"].toLowerCase()}.`);
  if (p.condicao) partes.push(`Condição: ${ROTULO_CONDICAO[p.condicao].toLowerCase()}.`);
  if (p.relato) partes.push(p.relato);
  const ef = p.linhas.filter((l) => l.tipo === "efetivo");
  if (ef.length) partes.push(`Efetivo: ${ef.map((l) => `${l.quantidade} ${l.funcao}${l.empresa ? ` (${l.empresa})` : ""}`).join("; ")}.`);
  const eq = p.linhas.filter((l) => l.tipo === "equipamento");
  if (eq.length) partes.push(`Equipamentos: ${eq.map((l) => `${l.quantidade} ${l.descricao}${l.horas != null ? `, ${String(l.horas).replace(".", ",")} h` : ""}`).join("; ")}.`);
  for (const l of p.linhas) {
    if (l.tipo === "servico") partes.push(`Serviço: ${l.descricao}${l.local ? ` (${l.local})` : ""}${l.avancoPct != null ? `, avanço ${String(l.avancoPct).replace(".", ",")}%` : ""}.`);
    if (l.tipo === "ocorrencia") partes.push(`${ROTULO_OCORRENCIA_DIARIO[l.subtipo]}: ${l.descricao}${l.subtipo === "paralisacao" && l.motivo ? ` (${ROTULO_MOTIVO[l.motivo as Motivo].toLowerCase()}, ${String(l.horas ?? 0).replace(".", ",")} h)` : ""}.`);
  }
  return partes.join("\n");
}

const temConteudo = (p: PacoteCampo) => !!(p.relato || p.linhas.length || p.climaManha || p.climaTarde || p.condicao);

/**
 * Recebe um lançamento feito no aparelho. Tudo ou nada: se uma linha não passa
 * nas regras do diário, nada é gravado e o lançamento continua no aparelho.
 */
export async function receberPacote(a: Ator, p: PacoteCampo): Promise<ResultadoEnvio> {
  const recusado = (mensagem: string): ResultadoEnvio => ({ chave: p.chave, situacao: "recusado", mensagem });
  if (p.usuarioId !== a.id) return recusado("Lançado com outro login. Entre com a conta de quem lançou para enviar.");
  if (!pode(a, "diario.lancar")) return recusado("Seu perfil não lança diário.");
  if (!temConteudo(p)) return recusado("Lançamento vazio.");
  if (new Date(p.registradoEm).getTime() > Date.now() + 10 * 60_000) return recusado("A hora do aparelho está adiantada. Acerte o relógio e envie de novo.");
  try {
    return await comContexto(ctxCampo(a), async (c) => {
      // Dois envios da mesma chave ao mesmo tempo: o segundo espera o primeiro terminar.
      await c.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [p.chave]);
      const ja = (await c.query(
        "select e.diario_id, d.numero, d.situacao from diario_envio e join diario d on d.id = e.diario_id where e.id = $1", [p.chave])).rows[0];
      if (ja) return { chave: p.chave, situacao: "ja_enviado", diarioId: ja.diario_id, numero: ja.numero, assinado: ja.situacao === "assinado" } as ResultadoEnvio;

      await obraNoAcesso(c, a, p.obraId);
      const existente = (await c.query("select id from diario where obra_id = $1 and data = $2", [p.obraId, p.data])).rows[0];
      const id = existente ? (existente.id as string)
        : (await c.query("insert into diario (orgao_id, obra_id, data) values ($1, $2, $3) returning id", [a.orgaoId, p.obraId, p.data])).rows[0].id as string;
      const d = await lerDiario(c, a, id);
      let assinou = false;
      let aviso: string | undefined;

      if (d.situacao === "assinado") {
        if (!p.comoComplemento) {
          return { chave: p.chave, situacao: "conflito", diarioId: d.id, numero: d.numero, assinado: true,
            mensagem: `O diário nº ${d.numero} deste dia já foi assinado. O lançamento pode entrar como complemento.` } as ResultadoEnvio;
        }
        if (!pode(a, "diario.lancar") && !pode(a, "diario.visto")) throw new SemPermissao();
        await c.query("insert into diario_complemento (orgao_id, diario_id, texto) values ($1,$2,$3)", [a.orgaoId, d.id, textoComplemento(p)]);
      } else {
        if (p.climaManha || p.climaTarde || p.condicao || p.relato) {
          await c.query("update diario set clima_manha = $2, clima_tarde = $3, condicao = $4, relato = $5 where id = $1",
            [d.id, p.climaManha ?? d.climaManha, p.climaTarde ?? d.climaTarde, p.condicao ?? d.condicao, juntarRelato(d.relato, p.relato)]);
        }
        for (const l of p.linhas) await inserirLinha(c, a, d, l);
        if (p.assinar) {
          if (!pode(a, "diario.assinar")) aviso = "Enviado sem assinatura: seu perfil não assina o diário.";
          else {
            await c.query("savepoint assinar");
            try {
              await c.query("update diario set situacao = 'assinado' where id = $1", [d.id]);
              assinou = true;
            } catch (e) {
              await c.query("rollback to savepoint assinar");
              aviso = `Enviado sem assinatura: ${(e as Error).message}`;
            }
          }
        }
      }

      await c.query(
        `insert into diario_envio (id, orgao_id, obra_id, data, diario_id, usuario_id, registrado_em, linhas, assinou, como_complemento)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.chave, a.orgaoId, p.obraId, p.data, d.id, a.id, p.registradoEm, p.linhas.length, assinou, d.situacao === "assinado"]);
      return { chave: p.chave, situacao: "enviado", diarioId: d.id, numero: d.numero, assinado: assinou || d.situacao === "assinado", mensagem: aviso } as ResultadoEnvio;
    });
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return recusado(e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Registro no diário
// ---------------------------------------------------------------------------
export type EnvioDoDiario = { registradoEm: Date; recebidoEm: Date; por: string; linhas: number; assinou: boolean; comoComplemento: boolean };

/** Lançamentos feitos sem internet que entraram neste diário. */
export async function enviosDoDiario(a: Ator, diarioId: string): Promise<EnvioDoDiario[]> {
  exigirVer(a, "diario.ver");
  if (!uuid(diarioId)) return [];
  return comContexto(ctxCampo(a), async (c) => (await c.query(
    `select e.registrado_em as "registradoEm", e.recebido_em as "recebidoEm", u.nome as por, e.linhas, e.assinou, e.como_complemento as "comoComplemento"
       from diario_envio e join usuario u on u.id = e.usuario_id where e.diario_id = $1 order by e.recebido_em`, [diarioId])).rows);
}

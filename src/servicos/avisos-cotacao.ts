/**
 * Avisos da cotação: e-mail do convite, caixa de mensagens e WhatsApp do
 * fornecedor com cadastro, lembrete de prazo e aviso de proposta recebida.
 * Tudo roda depois da gravação: uma falha de envio nunca desfaz o convite.
 */
import type { PoolClient } from "pg";
import { comContexto, pool } from "../lib/db";
import { caminhoDoLink, tokenDoConvite } from "./cotacoes";
import {
  emailDeConvite, emailDeLembrete, emailDePropostaRecebida, enderecoDoSistema, enviarEmail, emailConfigurado,
  type DadosConviteEmail, type ResultadoEmail,
} from "./email";
import { avisarPorWhatsapp } from "./whatsapp";

const quando = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const numero = (n: number) => String(n).padStart(3, "0");

type ContaAviso = { id: string; cnpj: string; avisosEmail: boolean; avisosWhatsapp: boolean; whatsapp: string | null; autorizado: boolean; email: string | null };

async function contasPorCnpj(cnpjs: string[]): Promise<Map<string, ContaAviso>> {
  if (!cnpjs.length) return new Map();
  const r = await pool().query(
    `select c.id, c.cnpj, c.avisos_email as "avisosEmail", c.avisos_whatsapp as "avisosWhatsapp", c.whatsapp, c.whatsapp_autorizado_em is not null as autorizado,
            a.email
       from conta_fornecedor c left join acesso_fornecedor a on a.conta_id = c.id and a.ativo
      where c.cnpj = any($1::text[]) and c.ativa`, [cnpjs]);
  return new Map(r.rows.map((l) => [l.cnpj as string, l as ContaAviso]));
}

/** Liga o convite à conta da empresa, se ela já tem cadastro. Vale para o link e para o painel. */
export async function ligarConviteAConta(c: PoolClient, orgaoId: string, conviteId: string, empresaId: string, contaId: string) {
  await c.query("insert into convite_da_conta (convite_id, conta_id, orgao_id) values ($1,$2,$3) on conflict (convite_id) do nothing", [conviteId, contaId, orgaoId]);
  await c.query("update empresa set conta_fornecedor_id = $2 where id = $1 and conta_fornecedor_id is null", [empresaId, contaId]);
}

/**
 * Convites que acabaram de valer (no envio da solicitação ou com ela aberta):
 * quem já tem cadastro recebe a cotação no painel e na caixa de mensagens, e
 * o e-mail sai para o endereço do convite (ou o do acesso da empresa).
 * Devolve a situação do e-mail de cada convite.
 */
export async function avisarConvidados(orgaoId: string, conviteIds: string[]): Promise<Map<string, ResultadoEmail["situacao"] | null>> {
  const resultado = new Map<string, ResultadoEmail["situacao"] | null>();
  if (!conviteIds.length) return resultado;
  const convites = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
    `select cv.id, cv.serie, cv.email, cv.empresa_id as "empresaId", e.cnpj, e.razao_social as fornecedor, s.numero, s.titulo, s.prazo, s.situacao,
            g.nome as orgao, b.nome as obra, (select count(*)::int from solicitacao_material m where m.solicitacao_id = s.id) as itens
       from convite_cotacao cv join empresa e on e.id = cv.empresa_id join solicitacao_cotacao s on s.id = cv.solicitacao_id
       join orgao g on g.id = s.orgao_id join obra b on b.id = s.obra_id
      where cv.id = any($1::uuid[])`, [conviteIds])).rows);
  const contas = await contasPorCnpj([...new Set(convites.map((x) => x.cnpj as string))]);
  const base = enderecoDoSistema();

  for (const cv of convites) {
    if (cv.situacao !== "aberta") continue;
    const conta = contas.get(cv.cnpj);
    const link = `${base}${caminhoDoLink(tokenDoConvite(cv.id, cv.serie))}`;
    const dados: DadosConviteEmail = {
      orgao: cv.orgao, fornecedor: cv.fornecedor, numero: cv.numero, titulo: cv.titulo, obra: cv.obra, itens: cv.itens, prazo: quando(cv.prazo), link, temConta: !!conta,
    };
    if (conta) {
      await comContexto({ usuarioId: null, orgaoId }, async (c) => {
        await ligarConviteAConta(c, orgaoId, cv.id, cv.empresaId, conta.id);
        await c.query(
          "insert into mensagem_fornecedor (conta_id, orgao_id, convite_id, tipo, titulo, texto) values ($1,$2,$3,'nova',$4,$5)",
          [conta.id, orgaoId, cv.id, `Nova cotação de ${cv.orgao}`, `${cv.titulo} · ${cv.itens} ${cv.itens === 1 ? "item" : "itens"} · responder até ${dados.prazo}`]);
      });
      if (conta.avisosWhatsapp && conta.autorizado && conta.whatsapp)
        await avisarPorWhatsapp(conta.whatsapp, { orgao: cv.orgao, titulo: cv.titulo, prazo: dados.prazo, link });
    }
    const para = (cv.email as string | null) ?? (conta?.avisosEmail ? conta.email : null);
    if (!para) { resultado.set(cv.id, null); continue; }
    const m = emailDeConvite(dados);
    const r = await enviarEmail({ para, assunto: m.assunto, html: m.html, texto: m.texto });
    resultado.set(cv.id, r.situacao);
    await comContexto({ usuarioId: null, orgaoId }, (c) => c.query(
      "update convite_cotacao set email_situacao = $2, email_enviado_em = case when $2 = 'enviado' then now() else email_enviado_em end, email_erro = $3 where id = $1",
      [cv.id, r.situacao, r.situacao === "falhou" ? r.erro : null]));
  }
  return resultado;
}

/** Prorrogação, reabertura e cancelamento chegam na caixa de quem tem cadastro. Roda dentro da transação da mudança. */
export async function avisarMudanca(c: PoolClient, solicitacaoId: string, tipo: "prorrogacao" | "reabertura" | "cancelamento", titulo: string, texto: string) {
  await c.query(
    `insert into mensagem_fornecedor (conta_id, orgao_id, convite_id, tipo, titulo, texto)
     select d.conta_id, d.orgao_id, d.convite_id, $2, $3, $4 from convite_da_conta d
      where d.convite_id in (select id from convite_cotacao where solicitacao_id = $1)`, [solicitacaoId, tipo, titulo, texto]);
}

/** Aviso a quem criou e a quem enviou a solicitação de que chegou uma proposta. */
export async function avisarPropostaRecebida(orgaoId: string, solicitacaoId: string, fornecedor: string, versao: number) {
  if (!emailConfigurado()) return;
  const s = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
    `select s.numero, s.titulo, array_remove(array[s.criado_por, s.enviada_por], null) as pessoas from solicitacao_cotacao s where s.id = $1`, [solicitacaoId])).rows[0]);
  if (!s) return;
  const emails = (await pool().query("select distinct email from usuario where id = any($1::uuid[]) and ativo", [s.pessoas])).rows.map((l) => l.email as string);
  const m = emailDePropostaRecebida({ fornecedor, numero: s.numero, titulo: s.titulo, versao, link: `${enderecoDoSistema()}/cotacoes/${solicitacaoId}/fornecedores` });
  for (const para of emails) await enviarEmail({ para, assunto: m.assunto, html: m.html, texto: m.texto });
}

/**
 * Lembrete um dia antes do prazo para quem ainda não respondeu. Chamado de hora
 * em hora pela tarefa agendada. Cada convite recebe um lembrete só.
 */
export async function enviarLembretes(agora = new Date()) {
  const orgaos = (await pool().query("select id from orgao where ativo")).rows.map((l) => l.id as string);
  let enviados = 0;
  for (const orgaoId of orgaos) {
    const pendentes = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
      `select cv.id, cv.serie, cv.email, e.cnpj, e.razao_social as fornecedor, s.numero, s.titulo, s.prazo, g.nome as orgao, b.nome as obra,
              (select count(*)::int from solicitacao_material m where m.solicitacao_id = s.id) as itens
         from convite_cotacao cv join empresa e on e.id = cv.empresa_id join solicitacao_cotacao s on s.id = cv.solicitacao_id
         join orgao g on g.id = s.orgao_id join obra b on b.id = s.obra_id
        where s.situacao = 'aberta' and s.prazo > $1 and s.prazo <= $1::timestamptz + interval '24 hours'
          and cv.situacao in ('convidado', 'abriu') and cv.enviado_em is not null and cv.lembrete_em is null`, [agora])).rows);
    if (!pendentes.length) continue;
    const contas = await contasPorCnpj([...new Set(pendentes.map((x) => x.cnpj as string))]);
    for (const cv of pendentes) {
      const conta = contas.get(cv.cnpj);
      const dados: DadosConviteEmail = {
        orgao: cv.orgao, fornecedor: cv.fornecedor, numero: cv.numero, titulo: cv.titulo, obra: cv.obra, itens: cv.itens, prazo: quando(cv.prazo),
        link: `${enderecoDoSistema()}${caminhoDoLink(tokenDoConvite(cv.id, cv.serie))}`, temConta: !!conta,
      };
      await comContexto({ usuarioId: null, orgaoId }, async (c) => {
        await c.query("update convite_cotacao set lembrete_em = now() where id = $1", [cv.id]);
        if (conta) await c.query(
          "insert into mensagem_fornecedor (conta_id, orgao_id, convite_id, tipo, titulo, texto) values ($1,$2,$3,'lembrete',$4,$5)",
          [conta.id, orgaoId, cv.id, `A cotação nº ${numero(cv.numero)} termina em menos de 24 horas`, `${cv.titulo} · responder até ${dados.prazo}`]);
      });
      const para = (cv.email as string | null) ?? (conta?.avisosEmail ? conta.email : null);
      if (para) {
        const m = emailDeLembrete(dados);
        const r = await enviarEmail({ para, assunto: m.assunto, html: m.html, texto: m.texto });
        if (r.situacao === "enviado") enviados += 1;
      }
    }
  }
  return enviados;
}

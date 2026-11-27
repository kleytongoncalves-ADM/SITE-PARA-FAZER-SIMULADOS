/**
 * Área do fornecedor: a empresa cria a conta (uma por CNPJ em toda a plataforma),
 * entra com e-mail e senha e responde às cotações que recebeu de qualquer órgão.
 * A resposta usa as mesmas regras do link da cotação: o que muda é só o acesso.
 */
import { randomBytes, scryptSync } from "node:crypto";
import type { PoolClient } from "pg";
import { comContexto, conferirPapelDoBanco, ErroDeRegra, pool } from "../lib/db";
import { conferirSenha, gerarHashSenha, hashToken, validarSenhaNova } from "./auth";
import { ligarConviteAConta } from "./avisos-cotacao";
import { cnpjValido } from "./contratos";
import {
  acesso, declinarConvite, encerrarVencidas, enviarPropostaDoConvite, evento, paginaDoConvite, salvarRascunhoDoConvite, solicitacaoDoLinkAberto, tokenDoConvite,
  type DadosProposta, type SituacaoSolicitacao,
} from "./cotacoes";
import { DadosInvalidos } from "./obras";
import { createHash } from "node:crypto";
import { emailConfigurado, emailDeRedefinicao, enderecoDoSistema, enviarEmail } from "./email";

import { PAPEIS, type PapelFornecedor } from "./papeis-fornecedor";
export { DESCRICAO_PAPEL, PAPEIS, ROTULO_PAPEL, type PapelFornecedor } from "./papeis-fornecedor";
export type Fornecedor = {
  acessoId: string; contaId: string; nome: string; email: string; cnpj: string; razaoSocial: string; nomeFantasia: string | null;
  papel: PapelFornecedor; cargo: string | null;
};

const HORAS_SESSAO = 12;
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const soDigitos = (v: string) => v.replace(/\D/g, "");
const limpo = (v: string | null | undefined, max = 160) => { const t = (v ?? "").trim().slice(0, max); return t === "" ? null : t; };
const uuid = (v: string | null | undefined): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** j***@empresa.com.br */
export function mascararEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${u.slice(0, 1)}***@${d}`;
}

export class EmpresaJaCadastrada extends Error {
  constructor(public emailMascarado: string) {
    super("Esta empresa já tem cadastro.");
    this.name = "EmpresaJaCadastrada";
  }
}

const tentativas = new Map<string, { n: number; ate: number }>();
/** Freio contra cadastros em série vindos do mesmo endereço. */
function frearCadastro(rede: string | null) {
  const k = rede ?? "?";
  const t = tentativas.get(k);
  if (t && t.ate > Date.now() && t.n >= 10) throw new ErroDeRegra("Muitas tentativas. Aguarde alguns minutos.");
  tentativas.set(k, t && t.ate > Date.now() ? { n: t.n + 1, ate: t.ate } : { n: 1, ate: Date.now() + 15 * 60000 });
  if (tentativas.size > 5000) tentativas.clear();
}

async function novaSessao(acessoId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + HORAS_SESSAO * 3600 * 1000);
  await pool().query("insert into sessao_fornecedor (token_hash, acesso_id, expira_em) values ($1, $2, $3)", [hashToken(token), acessoId, expiraEm]);
  return { token, expiraEm };
}

const SQL_FORNECEDOR = `select a.id as "acessoId", c.id as "contaId", a.nome, a.email, c.cnpj, c.razao_social as "razaoSocial", c.nome_fantasia as "nomeFantasia", a.papel, a.cargo
  from acesso_fornecedor a join conta_fornecedor c on c.id = a.conta_id`;

// ---------------------------------------------------------------------------
// Cadastro, entrada e sessão
// ---------------------------------------------------------------------------
export type DadosCadastroFornecedor = {
  cnpj: string; razaoSocial: string; nomeFantasia?: string; telefone?: string; cidade?: string; uf?: string;
  nome: string; email: string; senha: string;
};

/** Situação de um CNPJ antes do cadastro: livre, ou já com acesso (e-mail mascarado). */
export async function situacaoDoCnpj(cnpj: string): Promise<{ livre: true } | { livre: false; email: string }> {
  const r = await pool().query(
    "select a.email from conta_fornecedor c left join acesso_fornecedor a on a.conta_id = c.id where c.cnpj = $1 order by a.papel = 'administrador' desc, a.criado_em limit 1", [soDigitos(cnpj)]);
  if (!r.rows[0]) return { livre: true };
  return { livre: false, email: mascararEmail(r.rows[0].email ?? "") };
}

export async function cadastrarFornecedor(d: DadosCadastroFornecedor, rede: string | null) {
  await conferirPapelDoBanco();
  const erros: Record<string, string> = {};
  const cnpj = soDigitos(d.cnpj);
  const uf = (d.uf ?? "").trim().toUpperCase();
  const email = d.email.trim().toLowerCase();
  if (!cnpjValido(cnpj)) erros.cnpj = "CNPJ inválido.";
  if (!d.razaoSocial.trim()) erros.razaoSocial = "Informe a razão social.";
  if (uf && !/^[A-Z]{2}$/.test(uf)) erros.uf = "UF com duas letras.";
  if (d.nome.trim().length < 2) erros.nome = "Informe o nome do responsável.";
  if (!EMAIL.test(email)) erros.email = "E-mail inválido.";
  const senha = validarSenhaNova(d.senha);
  if (senha) erros.senha = senha;
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  frearCadastro(rede);
  const situacao = await situacaoDoCnpj(cnpj);
  if (!situacao.livre) throw new EmpresaJaCadastrada(situacao.email);
  const c = await pool().connect();
  try {
    await c.query("begin");
    const conta = (await c.query(
      "insert into conta_fornecedor (cnpj, razao_social, nome_fantasia, telefone, cidade, uf) values ($1,$2,$3,$4,$5,$6) returning id",
      [cnpj, d.razaoSocial.trim().slice(0, 160), limpo(d.nomeFantasia), limpo(d.telefone, 40), limpo(d.cidade, 80), uf || null])).rows[0].id as string;
    const acessoId = (await c.query(
      "insert into acesso_fornecedor (conta_id, nome, email, senha_hash) values ($1,$2,$3,$4) returning id",
      [conta, d.nome.trim().slice(0, 120), email, gerarHashSenha(d.senha)])).rows[0].id as string;
    await c.query("commit");
    return novaSessao(acessoId);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    const x = e as { code?: string; constraint?: string };
    if (x?.code === "23505" && x.constraint === "acesso_fornecedor_email_unico") throw new DadosInvalidos({ email: "Este e-mail já é usado por outra empresa." });
    if (x?.code === "23505") throw new EmpresaJaCadastrada((await situacaoDoCnpj(cnpj).then((s) => (s.livre ? "" : s.email))) || "***");
    throw e;
  } finally {
    c.release();
  }
}

export type ResultadoEntradaFornecedor = { ok: true; token: string; expiraEm: Date } | { ok: false; motivo: "credenciais" | "bloqueado" | "inativo" };

export async function entrarFornecedor(email: string, senha: string): Promise<ResultadoEntradaFornecedor> {
  await conferirPapelDoBanco();
  const db = pool();
  const r = await db.query(
    `select a.id, a.senha_hash, a.ativo, c.ativa, a.tentativas_falhas, a.bloqueado_ate
       from acesso_fornecedor a join conta_fornecedor c on c.id = a.conta_id where lower(a.email) = lower($1)`, [email.trim()]);
  const u = r.rows[0];
  if (!u) {
    scryptSync(senha, "sal-fixo-para-tempo", 64);
    return { ok: false, motivo: "credenciais" };
  }
  if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) return { ok: false, motivo: "bloqueado" };
  if (!conferirSenha(senha, u.senha_hash)) {
    const n = u.tentativas_falhas + 1;
    const bloquear = n >= MAX_TENTATIVAS;
    await db.query(
      `update acesso_fornecedor set tentativas_falhas = $2, bloqueado_ate = case when $3 then now() + ($4 || ' minutes')::interval else bloqueado_ate end where id = $1`,
      [u.id, bloquear ? 0 : n, bloquear, String(MINUTOS_BLOQUEIO)]);
    return { ok: false, motivo: bloquear ? "bloqueado" : "credenciais" };
  }
  if (!u.ativo || !u.ativa) return { ok: false, motivo: "inativo" };
  await db.query("update acesso_fornecedor set tentativas_falhas = 0, bloqueado_ate = null where id = $1", [u.id]);
  return { ok: true, ...(await novaSessao(u.id)) };
}

export async function fornecedorDaSessao(token: string | undefined): Promise<Fornecedor | null> {
  if (!token) return null;
  const r = await pool().query(
    `${SQL_FORNECEDOR} join sessao_fornecedor s on s.acesso_id = a.id where s.token_hash = $1 and s.expira_em > now() and a.ativo and c.ativa`, [hashToken(token)]);
  return (r.rows[0] as Fornecedor) ?? null;
}

export async function sairFornecedor(token: string | undefined) {
  if (token) await pool().query("delete from sessao_fornecedor where token_hash = $1", [hashToken(token)]);
}

// ---------------------------------------------------------------------------
// Chegada pelo convite e pelo link compartilhado
// ---------------------------------------------------------------------------
export type Chegada =
  | { tipo: "cotacao"; conviteId: string }
  | { tipo: "outra_empresa"; cnpjFinal: string }
  | { tipo: "indisponivel"; situacao: SituacaoSolicitacao | "invalido" };

/** Convite individual (o link do e-mail): só a empresa convidada pode abrir. */
export async function chegarPeloConvite(f: Fornecedor, token: string, rede: string | null): Promise<Chegada> {
  const ac = await acesso(token, rede);
  if (!ac || ac.revogado) return { tipo: "indisponivel", situacao: "invalido" };
  return comContexto({ usuarioId: null, orgaoId: ac.orgaoId }, async (c) => {
    const cv = (await c.query("select cv.empresa_id, e.cnpj from convite_cotacao cv join empresa e on e.id = cv.empresa_id where cv.id = $1", [ac.conviteId])).rows[0];
    if (!cv) return { tipo: "indisponivel", situacao: "invalido" } as const;
    if (cv.cnpj !== f.cnpj) return { tipo: "outra_empresa", cnpjFinal: (cv.cnpj as string).slice(-6) } as const;
    await ligarConviteAConta(c, ac.orgaoId, ac.conviteId, cv.empresa_id, f.contaId);
    return { tipo: "cotacao", conviteId: ac.conviteId } as const;
  });
}

/**
 * Link compartilhado: o CNPJ da conta é procurado no órgão. Se a empresa já
 * existe, usa a mesma; se já foi convidada, entra no mesmo convite; se não,
 * cria o fornecedor e o convite, marcado como vindo do link.
 */
export async function chegarPeloLinkAberto(f: Fornecedor, token: string, rede: string | null): Promise<Chegada> {
  const l = await solicitacaoDoLinkAberto(token, rede);
  if (!l || l.revogado) return { tipo: "indisponivel", situacao: "invalido" };
  await encerrarVencidas(l.orgaoId);
  return comContexto({ usuarioId: null, orgaoId: l.orgaoId }, async (c) => {
    const s = (await c.query("select situacao, prazo from solicitacao_cotacao where id = $1", [l.solicitacaoId])).rows[0];
    if (!s) return { tipo: "indisponivel", situacao: "invalido" } as const;
    const conta = (await c.query("select telefone from conta_fornecedor where id = $1", [f.contaId])).rows[0];
    let empresa = (await c.query("select id, ativa from empresa where cnpj = $1", [f.cnpj])).rows[0];
    const existente = empresa
      ? (await c.query("select id from convite_cotacao where solicitacao_id = $1 and empresa_id = $2", [l.solicitacaoId, empresa.id])).rows[0]
      : null;
    if (existente) {
      await ligarConviteAConta(c, l.orgaoId, existente.id, empresa.id, f.contaId);
      return { tipo: "cotacao", conviteId: existente.id } as const;
    }
    if (s.situacao !== "aberta") return { tipo: "indisponivel", situacao: s.situacao } as const;
    if (empresa && !empresa.ativa) throw new ErroDeRegra("Esta empresa não está habilitada para esta cotação. Fale com quem solicitou.");
    if (!empresa) {
      empresa = (await c.query(
        `insert into empresa (orgao_id, razao_social, cnpj, tipo, responsavel, email, telefone, conta_fornecedor_id)
         values ($1,$2,$3,'fornecedor',$4,$5,$6,$7) returning id, ativa`,
        [l.orgaoId, f.razaoSocial, f.cnpj, f.nome, f.email, conta?.telefone ?? null, f.contaId])).rows[0];
    }
    const conviteId = (await c.query(
      `insert into convite_cotacao (orgao_id, solicitacao_id, empresa_id, contato, email, telefone, enviado_em, origem, situacao, aberto_em)
       values ($1,$2,$3,$4,$5,$6,now(),'link','abriu',now()) returning id`,
      [l.orgaoId, l.solicitacaoId, empresa.id, f.nome, f.email, conta?.telefone ?? null])).rows[0].id as string;
    await c.query("insert into cotacao_link (token_hash, orgao_id, convite_id) values ($1,$2,$3)", [sha(tokenDoConvite(conviteId, 1)), l.orgaoId, conviteId]);
    await ligarConviteAConta(c, l.orgaoId, conviteId, empresa.id, f.contaId);
    await evento(c, l.orgaoId, l.solicitacaoId, "convite", `${f.razaoSocial} entrou pelo link compartilhado`, { conviteId, rede });
    return { tipo: "cotacao", conviteId } as const;
  });
}

// ---------------------------------------------------------------------------
// Cotações do fornecedor
// ---------------------------------------------------------------------------
export type EstadoNaArea = "pendente" | "rascunho" | "enviada" | "declinada" | "encerrada" | "cancelada";
export const ROTULO_ESTADO: Record<EstadoNaArea, string> = {
  pendente: "Pendente", rascunho: "Rascunho salvo", enviada: "Proposta enviada", declinada: "Declinada", encerrada: "Prazo encerrado", cancelada: "Cancelada",
};
export type CotacaoNaArea = {
  conviteId: string; orgao: string; obra: string; numero: number; titulo: string; prazo: Date; itens: number; estado: EstadoNaArea;
  versao: number | null; enviadaEm: Date | null; localEntrega: string | null; urgente: boolean;
};

async function vinculos(contaId: string) {
  const r = await pool().query("select convite_id, orgao_id from convite_da_conta where conta_id = $1", [contaId]);
  const porOrgao = new Map<string, string[]>();
  for (const l of r.rows) porOrgao.set(l.orgao_id, [...(porOrgao.get(l.orgao_id) ?? []), l.convite_id]);
  return porOrgao;
}

export async function cotacoesDoFornecedor(f: Fornecedor): Promise<CotacaoNaArea[]> {
  const lista: CotacaoNaArea[] = [];
  for (const [orgaoId, ids] of await vinculos(f.contaId)) {
    await encerrarVencidas(orgaoId);
    const linhas = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
      `select cv.id as "conviteId", g.nome as orgao, b.nome as obra, s.numero, s.titulo, s.prazo, s.situacao as sit, cv.situacao, cv.rascunho is not null as "temRascunho",
              s.local_entrega as "localEntrega",
              (select count(*)::int from solicitacao_material m where m.solicitacao_id = s.id) as itens,
              (select max(p.versao) from proposta p where p.convite_id = cv.id) as versao,
              (select max(p.enviada_em) from proposta p where p.convite_id = cv.id) as "enviadaEm"
         from convite_cotacao cv join solicitacao_cotacao s on s.id = cv.solicitacao_id join orgao g on g.id = s.orgao_id join obra b on b.id = s.obra_id
        where cv.id = any($1::uuid[]) and s.situacao <> 'rascunho'`, [ids])).rows);
    for (const l of linhas) {
      const estado: EstadoNaArea = l.sit === "cancelada" ? "cancelada" : l.situacao === "respondeu" ? "enviada" : l.situacao === "declinou" ? "declinada"
        : l.sit !== "aberta" ? "encerrada" : l.temRascunho ? "rascunho" : "pendente";
      lista.push({ conviteId: l.conviteId, orgao: l.orgao, obra: l.obra, numero: l.numero, titulo: l.titulo, prazo: l.prazo, itens: l.itens, estado,
        versao: l.versao, enviadaEm: l.enviadaEm, localEntrega: l.localEntrega,
        urgente: (estado === "pendente" || estado === "rascunho") && new Date(l.prazo).getTime() - Date.now() < 86400000 });
    }
  }
  const peso = (e: EstadoNaArea) => (e === "pendente" || e === "rascunho" ? 0 : 1);
  return lista.sort((a, b) => peso(a.estado) - peso(b.estado) || (peso(a.estado) === 0 ? +new Date(a.prazo) - +new Date(b.prazo) : +new Date(b.prazo) - +new Date(a.prazo)));
}

/** Órgão do convite, se ele é da conta. */
async function orgaoDoConvite(f: Fornecedor, conviteId: string) {
  if (!uuid(conviteId)) throw new ErroDeRegra("Cotação não encontrada.");
  const r = await pool().query("select orgao_id from convite_da_conta where convite_id = $1 and conta_id = $2", [conviteId, f.contaId]);
  if (!r.rows[0]) throw new ErroDeRegra("Cotação não encontrada.");
  return r.rows[0].orgao_id as string;
}

export async function cotacaoDoFornecedor(f: Fornecedor, conviteId: string, rede: string | null) {
  const orgaoId = await orgaoDoConvite(f, conviteId).catch(() => null);
  if (!orgaoId) return null;
  const p = await paginaDoConvite(orgaoId, conviteId, rede);
  if (!p) return null;
  await pool().query("update mensagem_fornecedor set lida_em = now() where conta_id = $1 and convite_id = $2 and lida_em is null", [f.contaId, conviteId]);
  return p;
}

/** Só quem responde cotações (ou o administrador) envia, salva ou declina. */
export const respondeCotacoes = (f: Fornecedor) => f.papel !== "consulta";
function exigirResposta(f: Fornecedor) {
  if (!respondeCotacoes(f)) throw new ErroDeRegra("Seu usuário é só de consulta. Peça ao administrador da empresa para mudar a permissão.");
}
function exigirAdministrador(f: Fornecedor) {
  if (f.papel !== "administrador") throw new ErroDeRegra("Só o administrador da empresa pode fazer isto.");
}

export async function salvarRascunhoNaArea(f: Fornecedor, conviteId: string, d: DadosProposta) {
  exigirResposta(f);
  await salvarRascunhoDoConvite(await orgaoDoConvite(f, conviteId), conviteId, d);
}

export async function enviarPropostaNaArea(f: Fornecedor, conviteId: string, d: DadosProposta, rede: string | null) {
  exigirResposta(f);
  // O CNPJ vem da conta: a empresa já se identificou no cadastro.
  return enviarPropostaDoConvite(await orgaoDoConvite(f, conviteId), conviteId, { ...d, cnpj: f.cnpj }, rede);
}

export async function declinarNaArea(f: Fornecedor, conviteId: string, motivo: string | null, rede: string | null) {
  exigirResposta(f);
  await declinarConvite(await orgaoDoConvite(f, conviteId), conviteId, motivo, rede);
}

// ---------------------------------------------------------------------------
// Caixa de mensagens
// ---------------------------------------------------------------------------
export type Mensagem = { id: string; tipo: string; titulo: string; texto: string; conviteId: string | null; lida: boolean; criadoEm: Date };

export async function mensagensDoFornecedor(f: Fornecedor): Promise<Mensagem[]> {
  return (await pool().query(
    `select id, tipo, titulo, texto, convite_id as "conviteId", lida_em is not null as lida, criado_em as "criadoEm"
       from mensagem_fornecedor where conta_id = $1 order by criado_em desc limit 200`, [f.contaId])).rows;
}

export async function naoLidas(f: Fornecedor): Promise<number> {
  return (await pool().query("select count(*)::int as n from mensagem_fornecedor where conta_id = $1 and lida_em is null", [f.contaId])).rows[0].n;
}

export async function marcarLidas(f: Fornecedor, id?: string) {
  if (id && !uuid(id)) return;
  await pool().query(`update mensagem_fornecedor set lida_em = now() where conta_id = $1 and lida_em is null ${id ? "and id = $2" : ""}`, id ? [f.contaId, id] : [f.contaId]);
}

// ---------------------------------------------------------------------------
// Minha empresa, avisos, senha e experiência declarada
// ---------------------------------------------------------------------------
export type Experiencia = { id: string; cliente: string; cidade: string | null; uf: string | null; servico: string; ano: number | null; quantidade: string | null };
export type Historico = { recebidas: number; respondidas: number; ganhas: number; entregas: number; noPrazo: number | null };
export type MinhaEmpresa = {
  cnpj: string; razaoSocial: string; nomeFantasia: string | null; telefone: string | null; cidade: string | null; uf: string | null;
  whatsapp: string | null; avisosEmail: boolean; avisosWhatsapp: boolean; whatsappAutorizado: boolean; desde: Date;
  nome: string; email: string; experiencias: Experiencia[]; historico: Historico;
};

export async function experienciasDaConta(contaId: string): Promise<Experiencia[]> {
  return (await pool().query(
    "select id, cliente, cidade, uf, servico, ano, quantidade from experiencia_fornecedor where conta_id = $1 order by ano desc nulls last, criado_em desc", [contaId])).rows;
}

/** Números do sistema em todos os órgãos: convites recebidos, respondidos, vencidos e entregas no prazo. */
export async function historicoDaConta(contaId: string): Promise<Historico> {
  const h: Historico = { recebidas: 0, respondidas: 0, ganhas: 0, entregas: 0, noPrazo: null };
  let noPrazo = 0;
  for (const [orgaoId, ids] of await vinculos(contaId)) {
    const r = await comContexto({ usuarioId: null, orgaoId }, async (c: PoolClient) => (await c.query(
      `select count(*) filter (where s.situacao <> 'rascunho')::int as recebidas,
              count(*) filter (where cv.situacao = 'respondeu')::int as respondidas,
              count(*) filter (where exists (
                select 1 from apuracao ap where ap.solicitacao_id = cv.solicitacao_id
                   and ap.numero = (select max(numero) from apuracao x where x.solicitacao_id = cv.solicitacao_id)
                   and (ap.escolhido_convite_id = cv.id or ap.resultado -> 'itens' @> jsonb_build_array(jsonb_build_object('conviteId', cv.id::text)))))::int as ganhas,
              (select count(*)::int from pedido p join recebimento rc on rc.pedido_id = p.id where p.empresa_id in (select empresa_id from convite_cotacao where id = any($1::uuid[]))) as entregas,
              (select count(*)::int from pedido p join recebimento rc on rc.pedido_id = p.id where rc.no_prazo and p.empresa_id in (select empresa_id from convite_cotacao where id = any($1::uuid[]))) as "noPrazo"
         from convite_cotacao cv join solicitacao_cotacao s on s.id = cv.solicitacao_id where cv.id = any($1::uuid[])`, [ids])).rows[0]);
    h.recebidas += r.recebidas; h.respondidas += r.respondidas; h.ganhas += r.ganhas; h.entregas += r.entregas; noPrazo += r.noPrazo;
  }
  h.noPrazo = h.entregas ? Math.round((noPrazo / h.entregas) * 100) : null;
  return h;
}

export async function minhaEmpresa(f: Fornecedor): Promise<MinhaEmpresa> {
  const c = (await pool().query(
    `select c.cnpj, c.razao_social as "razaoSocial", c.nome_fantasia as "nomeFantasia", c.telefone, c.cidade, c.uf, c.whatsapp,
            c.avisos_email as "avisosEmail", c.avisos_whatsapp as "avisosWhatsapp", c.whatsapp_autorizado_em is not null as "whatsappAutorizado", c.criado_em as desde
       from conta_fornecedor c where c.id = $1`, [f.contaId])).rows[0];
  return { ...c, nome: f.nome, email: f.email, experiencias: await experienciasDaConta(f.contaId), historico: await historicoDaConta(f.contaId) };
}

export async function salvarDadosDaEmpresa(f: Fornecedor, d: { razaoSocial: string; nomeFantasia?: string; telefone?: string; cidade?: string; uf?: string; nome: string; email: string }) {
  const erros: Record<string, string> = {};
  const uf = (d.uf ?? "").trim().toUpperCase();
  const email = d.email.trim().toLowerCase();
  if (!d.razaoSocial.trim()) erros.razaoSocial = "Informe a razão social.";
  if (uf && !/^[A-Z]{2}$/.test(uf)) erros.uf = "UF com duas letras.";
  if (d.nome.trim().length < 2) erros.nome = "Informe o nome do responsável.";
  if (!EMAIL.test(email)) erros.email = "E-mail inválido.";
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  if (f.papel === "administrador") await pool().query("update conta_fornecedor set razao_social = $2, nome_fantasia = $3, telefone = $4, cidade = $5, uf = $6, alterado_em = now() where id = $1",
    [f.contaId, d.razaoSocial.trim().slice(0, 160), limpo(d.nomeFantasia), limpo(d.telefone, 40), limpo(d.cidade, 80), uf || null]);
  await pool().query("update acesso_fornecedor set nome = $2, email = $3 where id = $1", [f.acessoId, d.nome.trim().slice(0, 120), email]).catch((e) => {
    if (e?.code === "23505") throw new DadosInvalidos({ email: "Este e-mail já é usado por outra empresa." });
    throw e;
  });
}

export async function salvarAvisos(f: Fornecedor, d: { avisosEmail: boolean; avisosWhatsapp: boolean; whatsapp?: string; autorizo: boolean }) {
  exigirAdministrador(f);
  const numero = soDigitos(d.whatsapp ?? "");
  if (d.avisosWhatsapp && (numero.length < 10 || numero.length > 13)) throw new ErroDeRegra("Informe o celular do WhatsApp com DDD.");
  if (d.avisosWhatsapp && !d.autorizo) throw new ErroDeRegra("Para receber avisos pelo WhatsApp, marque a autorização.");
  await pool().query(
    `update conta_fornecedor set avisos_email = $2, avisos_whatsapp = $3, whatsapp = $4,
            whatsapp_autorizado_em = case when $5 then coalesce(whatsapp_autorizado_em, now()) else null end, alterado_em = now() where id = $1`,
    [f.contaId, d.avisosEmail, d.avisosWhatsapp, numero || null, d.autorizo]);
}

export async function trocarSenhaFornecedor(f: Fornecedor, atual: string, nova: string) {
  const r = await pool().query("select senha_hash from acesso_fornecedor where id = $1", [f.acessoId]);
  if (!r.rows[0] || !conferirSenha(atual, r.rows[0].senha_hash)) throw new ErroDeRegra("A senha atual não confere.");
  const erro = validarSenhaNova(nova);
  if (erro) throw new ErroDeRegra(erro);
  await pool().query("update acesso_fornecedor set senha_hash = $2 where id = $1", [f.acessoId, gerarHashSenha(nova)]);
}

export async function adicionarExperiencia(f: Fornecedor, d: { cliente: string; cidade?: string; uf?: string; servico: string; ano?: string; quantidade?: string }) {
  exigirAdministrador(f);
  const uf = (d.uf ?? "").trim().toUpperCase();
  const ano = (d.ano ?? "").trim();
  if (!d.cliente.trim()) throw new ErroDeRegra("Informe o cliente ou órgão.");
  if (!d.servico.trim()) throw new ErroDeRegra("Informe o serviço ou fornecimento.");
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw new ErroDeRegra("UF com duas letras.");
  if (ano && (!/^\d{4}$/.test(ano) || Number(ano) < 1950 || Number(ano) > new Date().getFullYear())) throw new ErroDeRegra("Ano inválido.");
  const total = (await pool().query("select count(*)::int as n from experiencia_fornecedor where conta_id = $1", [f.contaId])).rows[0].n;
  if (total >= 50) throw new ErroDeRegra("Limite de 50 experiências.");
  await pool().query("insert into experiencia_fornecedor (conta_id, cliente, cidade, uf, servico, ano, quantidade) values ($1,$2,$3,$4,$5,$6,$7)",
    [f.contaId, d.cliente.trim().slice(0, 160), limpo(d.cidade, 80), uf || null, d.servico.trim().slice(0, 200), ano ? Number(ano) : null, limpo(d.quantidade, 80)]);
}

export async function removerExperiencia(f: Fornecedor, id: string) {
  exigirAdministrador(f);
  if (!uuid(id)) return;
  await pool().query("delete from experiencia_fornecedor where id = $1 and conta_id = $2", [id, f.contaId]);
}

/** Resumo do fornecedor com cadastro, para a lista de convidados do contratante. */
export async function resumoDaConta(contaId: string) {
  const c = (await pool().query("select criado_em as desde from conta_fornecedor where id = $1", [contaId])).rows[0];
  if (!c) return null;
  return { desde: c.desde as Date, historico: await historicoDaConta(contaId), experiencias: await experienciasDaConta(contaId) };
}

// ---------------------------------------------------------------------------
// Tela de entrada pelo convite: resumo da cotação e dados para o cadastro
// ---------------------------------------------------------------------------
export type ResumoConvite = {
  orgao: string; obra: string; numero: number; titulo: string; prazo: Date; situacao: SituacaoSolicitacao; localEntrega: string | null; itens: number;
};

/** Link individual do e-mail: resumo e a empresa convidada, para já vir preenchida no cadastro. */
export async function preparoDoConvite(token: string, rede: string | null) {
  const ac = await acesso(token, rede);
  if (!ac || ac.revogado) return null;
  return comContexto({ usuarioId: null, orgaoId: ac.orgaoId }, async (c) => {
    const r = (await c.query(
      `select cv.solicitacao_id, e.razao_social as "razaoSocial", e.cnpj, cv.email, cv.situacao,
              exists (select 1 from conta_fornecedor x where x.cnpj = e.cnpj) as "temConta"
         from convite_cotacao cv join empresa e on e.id = cv.empresa_id where cv.id = $1`, [ac.conviteId])).rows[0];
    if (!r) return null;
    const resumo = (await c.query(
      `select g.nome as orgao, b.nome as obra, s.numero, s.titulo, s.prazo, s.situacao, s.local_entrega as "localEntrega",
              (select count(*)::int from solicitacao_material m where m.solicitacao_id = s.id) as itens
         from solicitacao_cotacao s join orgao g on g.id = s.orgao_id join obra b on b.id = s.obra_id where s.id = $1`, [r.solicitacao_id])).rows[0] as ResumoConvite;
    if (resumo.situacao === "aberta" && r.situacao === "convidado") {
      await c.query("update convite_cotacao set situacao = 'abriu', aberto_em = now() where id = $1", [ac.conviteId]);
      await evento(c, ac.orgaoId, r.solicitacao_id, "acesso", `${r.razaoSocial} abriu o convite`, { conviteId: ac.conviteId, rede });
    }
    return { resumo, empresa: { razaoSocial: r.razaoSocial as string, cnpj: r.cnpj as string, email: (r.email as string | null) ?? "" }, temConta: r.temConta as boolean };
  });
}

/** Link compartilhado: só o resumo, a empresa se identifica no cadastro. */
export async function preparoDoLinkAberto(token: string, rede: string | null) {
  const l = await solicitacaoDoLinkAberto(token, rede);
  if (!l || l.revogado) return null;
  await encerrarVencidas(l.orgaoId);
  const resumo = await comContexto({ usuarioId: null, orgaoId: l.orgaoId }, async (c) => (await c.query(
    `select g.nome as orgao, b.nome as obra, s.numero, s.titulo, s.prazo, s.situacao, s.local_entrega as "localEntrega",
            (select count(*)::int from solicitacao_material m where m.solicitacao_id = s.id) as itens
       from solicitacao_cotacao s join orgao g on g.id = s.orgao_id join obra b on b.id = s.obra_id where s.id = $1`, [l.solicitacaoId])).rows[0] as ResumoConvite | undefined);
  return resumo ? { resumo } : null;
}

// ---------------------------------------------------------------------------
// Usuários da empresa fornecedora
// ---------------------------------------------------------------------------
export type UsuarioDaEmpresa = { id: string; nome: string; email: string; cargo: string | null; papel: PapelFornecedor; ativo: boolean; criadoEm: Date; voce: boolean };

export async function usuariosDaEmpresa(f: Fornecedor): Promise<UsuarioDaEmpresa[]> {
  return (await pool().query(
    `select id, nome, email, cargo, papel, ativo, criado_em as "criadoEm", id = $2 as voce from acesso_fornecedor where conta_id = $1
      order by ativo desc, papel = 'administrador' desc, nome`, [f.contaId, f.acessoId])).rows;
}

async function administradoresAtivos(contaId: string, exceto?: string) {
  return (await pool().query("select count(*)::int as n from acesso_fornecedor where conta_id = $1 and papel = 'administrador' and ativo and id is distinct from $2",
    [contaId, exceto ?? null])).rows[0].n as number;
}

export async function criarUsuarioDaEmpresa(f: Fornecedor, d: { nome: string; email: string; cargo?: string; papel: string; senha: string }) {
  exigirAdministrador(f);
  const erros: Record<string, string> = {};
  const email = d.email.trim().toLowerCase();
  if (d.nome.trim().length < 2) erros.nome = "Informe o nome.";
  if (!EMAIL.test(email)) erros.email = "E-mail inválido.";
  if (!PAPEIS.includes(d.papel as PapelFornecedor)) erros.papel = "Escolha a permissão.";
  const senha = validarSenhaNova(d.senha);
  if (senha) erros.senha = senha;
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  const total = (await pool().query("select count(*)::int as n from acesso_fornecedor where conta_id = $1", [f.contaId])).rows[0].n;
  if (total >= 30) throw new ErroDeRegra("Limite de 30 usuários por empresa.");
  await pool().query("insert into acesso_fornecedor (conta_id, nome, email, cargo, papel, senha_hash, criado_por) values ($1,$2,$3,$4,$5,$6,$7)",
    [f.contaId, d.nome.trim().slice(0, 120), email, limpo(d.cargo, 80), d.papel, gerarHashSenha(d.senha), f.acessoId]).catch((e) => {
    if (e?.code === "23505") throw new DadosInvalidos({ email: "Este e-mail já tem acesso na plataforma." });
    throw e;
  });
}

export async function alterarUsuarioDaEmpresa(f: Fornecedor, id: string, d: { cargo?: string; papel: string; ativo: boolean }) {
  exigirAdministrador(f);
  if (!uuid(id)) throw new ErroDeRegra("Usuário não encontrado.");
  if (!PAPEIS.includes(d.papel as PapelFornecedor)) throw new ErroDeRegra("Escolha a permissão.");
  const u = (await pool().query("select id from acesso_fornecedor where id = $1 and conta_id = $2", [id, f.contaId])).rows[0];
  if (!u) throw new ErroDeRegra("Usuário não encontrado.");
  if ((d.papel !== "administrador" || !d.ativo) && (await administradoresAtivos(f.contaId, id)) === 0)
    throw new ErroDeRegra("A empresa precisa de pelo menos um administrador ativo.");
  await pool().query("update acesso_fornecedor set cargo = $3, papel = $4, ativo = $5 where id = $1 and conta_id = $2", [id, f.contaId, limpo(d.cargo, 80), d.papel, d.ativo]);
  if (!d.ativo) await pool().query("delete from sessao_fornecedor where acesso_id = $1", [id]);
}

/** O administrador define uma senha nova para alguém da empresa (sem precisar de e-mail). */
export async function redefinirSenhaDoUsuario(f: Fornecedor, id: string, nova: string) {
  exigirAdministrador(f);
  const erro = validarSenhaNova(nova);
  if (erro) throw new ErroDeRegra(erro);
  const r = await pool().query("update acesso_fornecedor set senha_hash = $3, tentativas_falhas = 0, bloqueado_ate = null where id = $1 and conta_id = $2",
    [id, f.contaId, gerarHashSenha(nova)]);
  if (!r.rowCount) throw new ErroDeRegra("Usuário não encontrado.");
  await pool().query("delete from sessao_fornecedor where acesso_id = $1 and acesso_id <> $2", [id, f.acessoId]);
}

// ---------------------------------------------------------------------------
// Esqueci minha senha
// ---------------------------------------------------------------------------
export const recuperacaoPorEmail = () => emailConfigurado();

/**
 * Pede o link de nova senha. A resposta é sempre a mesma, exista ou não o
 * e-mail, para ninguém descobrir quem tem acesso.
 */
export async function pedirNovaSenha(email: string, rede: string | null) {
  frearCadastro(rede);
  if (!emailConfigurado()) return;
  const u = (await pool().query(
    "select a.id, a.nome from acesso_fornecedor a join conta_fornecedor c on c.id = a.conta_id where lower(a.email) = lower($1) and a.ativo and c.ativa", [email.trim()])).rows[0];
  if (!u) return;
  const recentes = (await pool().query("select count(*)::int as n from redefinicao_senha_fornecedor where acesso_id = $1 and criado_em > now() - interval '1 hour'", [u.id])).rows[0].n;
  if (recentes >= 3) return;
  const token = randomBytes(32).toString("base64url");
  await pool().query("insert into redefinicao_senha_fornecedor (token_hash, acesso_id, expira_em) values ($1,$2, now() + interval '1 hour')", [hashToken(token), u.id]);
  const m = emailDeRedefinicao({ nome: u.nome, link: `${enderecoDoSistema()}/fornecedor/nova-senha/${token}` });
  await enviarEmail({ para: email.trim(), assunto: m.assunto, html: m.html, texto: m.texto });
}

export async function linkDeSenhaValido(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return false;
  const r = await pool().query("select 1 from redefinicao_senha_fornecedor where token_hash = $1 and usada_em is null and expira_em > now()", [hashToken(token)]);
  return !!r.rows[0];
}

export async function criarNovaSenha(token: string, nova: string) {
  const erro = validarSenhaNova(nova);
  if (erro) throw new ErroDeRegra(erro);
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new ErroDeRegra("Link inválido ou vencido. Peça outro.");
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = (await c.query("update redefinicao_senha_fornecedor set usada_em = now() where token_hash = $1 and usada_em is null and expira_em > now() returning acesso_id",
      [hashToken(token)])).rows[0];
    if (!r) throw new ErroDeRegra("Link inválido ou vencido. Peça outro.");
    await c.query("update acesso_fornecedor set senha_hash = $2, tentativas_falhas = 0, bloqueado_ate = null where id = $1", [r.acesso_id, gerarHashSenha(nova)]);
    await c.query("delete from sessao_fornecedor where acesso_id = $1", [r.acesso_id]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Convite da conta numa solicitação (para ligar a conversa à página da cotação). */
export async function conviteDaContaNaSolicitacao(contaId: string, solicitacaoId: string): Promise<string | null> {
  if (!uuid(solicitacaoId)) return null;
  for (const [orgaoId, ids] of await vinculos(contaId)) {
    const r = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
      "select id from convite_cotacao where id = any($1::uuid[]) and solicitacao_id = $2", [ids, solicitacaoId])).rows[0]);
    if (r) return r.id as string;
  }
  return null;
}

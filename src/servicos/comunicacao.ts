/**
 * Comunicação entre contratante e fornecedor.
 *
 * - Manual (padrão): o sistema abre o e-mail ou o WhatsApp de quem está usando,
 *   com a mensagem pronta. Nada sai sem a pessoa enviar. A abertura fica no histórico.
 * - Automática (opcional, por órgão): e-mail pelo Resend, com o e-mail corporativo
 *   do órgão validado por código, e WhatsApp pela API oficial da Meta, com as
 *   credenciais do número corporativo. Cada envio fica no histórico.
 * - Chat interno: conversa entre o órgão e um fornecedor cadastrado, geral ou
 *   ligada a uma cotação. Só com empresas que têm cadastro na área do fornecedor.
 */
import { createHash, randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { comContexto, ErroDeRegra, pool } from "../lib/db";
import { emailConfigurado, emailDeCodigo, enviarEmail } from "./email";
import type { Fornecedor } from "./fornecedores";
import type { Ator } from "./obras";
import { exigir, pode } from "./permissoes";
import { cifrar, decifrar, enviarWhatsapp, numeroWhatsapp, type CredenciaisWhatsapp } from "./whatsapp";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuid = (v: string | null | undefined): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const ctx = (a: Ator) => ({ usuarioId: a.id, orgaoId: a.orgaoId });
const limpo = (v: string | null | undefined, max = 160) => { const t = (v ?? "").trim().slice(0, max); return t === "" ? null : t; };

// ---------------------------------------------------------------------------
// Configuração do órgão
// ---------------------------------------------------------------------------
export type ConfigComunicacao = {
  servicoEmail: boolean;
  emailAutomatico: boolean; emailCorporativo: string | null; emailNome: string | null; emailValidado: boolean; codigoPendente: boolean;
  whatsappAutomatico: boolean; whatsappNumeroId: string | null; whatsappModelo: string | null; whatsappComChave: boolean;
  alteradoEm: Date | null;
};

async function linhaConfig(c: PoolClient) {
  return (await c.query("select * from config_comunicacao where orgao_id = ctx_orgao()")).rows[0] ?? null;
}

export async function obterConfig(a: Ator): Promise<ConfigComunicacao> {
  exigir(a, "cotacao.ver");
  const l = await comContexto(ctx(a), linhaConfig);
  return {
    servicoEmail: emailConfigurado(),
    emailAutomatico: !!l?.email_automatico, emailCorporativo: l?.email_corporativo ?? null, emailNome: l?.email_nome ?? null,
    emailValidado: !!l?.email_validado_em, codigoPendente: !!l?.email_codigo_hash && !l?.email_validado_em && new Date(l.email_codigo_expira) > new Date(),
    whatsappAutomatico: !!l?.whatsapp_automatico, whatsappNumeroId: l?.whatsapp_numero_id ?? null, whatsappModelo: l?.whatsapp_modelo ?? null,
    whatsappComChave: !!l?.whatsapp_token_cifrado, alteradoEm: l?.alterado_em ?? null,
  };
}

async function gravarConfig(c: PoolClient, a: Ator, campos: Record<string, unknown>) {
  const ks = Object.keys(campos);
  await c.query(
    `insert into config_comunicacao (orgao_id, ${ks.join(", ")}, alterado_por, alterado_em) values ($1, ${ks.map((_, i) => `$${i + 3}`).join(", ")}, $2, now())
     on conflict (orgao_id) do update set ${ks.map((k) => `${k} = excluded.${k}`).join(", ")}, alterado_por = excluded.alterado_por, alterado_em = now()`,
    [a.orgaoId, a.id, ...ks.map((k) => campos[k])]);
}

/** Informa o e-mail corporativo e envia o código de validação para ele. */
export async function informarEmailCorporativo(a: Ator, d: { email: string; nome?: string }) {
  exigir(a, "usuario.gerenciar");
  const email = d.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ErroDeRegra("E-mail inválido.");
  if (!emailConfigurado()) throw new ErroDeRegra("O serviço de e-mail da plataforma ainda não está ligado. Veja o passo a passo do Resend.");
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const orgao = await comContexto(ctx(a), async (c) => {
    await gravarConfig(c, a, {
      email_corporativo: email, email_nome: limpo(d.nome, 80), email_validado_em: null, email_automatico: false,
      email_codigo_hash: sha(`${a.orgaoId}:${codigo}`), email_codigo_expira: new Date(Date.now() + 30 * 60000),
    });
    return (await c.query("select nome from orgao where id = $1", [a.orgaoId])).rows[0].nome as string;
  });
  const m = emailDeCodigo({ orgao, codigo });
  const r = await enviarEmail({ para: email, assunto: m.assunto, html: m.html, texto: m.texto });
  if (r.situacao !== "enviado") throw new ErroDeRegra(r.situacao === "falhou" ? `O código não foi enviado: ${r.erro}` : "O serviço de e-mail não está ligado.");
}

export async function validarCodigo(a: Ator, codigo: string) {
  exigir(a, "usuario.gerenciar");
  await comContexto(ctx(a), async (c) => {
    const l = await linhaConfig(c);
    if (!l?.email_codigo_hash) throw new ErroDeRegra("Peça um código primeiro.");
    if (new Date(l.email_codigo_expira) < new Date()) throw new ErroDeRegra("O código venceu. Peça outro.");
    if (sha(`${a.orgaoId}:${codigo.replace(/\D/g, "")}`) !== l.email_codigo_hash) throw new ErroDeRegra("Código incorreto.");
    await gravarConfig(c, a, { email_validado_em: new Date(), email_codigo_hash: null, email_codigo_expira: null });
  });
}

export async function ligarEmailAutomatico(a: Ator, ligado: boolean) {
  exigir(a, "usuario.gerenciar");
  await comContexto(ctx(a), async (c) => {
    const l = await linhaConfig(c);
    if (ligado && !l?.email_validado_em) throw new ErroDeRegra("Valide o e-mail corporativo antes de ligar o envio automático.");
    if (ligado && !emailConfigurado()) throw new ErroDeRegra("O serviço de e-mail da plataforma ainda não está ligado.");
    await gravarConfig(c, a, { email_automatico: ligado });
  });
}

export async function salvarWhatsapp(a: Ator, d: { numeroId: string; token?: string; modelo: string; ligado: boolean }) {
  exigir(a, "usuario.gerenciar");
  const numeroId = d.numeroId.replace(/\D/g, "");
  const modelo = d.modelo.trim();
  await comContexto(ctx(a), async (c) => {
    const l = await linhaConfig(c);
    const temChave = !!(d.token?.trim() || l?.whatsapp_token_cifrado);
    if (d.ligado && (!numeroId || !modelo || !temChave)) throw new ErroDeRegra("Para ligar, informe o identificador do número, a chave de acesso e o modelo aprovado.");
    if (modelo && !/^[a-z0-9_]{1,512}$/.test(modelo)) throw new ErroDeRegra("O nome do modelo usa letras minúsculas, números e _.");
    await gravarConfig(c, a, {
      whatsapp_numero_id: numeroId || null, whatsapp_modelo: modelo || null, whatsapp_automatico: d.ligado,
      ...(d.token?.trim() ? { whatsapp_token_cifrado: cifrar(d.token.trim()) } : {}),
    });
  });
}

export async function testarWhatsapp(a: Ator, numero: string) {
  exigir(a, "usuario.gerenciar");
  if (!numeroWhatsapp(numero)) throw new ErroDeRegra("Informe o celular com DDD.");
  const { cred, orgao } = await comContexto(ctx(a), async (c) => {
    const l = await linhaConfig(c);
    return { cred: credenciais(l), orgao: (await c.query("select nome from orgao where id = $1", [a.orgaoId])).rows[0].nome as string };
  });
  if (!cred) throw new ErroDeRegra("Preencha o identificador do número, a chave de acesso e o modelo.");
  const r = await enviarWhatsapp(cred, numero, { orgao, titulo: "Mensagem de teste", prazo: "-", link: "https://civiobras.netlify.app" });
  if (r.situacao !== "enviado") throw new ErroDeRegra(r.situacao === "falhou" ? `A Meta recusou: ${r.erro}` : "WhatsApp não configurado.");
}

function credenciais(l: Record<string, unknown> | null): CredenciaisWhatsapp | null {
  const token = decifrar((l?.whatsapp_token_cifrado as string) ?? null);
  if (!l?.whatsapp_numero_id || !l?.whatsapp_modelo || !token) return null;
  return { numeroId: l.whatsapp_numero_id as string, token, modelo: l.whatsapp_modelo as string };
}

/** O que o órgão autorizou para envios automáticos. Sem autorização, nada sai. */
export async function envioAutomatico(c: PoolClient): Promise<{ email: { nome: string; responderPara: string } | null; whatsapp: CredenciaisWhatsapp | null }> {
  const l = await linhaConfig(c);
  const orgao = (await c.query("select nome from orgao where id = ctx_orgao()")).rows[0]?.nome as string | undefined;
  return {
    email: l?.email_automatico && l.email_validado_em && emailConfigurado() ? { nome: l.email_nome || orgao || "CiviObras", responderPara: l.email_corporativo } : null,
    whatsapp: l?.whatsapp_automatico ? credenciais(l) : null,
  };
}

// ---------------------------------------------------------------------------
// Histórico de comunicação
// ---------------------------------------------------------------------------
export type Registro = {
  canal: "email" | "whatsapp"; modo: "manual" | "automatico"; situacao: "aberto" | "enviado" | "falhou" | "sem_servico";
  solicitacaoId?: string | null; conviteId?: string | null; empresaId?: string | null; destino?: string | null; assunto?: string | null; erro?: string | null; usuarioId?: string | null;
};

export async function registrar(c: PoolClient, r: Registro) {
  await c.query(
    `insert into registro_comunicacao (orgao_id, solicitacao_id, convite_id, empresa_id, canal, modo, destino, assunto, situacao, erro, usuario_id)
     values (ctx_orgao(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [r.solicitacaoId ?? null, r.conviteId ?? null, r.empresaId ?? null, r.canal, r.modo, limpo(r.destino, 200), limpo(r.assunto, 300), r.situacao, limpo(r.erro, 300), r.usuarioId ?? null]);
}

/** Abertura do e-mail ou do WhatsApp pela própria pessoa: fica no histórico como "aberto". */
export async function registrarAberturaManual(a: Ator, d: { canal: "email" | "whatsapp"; conviteId?: string; empresaId?: string; destino?: string; assunto?: string }) {
  exigir(a, "cotacao.ver");
  await comContexto(ctx(a), async (c) => {
    let solicitacaoId: string | null = null;
    let empresaId = uuid(d.empresaId) ? d.empresaId : null;
    if (uuid(d.conviteId)) {
      const cv = (await c.query("select solicitacao_id, empresa_id from convite_cotacao where id = $1", [d.conviteId])).rows[0];
      if (!cv) return;
      solicitacaoId = cv.solicitacao_id; empresaId = cv.empresa_id;
    }
    await registrar(c, { canal: d.canal, modo: "manual", situacao: "aberto", solicitacaoId, conviteId: uuid(d.conviteId) ? d.conviteId : null, empresaId, destino: d.destino, assunto: d.assunto, usuarioId: a.id });
  });
}

export type LinhaHistorico = {
  id: string; canal: string; modo: string; situacao: string; destino: string | null; assunto: string | null; erro: string | null; criadoEm: Date;
  fornecedor: string | null; cotacao: string | null; solicitacaoId: string | null; usuario: string | null;
};

export async function historicoDeComunicacao(a: Ator, limite = 200): Promise<LinhaHistorico[]> {
  exigir(a, "cotacao.ver");
  return comContexto(ctx(a), async (c) => (await c.query(
    `select r.id, r.canal, r.modo, r.situacao, r.destino, r.assunto, r.erro, r.criado_em as "criadoEm", e.razao_social as fornecedor,
            case when s.id is null then null else 'Nº ' || lpad(s.numero::text, 3, '0') || ' · ' || s.titulo end as cotacao, s.id as "solicitacaoId", u.nome as usuario
       from registro_comunicacao r left join empresa e on e.id = r.empresa_id left join solicitacao_cotacao s on s.id = r.solicitacao_id
       left join usuario u on u.id = r.usuario_id
      order by r.criado_em desc limit $1`, [limite])).rows);
}

// ---------------------------------------------------------------------------
// Contatos dos fornecedores
// ---------------------------------------------------------------------------
export type Contato = {
  empresaId: string; razaoSocial: string; cnpj: string; responsavel: string | null; email: string | null; telefone: string | null;
  contaId: string | null; convites: number; conversaId: string | null; naoLidas: number;
};

export async function contatosDeFornecedores(a: Ator): Promise<Contato[]> {
  exigir(a, "cotacao.ver");
  return comContexto(ctx(a), async (c) => (await c.query(
    `select e.id as "empresaId", e.razao_social as "razaoSocial", e.cnpj, e.responsavel, e.email, e.telefone, e.conta_fornecedor_id as "contaId",
            (select count(*)::int from convite_cotacao cv where cv.empresa_id = e.id) as convites,
            (select cs.id from conversa cs where cs.conta_id = e.conta_fornecedor_id and cs.solicitacao_id is null) as "conversaId",
            (select count(*)::int from mensagem_conversa m join conversa cs on cs.id = m.conversa_id
              where cs.conta_id = e.conta_fornecedor_id and m.autor = 'fornecedor' and m.criada_em > coalesce(cs.lida_contratante_em, '-infinity')) as "naoLidas"
       from empresa e where e.tipo = 'fornecedor' and e.ativa order by e.conta_fornecedor_id is null, e.razao_social`)).rows);
}

// ---------------------------------------------------------------------------
// Chat interno: lado do contratante
// ---------------------------------------------------------------------------
export type ResumoConversa = {
  id: string; fornecedor: string; cnpj: string; cotacao: string | null; solicitacaoId: string | null; ultimaEm: Date;
  ultimaMensagem: string | null; ultimoAutor: string | null; naoLidas: number;
};
export type MensagemChat = { id: string; autor: "contratante" | "fornecedor"; autorNome: string; texto: string; criadaEm: Date; minha: boolean };
export type ConversaAberta = ResumoConversa & {
  orgao: string; empresaId: string | null; email: string | null; telefone: string | null; mensagens: MensagemChat[]; podeEscrever: boolean;
};

const SQL_RESUMO = `
  select cs.id, coalesce(e.razao_social, cf.razao_social) as fornecedor, cf.cnpj, cs.solicitacao_id as "solicitacaoId", cs.ultima_em as "ultimaEm",
         case when s.id is null then null else 'Nº ' || lpad(s.numero::text, 3, '0') || ' · ' || s.titulo end as cotacao,
         (select m.texto from mensagem_conversa m where m.conversa_id = cs.id order by m.criada_em desc limit 1) as "ultimaMensagem",
         (select m.autor_nome from mensagem_conversa m where m.conversa_id = cs.id order by m.criada_em desc limit 1) as "ultimoAutor",
         (select count(*)::int from mensagem_conversa m where m.conversa_id = cs.id and m.autor = $AUTOR and m.criada_em > coalesce(cs.$LIDA, '-infinity')) as "naoLidas"
    from conversa cs join conta_fornecedor cf on cf.id = cs.conta_id left join empresa e on e.id = cs.empresa_id
    left join solicitacao_cotacao s on s.id = cs.solicitacao_id`;
const resumoContratante = SQL_RESUMO.replace("$AUTOR", "'fornecedor'").replace("$LIDA", "lida_contratante_em");
const resumoFornecedor = SQL_RESUMO.replace("$AUTOR", "'contratante'").replace("$LIDA", "lida_fornecedor_em");

export async function conversasDoOrgao(a: Ator): Promise<ResumoConversa[]> {
  exigir(a, "cotacao.ver");
  return comContexto(ctx(a), async (c) => (await c.query(`${resumoContratante} order by cs.ultima_em desc limit 300`)).rows);
}

export async function naoLidasDoOrgao(a: Ator): Promise<number> {
  if (!pode(a, "cotacao.ver")) return 0;
  return comContexto(ctx(a), async (c) => (await c.query(
    `select count(*)::int as n from mensagem_conversa m join conversa cs on cs.id = m.conversa_id
      where m.autor = 'fornecedor' and m.criada_em > coalesce(cs.lida_contratante_em, '-infinity')`)).rows[0].n);
}

/**
 * Abre (ou reaproveita) a conversa com o fornecedor, geral ou de uma cotação.
 * Só com empresa que tem cadastro na área do fornecedor.
 */
export async function abrirConversa(a: Ator, d: { empresaId: string; solicitacaoId?: string | null }): Promise<string> {
  exigir(a, "cotacao.solicitar");
  if (!uuid(d.empresaId)) throw new ErroDeRegra("Fornecedor não encontrado.");
  const solicitacaoId = uuid(d.solicitacaoId) ? d.solicitacaoId : null;
  return comContexto(ctx(a), async (c) => {
    const e = (await c.query("select id, conta_fornecedor_id from empresa where id = $1", [d.empresaId])).rows[0];
    if (!e) throw new ErroDeRegra("Fornecedor não encontrado.");
    if (!e.conta_fornecedor_id) throw new ErroDeRegra("O chat funciona com fornecedores cadastrados na área do fornecedor. Convide a empresa para se cadastrar.");
    if (solicitacaoId) {
      const cv = (await c.query("select 1 from convite_cotacao where solicitacao_id = $1 and empresa_id = $2", [solicitacaoId, e.id])).rows[0];
      if (!cv) throw new ErroDeRegra("Este fornecedor não está nesta cotação.");
    }
    const ja = (await c.query(
      "select id from conversa where conta_id = $1 and coalesce(solicitacao_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)",
      [e.conta_fornecedor_id, solicitacaoId])).rows[0];
    if (ja) return ja.id as string;
    const id = (await c.query(
      "insert into conversa (orgao_id, conta_id, empresa_id, solicitacao_id, criada_por) values ($1,$2,$3,$4,$5) returning id",
      [a.orgaoId, e.conta_fornecedor_id, e.id, solicitacaoId, a.id])).rows[0].id as string;
    await c.query("insert into conversa_da_conta (conversa_id, conta_id, orgao_id) values ($1,$2,$3)", [id, e.conta_fornecedor_id, a.orgaoId]);
    return id;
  });
}

async function mensagensDa(c: PoolClient, conversaId: string, eu: { usuarioId?: string; acessoId?: string }): Promise<MensagemChat[]> {
  return (await c.query(
    `select id, autor, autor_nome as "autorNome", texto, criada_em as "criadaEm",
            (usuario_id is not distinct from $2::uuid and $2::uuid is not null) or (acesso_id is not distinct from $3::uuid and $3::uuid is not null) as minha
       from mensagem_conversa where conversa_id = $1 order by criada_em`, [conversaId, eu.usuarioId ?? null, eu.acessoId ?? null])).rows;
}

export async function conversaDoOrgao(a: Ator, id: string): Promise<ConversaAberta | null> {
  exigir(a, "cotacao.ver");
  if (!uuid(id)) return null;
  return comContexto(ctx(a), async (c) => {
    const r = (await c.query(`${resumoContratante} where cs.id = $1`, [id])).rows[0];
    if (!r) return null;
    const extra = (await c.query(
      `select cs.empresa_id as "empresaId", coalesce(e.email, (select x.email from acesso_fornecedor x where x.conta_id = cs.conta_id and x.ativo order by x.papel = 'administrador' desc, x.criado_em limit 1)) as email,
              coalesce(e.telefone, cf.telefone) as telefone, g.nome as orgao
         from conversa cs join conta_fornecedor cf on cf.id = cs.conta_id left join empresa e on e.id = cs.empresa_id join orgao g on g.id = cs.orgao_id where cs.id = $1`, [id])).rows[0];
    await c.query("update conversa set lida_contratante_em = now() where id = $1", [id]);
    return { ...r, ...extra, mensagens: await mensagensDa(c, id, { usuarioId: a.id }), podeEscrever: pode(a, "cotacao.solicitar") };
  });
}

function textoValido(t: string) {
  const texto = t.replace(/\r\n/g, "\n").trim();
  if (!texto) throw new ErroDeRegra("Escreva a mensagem.");
  if (texto.length > 4000) throw new ErroDeRegra("Mensagem com mais de 4.000 caracteres.");
  return texto;
}

export async function enviarMensagemContratante(a: Ator, id: string, t: string) {
  exigir(a, "cotacao.solicitar");
  if (!uuid(id)) throw new ErroDeRegra("Conversa não encontrada.");
  const texto = textoValido(t);
  await comContexto(ctx(a), async (c) => {
    const cs = (await c.query("select id from conversa where id = $1", [id])).rows[0];
    if (!cs) throw new ErroDeRegra("Conversa não encontrada.");
    const nome = (await c.query("select nome from usuario where id = $1", [a.id])).rows[0]?.nome ?? "Equipe";
    await c.query("insert into mensagem_conversa (orgao_id, conversa_id, autor, usuario_id, autor_nome, texto) values ($1,$2,'contratante',$3,$4,$5)",
      [a.orgaoId, id, a.id, nome, texto]);
    await c.query("update conversa set ultima_em = now(), lida_contratante_em = now() where id = $1", [id]);
  });
}

// ---------------------------------------------------------------------------
// Chat interno: lado do fornecedor
// ---------------------------------------------------------------------------
async function orgaoDaConversa(f: Fornecedor, id: string) {
  if (!uuid(id)) return null;
  const r = await pool().query("select orgao_id from conversa_da_conta where conversa_id = $1 and conta_id = $2", [id, f.contaId]);
  return (r.rows[0]?.orgao_id as string) ?? null;
}

async function orgaosDaConta(contaId: string) {
  return (await pool().query("select distinct orgao_id from conversa_da_conta where conta_id = $1", [contaId])).rows.map((l) => l.orgao_id as string);
}

export type ResumoConversaFornecedor = ResumoConversa & { orgao: string };

export async function conversasDoFornecedor(f: Fornecedor): Promise<ResumoConversaFornecedor[]> {
  const lista: ResumoConversaFornecedor[] = [];
  for (const orgaoId of await orgaosDaConta(f.contaId)) {
    const linhas = await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
      `select x.*, g.nome as orgao from (${resumoFornecedor} where cs.conta_id = $1) x join conversa cs2 on cs2.id = x.id join orgao g on g.id = cs2.orgao_id`, [f.contaId])).rows);
    lista.push(...linhas);
  }
  return lista.sort((a, b) => +new Date(b.ultimaEm) - +new Date(a.ultimaEm));
}

export async function naoLidasDoFornecedor(f: Fornecedor): Promise<number> {
  let n = 0;
  for (const orgaoId of await orgaosDaConta(f.contaId)) {
    n += await comContexto({ usuarioId: null, orgaoId }, async (c) => (await c.query(
      `select count(*)::int as n from mensagem_conversa m join conversa cs on cs.id = m.conversa_id
        where cs.conta_id = $1 and m.autor = 'contratante' and m.criada_em > coalesce(cs.lida_fornecedor_em, '-infinity')`, [f.contaId])).rows[0].n);
  }
  return n;
}

export const fornecedorEscreve = (f: Fornecedor) => f.papel !== "consulta";

export async function conversaDoFornecedor(f: Fornecedor, id: string): Promise<ConversaAberta | null> {
  const orgaoId = await orgaoDaConversa(f, id);
  if (!orgaoId) return null;
  return comContexto({ usuarioId: null, orgaoId }, async (c) => {
    const r = (await c.query(`${resumoFornecedor} where cs.id = $1 and cs.conta_id = $2`, [id, f.contaId])).rows[0];
    if (!r) return null;
    const g = (await c.query("select g.nome as orgao from conversa cs join orgao g on g.id = cs.orgao_id where cs.id = $1", [id])).rows[0];
    await c.query("update conversa set lida_fornecedor_em = now() where id = $1", [id]);
    return { ...r, orgao: g.orgao, empresaId: null, email: null, telefone: null, mensagens: await mensagensDa(c, id, { acessoId: f.acessoId }), podeEscrever: fornecedorEscreve(f) };
  });
}

export async function enviarMensagemFornecedor(f: Fornecedor, id: string, t: string) {
  if (!fornecedorEscreve(f)) throw new ErroDeRegra("Seu usuário é só de consulta. Peça ao administrador da empresa para mudar a permissão.");
  const texto = textoValido(t);
  const orgaoId = await orgaoDaConversa(f, id);
  if (!orgaoId) throw new ErroDeRegra("Conversa não encontrada.");
  await comContexto({ usuarioId: null, orgaoId }, async (c) => {
    await c.query("insert into mensagem_conversa (orgao_id, conversa_id, autor, acesso_id, autor_nome, texto) values ($1,$2,'fornecedor',$3,$4,$5)",
      [orgaoId, id, f.acessoId, `${f.nome} · ${f.nomeFantasia || f.razaoSocial}`, texto]);
    await c.query("update conversa set ultima_em = now(), lida_fornecedor_em = now() where id = $1", [id]);
  });
}

/** Na cotação, o fornecedor pode abrir a conversa com o órgão que o convidou. */
export async function abrirConversaDoConvite(f: Fornecedor, conviteId: string): Promise<string> {
  if (!fornecedorEscreve(f)) throw new ErroDeRegra("Seu usuário é só de consulta.");
  if (!uuid(conviteId)) throw new ErroDeRegra("Cotação não encontrada.");
  const v = (await pool().query("select orgao_id from convite_da_conta where convite_id = $1 and conta_id = $2", [conviteId, f.contaId])).rows[0];
  if (!v) throw new ErroDeRegra("Cotação não encontrada.");
  return comContexto({ usuarioId: null, orgaoId: v.orgao_id }, async (c) => {
    const cv = (await c.query("select solicitacao_id, empresa_id from convite_cotacao where id = $1", [conviteId])).rows[0];
    const ja = (await c.query("select id from conversa where conta_id = $1 and solicitacao_id = $2", [f.contaId, cv.solicitacao_id])).rows[0];
    if (ja) return ja.id as string;
    const id = (await c.query("insert into conversa (orgao_id, conta_id, empresa_id, solicitacao_id) values ($1,$2,$3,$4) returning id",
      [v.orgao_id, f.contaId, cv.empresa_id, cv.solicitacao_id])).rows[0].id as string;
    await c.query("insert into conversa_da_conta (conversa_id, conta_id, orgao_id) values ($1,$2,$3)", [id, f.contaId, v.orgao_id]);
    return id;
  });
}

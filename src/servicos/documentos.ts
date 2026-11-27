import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { armazenamento, caminhoDoArquivo, type Armazenamento } from "../lib/armazenamento";
import { comContexto, ErroDeRegra } from "../lib/db";
import { ctxCampo, dataValida, exigirVer, hoje, lerGuardado, limpo, obraNoAcesso, obrasVisiveis, uuid, type ObraCampo } from "./campo";
import type { Ator } from "./obras";
import { exigir, pode } from "./permissoes";
import type { FormaExecucao, Situacao } from "./rotulos";

export type Categoria = "projeto" | "art_rrt" | "licenca" | "laudo" | "termo" | "outro";
export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  projeto: "Projetos", art_rrt: "ART e RRT", licenca: "Licenças e alvarás", laudo: "Laudos e relatórios técnicos", termo: "Termos e ordens", outro: "Outros",
};
export const CATEGORIAS = Object.keys(ROTULO_CATEGORIA) as Categoria[];
export const TIPOS_SUGERIDOS: Record<Categoria, string[]> = {
  projeto: ["Projeto arquitetônico", "Projeto estrutural", "Projeto de fundações", "Projeto hidrossanitário", "Projeto elétrico", "Projeto de drenagem",
    "Projeto de pavimentação", "Projeto de acessibilidade", "Projeto de prevenção contra incêndio", "Modelo BIM (IFC)", "Memorial descritivo", "Caderno de especificações"],
  art_rrt: ["ART de projeto", "ART de execução", "ART de fiscalização", "RRT de projeto", "RRT de execução", "RRT de fiscalização"],
  licenca: ["Alvará de obra", "Licença ambiental prévia", "Licença ambiental de instalação", "Dispensa de licenciamento ambiental", "Autorização de supressão vegetal", "Certificado do Corpo de Bombeiros"],
  laudo: ["Sondagem do solo", "Laudo de vistoria", "Laudo de ensaio", "Levantamento topográfico", "Relatório fotográfico", "As built"],
  termo: ["Ordem de serviço", "Termo de recebimento provisório", "Termo de recebimento definitivo", "Termo de paralisação", "Termo de reinício", "Ata de reunião"],
  outro: ["Ofício", "Notificação", "Comunicado"],
};

export type Exigencia = "art_projeto" | "art_execucao" | "art_fiscalizacao" | "alvara" | "licenca_ambiental" | "ordem_servico";
type RegraExigencia = { rotulo: string; categoria: Categoria; tipo: string; vale: (forma: FormaExecucao) => boolean };
export const EXIGENCIAS: Record<Exigencia, RegraExigencia> = {
  art_projeto: { rotulo: "ART ou RRT de projeto", categoria: "art_rrt", tipo: "ART de projeto", vale: () => true },
  art_execucao: { rotulo: "ART ou RRT de execução", categoria: "art_rrt", tipo: "ART de execução", vale: () => true },
  art_fiscalizacao: { rotulo: "ART ou RRT de fiscalização", categoria: "art_rrt", tipo: "ART de fiscalização", vale: (f) => f !== "direta" },
  alvara: { rotulo: "Alvará de obra", categoria: "licenca", tipo: "Alvará de obra", vale: () => true },
  licenca_ambiental: { rotulo: "Licença ambiental", categoria: "licenca", tipo: "Licença ambiental de instalação", vale: () => true },
  ordem_servico: { rotulo: "Ordem de serviço", categoria: "termo", tipo: "Ordem de serviço", vale: (f) => f !== "direta" },
};
/** Situações da obra em que as exigências documentais contam como pendência. */
const OBRA_ATIVA: Situacao[] = ["em_execucao", "paralisada"];
export const AVISO_DIAS = 30;
export const TAMANHO_MAXIMO_ARQUIVO = 4 * 1024 * 1024;

/** Tipos aceitos, pela extensão do arquivo. O tipo informado pelo navegador não é usado. */
const EXTENSOES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  dwg: "image/vnd.dwg", dxf: "image/vnd.dxf", ifc: "application/x-step", zip: "application/zip",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
};
export const EXTENSOES_ACEITAS = Object.keys(EXTENSOES).map((e) => `.${e}`).join(",");

export type Arquivo = { nome: string; conteudo: Buffer };

function conferirArquivo(f: Arquivo) {
  const nome = (f.nome ?? "").split(/[\\/]/).pop()!.trim().slice(0, 160);
  const ext = nome.includes(".") ? nome.split(".").pop()!.toLowerCase() : "";
  if (!nome || !f.conteudo?.length) throw new ErroDeRegra("Escolha o arquivo.");
  if (!EXTENSOES[ext]) throw new ErroDeRegra("Tipo de arquivo não aceito. Envie PDF, imagem, DWG, DXF, IFC, planilha, texto ou ZIP.");
  if (f.conteudo.length > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra("O arquivo passa de 4 MB.");
  if (ext === "pdf" && f.conteudo.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ErroDeRegra("O arquivo não é um PDF válido.");
  return { nome, ext, mime: EXTENSOES[ext] };
}

/**
 * Grava uma versão. Com armazenamento configurado, o arquivo vai para lá e o
 * banco guarda caminho, tamanho e SHA-256; sem ele, o conteúdo fica no banco.
 */
async function gravarVersao(c: PoolClient, a: Ator, arm: Armazenamento | null, enviados: string[], obraId: string, documentoId: string,
  f: { nome: string; ext: string; mime: string }, conteudo: Buffer, mudanca: string | null): Promise<number> {
  const id = randomUUID();
  let arquivo: string | null = null;
  if (arm) {
    arquivo = caminhoDoArquivo(a.orgaoId, "documentos", obraId, documentoId, `${id}.${f.ext}`);
    enviados.push(arquivo);
    await arm.guardar(arquivo, conteudo, f.mime);
  }
  const sha = createHash("sha256").update(conteudo).digest("hex");
  return (await c.query(
    `insert into documento_versao (id, orgao_id, documento_id, numero, nome_arquivo, mime, tamanho, sha256, conteudo, arquivo, mudanca)
     values ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10) returning numero`,
    [id, a.orgaoId, documentoId, f.nome, f.mime, conteudo.length, sha, arm ? null : conteudo, arquivo, mudanca])).rows[0].numero as number;
}

/** Desfaz no armazenamento o que foi enviado se a gravação no banco falhar. */
function desfazerEnvio(arm: Armazenamento | null, enviados: string[]) {
  return async (e: unknown): Promise<never> => {
    if (arm && enviados.length) await arm.remover(enviados).catch(() => {});
    throw e;
  };
}

const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const limiteAvisoDocumento = () => somarDias(hoje(), AVISO_DIAS);

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export type SituacaoDocumento = "vigente" | "vencendo" | "vencido" | "superado" | "baixada";
export type Documento = {
  id: string; obraId: string; contratoId: string | null; contratoNumero: string | null; categoria: Categoria; tipo: string; titulo: string;
  numero: string | null; emissor: string | null; emissao: string | null; validade: string | null; exigencia: Exigencia | null;
  conselho: string | null; profissional: string | null; registro: string | null; atividade: string | null; baixadaEm: string | null;
  superadoPor: string | null; superadoPorTitulo: string | null; superadoEm: Date | null; superadoMotivo: string | null;
  versao: number; versaoId: string; arquivo: string; tamanho: number; mime: string; enviadoEm: Date; enviadoPor: string | null;
  situacao: SituacaoDocumento;
};
const COLUNAS_DOC = `d.id, d.obra_id as "obraId", d.contrato_id as "contratoId", k.numero as "contratoNumero", d.categoria, d.tipo, d.titulo, d.numero, d.emissor,
  to_char(d.emissao, 'YYYY-MM-DD') as emissao, to_char(d.validade, 'YYYY-MM-DD') as validade, d.exigencia, d.conselho, d.profissional, d.registro, d.atividade,
  to_char(d.baixada_em, 'YYYY-MM-DD') as "baixadaEm", d.superado_por as "superadoPor", s.titulo as "superadoPorTitulo", d.superado_em as "superadoEm", d.superado_motivo as "superadoMotivo",
  v.numero as versao, v.id as "versaoId", v.nome_arquivo as arquivo, v.tamanho, v.mime, v.criado_em as "enviadoEm", u.nome as "enviadoPor"`;
const DE_DOC = `from documento d left join contrato k on k.id = d.contrato_id left join documento s on s.id = d.superado_por
  join lateral (select x.id, x.numero, x.nome_arquivo, x.tamanho, x.mime, x.criado_em, x.criado_por from documento_versao x where x.documento_id = d.id order by x.numero desc limit 1) v on true
  left join usuario u on u.id = v.criado_por`;

function situar(d: Omit<Documento, "situacao">): Documento {
  const h = hoje();
  const situacao: SituacaoDocumento = d.superadoPor ? "superado" : d.baixadaEm ? "baixada"
    : d.validade && d.validade < h ? "vencido" : d.validade && d.validade <= limiteAvisoDocumento() ? "vencendo" : "vigente";
  return { ...d, situacao };
}

export type LinhaExigencia = {
  chave: Exigencia; rotulo: string; categoria: Categoria; tipo: string;
  documento: { id: string; titulo: string; situacao: SituacaoDocumento } | null; dispensa: { justificativa: string; por: string | null; em: Date } | null;
  atendida: boolean;
};
export type DocumentoGerado = { grupo: string; titulo: string; detalhe: string; data: string | null; href: string };

export type DocumentosDaObra = {
  obra: ObraCampo & { formaExecucao: FormaExecucao };
  documentos: Documento[]; exigencias: LinhaExigencia[]; gerados: DocumentoGerado[];
  contratos: { id: string; numero: string }[];
  vencidos: number; vencendo: number; pendentes: number; ativa: boolean;
  podeEnviar: boolean; podeDispensar: boolean;
};

async function exigenciasDaObra(c: PoolClient, obraId: string, forma: FormaExecucao, docs: Documento[]): Promise<LinhaExigencia[]> {
  const dispensas = new Map((await c.query(
    `select x.exigencia, x.justificativa, u.nome as por, x.criado_em as em from documento_dispensa x left join usuario u on u.id = x.criado_por where x.obra_id = $1`,
    [obraId])).rows.map((r) => [r.exigencia as Exigencia, r]));
  return (Object.keys(EXIGENCIAS) as Exigencia[]).filter((k) => EXIGENCIAS[k].vale(forma)).map((chave) => {
    const r = EXIGENCIAS[chave];
    // Havendo um documento válido e outro vencido para a mesma exigência, vale o válido.
    const doc = docs.find((d) => d.exigencia === chave && d.situacao !== "superado" && d.situacao !== "vencido")
      ?? docs.find((d) => d.exigencia === chave && d.situacao !== "superado");
    const dispensa = dispensas.get(chave) ?? null;
    return {
      chave, rotulo: r.rotulo, categoria: r.categoria, tipo: r.tipo,
      documento: doc ? { id: doc.id, titulo: doc.titulo, situacao: doc.situacao } : null,
      dispensa: dispensa ? { justificativa: dispensa.justificativa, por: dispensa.por, em: dispensa.em } : null,
      atendida: !!dispensa || (!!doc && doc.situacao !== "vencido"),
    };
  });
}

/** Documentos que o próprio sistema produz para a obra, com o link para a versão em PDF. */
async function geradosDaObra(c: PoolClient, a: Ator, obraId: string): Promise<DocumentoGerado[]> {
  const g: DocumentoGerado[] = [];
  if (pode(a, "orcamento.ver")) {
    for (const o of (await c.query(
      `select id, lpad(numero::text, 3, '0') || ' v' || versao as rotulo, nome, to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data
         from orcamento where obra_id = $1 and situacao in ('aprovado', 'substituido') order by numero, versao`, [obraId])).rows) {
      g.push({ grupo: "Orçamento", titulo: `Nota do orçamento ${o.rotulo}`, detalhe: o.nome, data: o.data, href: `/orcamentos/${o.id}/nota` });
    }
  }
  if (pode(a, "medicao.ver")) {
    for (const m of (await c.query(
      `select m.id, m.numero, m.ajuste, k.numero as contrato, to_char(m.periodo_inicio, 'YYYY-MM-DD') as ini, to_char(m.periodo_fim, 'YYYY-MM-DD') as fim,
              to_char(m.aprovada_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data
         from medicao m join contrato k on k.id = m.contrato_id where k.obra_id = $1 and m.situacao = 'aprovada' order by k.numero, m.numero`, [obraId])).rows) {
      g.push({ grupo: "Medição", titulo: `Boletim de medição nº ${String(m.numero).padStart(2, "0")}${m.ajuste ? " (ajuste)" : ""}`, detalhe: `Contrato ${m.contrato} · ${m.ini.split("-").reverse().join("/")} a ${m.fim.split("-").reverse().join("/")}`, data: m.data, href: `/medicoes/${m.id}/boletim` });
    }
  }
  if (pode(a, "contrato.ver")) {
    for (const x of (await c.query(
      `select ad.id, ad.numero, k.numero as contrato, to_char(ad.data_assinatura, 'YYYY-MM-DD') as data
         from aditivo ad join contrato k on k.id = ad.contrato_id where k.obra_id = $1 and ad.situacao = 'assinado' order by k.numero, ad.numero`, [obraId])).rows) {
      g.push({ grupo: "Aditivo", titulo: `${x.numero}º termo aditivo`, detalhe: `Contrato ${x.contrato}`, data: x.data, href: `/aditivos/${x.id}/termo` });
    }
    for (const r of (await c.query(
      `select rp.id, rp.numero, rp.tipo, k.numero as contrato, to_char(rp.criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data
         from revisao_preco rp join contrato k on k.id = rp.contrato_id where k.obra_id = $1 order by k.numero, rp.numero`, [obraId])).rows) {
      g.push({ grupo: "Apostilamento", titulo: `${r.numero}º apostilamento (${r.tipo === "reajuste" ? "reajuste" : "reequilíbrio"})`, detalhe: `Contrato ${r.contrato}`, data: r.data, href: `/apostilamentos/${r.id}` });
    }
  }
  const relatorios: [string, string, string][] = [];
  if (pode(a, "diario.ver")) relatorios.push(["Diário de obra", "Relatório do diário de obra", "diario/relatorio"]);
  if (pode(a, "qualidade.ver")) relatorios.push(["Qualidade", "Relatório de qualidade", "qualidade/relatorio"]);
  if (pode(a, "seguranca.ver")) relatorios.push(["Segurança", "Relatório de segurança do trabalho", "seguranca/relatorio"]);
  if (pode(a, "suprimentos.ver")) relatorios.push(["Suprimentos", "Relatório de suprimentos e estoque", "suprimentos/relatorio"]);
  if (pode(a, "equipes.ver")) relatorios.push(["Equipes", "Relatório de equipes e custo realizado", "equipes/relatorio"]);
  for (const [grupo, titulo, rota] of relatorios) g.push({ grupo, titulo, detalhe: "Posição atual", data: null, href: `/obras/${obraId}/${rota}` });
  return g;
}

async function documentosNaTransacao(c: PoolClient, obraId: string): Promise<Documento[]> {
  return (await c.query(`select ${COLUNAS_DOC} ${DE_DOC} where d.obra_id = $1 order by d.categoria, d.superado_por is not null, d.tipo, d.titulo`, [obraId])).rows.map(situar);
}

export async function documentosDaObra(a: Ator, obraId: string): Promise<DocumentosDaObra> {
  exigirVer(a, "documentos.ver");
  return comContexto(ctxCampo(a), async (c) => {
    const obra = await obraNoAcesso(c, a, obraId);
    const forma = (await c.query("select forma_execucao from obra where id = $1", [obraId])).rows[0].forma_execucao as FormaExecucao;
    const documentos = await documentosNaTransacao(c, obraId);
    const exigencias = await exigenciasDaObra(c, obraId, forma, documentos);
    const ativa = OBRA_ATIVA.includes(obra.situacao);
    return {
      obra: { ...obra, formaExecucao: forma }, documentos, exigencias, gerados: await geradosDaObra(c, a, obraId),
      contratos: (await c.query("select id, numero from contrato where obra_id = $1 and situacao <> 'rascunho' order by numero", [obraId])).rows,
      vencidos: documentos.filter((d) => d.situacao === "vencido").length, vencendo: documentos.filter((d) => d.situacao === "vencendo").length,
      pendentes: ativa ? exigencias.filter((e) => !e.atendida).length : 0, ativa,
      podeEnviar: pode(a, "documentos.enviar"), podeDispensar: pode(a, "documentos.dispensar"),
    };
  });
}

export type Versao = { id: string; numero: number; arquivo: string; tamanho: number; mime: string; sha256: string; mudanca: string | null; por: string | null; em: Date };
export type DocumentoCompleto = Documento & {
  obra: ObraCampo; versoes: Versao[]; substitutos: { id: string; titulo: string; tipo: string }[]; contratos: { id: string; numero: string }[];
  podeEnviar: boolean; superadoDe: { id: string; titulo: string }[];
};

export async function obterDocumento(a: Ator, id: string): Promise<DocumentoCompleto> {
  exigirVer(a, "documentos.ver");
  if (!uuid(id)) throw new ErroDeRegra("Documento não encontrado.");
  return comContexto(ctxCampo(a), async (c) => {
    const r = (await c.query(`select ${COLUNAS_DOC} ${DE_DOC} where d.id = $1`, [id])).rows[0];
    if (!r) throw new ErroDeRegra("Documento não encontrado.");
    const obra = await obraNoAcesso(c, a, r.obraId);
    const d = situar(r);
    const versoes = (await c.query(
      `select v.id, v.numero, v.nome_arquivo as arquivo, v.tamanho, v.mime, v.sha256, v.mudanca, u.nome as por, v.criado_em as em
         from documento_versao v left join usuario u on u.id = v.criado_por where v.documento_id = $1 order by v.numero desc`, [id])).rows;
    const substitutos = d.superadoPor ? [] : (await c.query(
      "select id, titulo, tipo from documento where obra_id = $1 and categoria = $2 and id <> $3 and superado_por is null order by criado_em desc", [d.obraId, d.categoria, id])).rows;
    const superadoDe = (await c.query("select id, titulo from documento where superado_por = $1 order by superado_em", [id])).rows;
    const contratos = (await c.query("select id, numero from contrato where obra_id = $1 and situacao <> 'rascunho' order by numero", [d.obraId])).rows;
    return { ...d, obra, versoes, substitutos, superadoDe, contratos, podeEnviar: pode(a, "documentos.enviar") };
  });
}

/** Arquivo de uma versão, para baixar ou ver. */
export async function lerArquivo(a: Ator, versaoId: string) {
  if (!pode(a, "documentos.ver") || !uuid(versaoId)) return null;
  const v = await comContexto(ctxCampo(a), async (c) => {
    const v = (await c.query(
      `select v.conteudo, v.arquivo, v.mime, v.nome_arquivo as nome, d.obra_id as "obraId" from documento_versao v join documento d on d.id = v.documento_id where v.id = $1`, [versaoId])).rows[0];
    if (!v) return null;
    try { await obraNoAcesso(c, a, v.obraId); } catch { return null; }
    return v as { conteudo: Buffer | null; arquivo: string | null; mime: string; nome: string };
  });
  if (!v) return null;
  const f = await lerGuardado({ mime: v.mime, bytes: v.conteudo, arquivo: v.arquivo });
  return f ? { bytes: f.bytes, mime: f.mime, nome: v.nome } : null;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export type DadosDocumento = {
  categoria: string; tipo: string; titulo: string; numero?: string | null; emissor?: string | null; emissao?: string | null; validade?: string | null;
  exigencia?: string | null; contratoId?: string | null; conselho?: string | null; profissional?: string | null; registro?: string | null; atividade?: string | null;
};

function conferirDados(d: DadosDocumento) {
  if (!CATEGORIAS.includes(d.categoria as Categoria)) throw new ErroDeRegra("Escolha a categoria.");
  if (!limpo(d.tipo)) throw new ErroDeRegra("Informe o tipo de documento.");
  if (!limpo(d.titulo)) throw new ErroDeRegra("Informe o título.");
  if (d.emissao && (!dataValida(d.emissao) || d.emissao > hoje())) throw new ErroDeRegra("Data de emissão inválida.");
  if (d.validade && (!dataValida(d.validade) || (d.emissao && d.validade < d.emissao))) throw new ErroDeRegra("A validade é posterior à emissão.");
  const exigencia = limpo(d.exigencia) as Exigencia | null;
  if (exigencia) {
    if (!EXIGENCIAS[exigencia]) throw new ErroDeRegra("Exigência inválida.");
    if (EXIGENCIAS[exigencia].categoria !== d.categoria) throw new ErroDeRegra(`${EXIGENCIAS[exigencia].rotulo} pertence a ${ROTULO_CATEGORIA[EXIGENCIAS[exigencia].categoria].toLowerCase()}.`);
  }
  if (d.categoria === "art_rrt") {
    if (!limpo(d.numero)) throw new ErroDeRegra("Informe o número da ART ou RRT.");
    if (!["CREA", "CAU", "CFT"].includes(d.conselho ?? "")) throw new ErroDeRegra("Informe o conselho (CREA, CAU ou CFT).");
    if (!limpo(d.profissional)) throw new ErroDeRegra("Informe o profissional responsável.");
  }
  const art = d.categoria === "art_rrt";
  return [
    d.categoria, limpo(d.tipo), limpo(d.titulo), limpo(d.numero), limpo(d.emissor), d.emissao || null, d.validade || null, exigencia,
    uuid(d.contratoId) ? d.contratoId : null, art ? d.conselho : null, art ? limpo(d.profissional) : null, art ? limpo(d.registro) : null, art ? limpo(d.atividade) : null,
  ];
}

export async function enviarDocumento(a: Ator, obraId: string, d: DadosDocumento, arquivo: Arquivo): Promise<string> {
  exigir(a, "documentos.enviar");
  const valores = conferirDados(d);
  const f = conferirArquivo(arquivo);
  const arm = armazenamento();
  const enviados: string[] = [];
  return comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    const id = (await c.query(
      `insert into documento (orgao_id, obra_id, categoria, tipo, titulo, numero, emissor, emissao, validade, exigencia, contrato_id, conselho, profissional, registro, atividade)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`, [a.orgaoId, obraId, ...valores])).rows[0].id as string;
    await gravarVersao(c, a, arm, enviados, obraId, id, f, arquivo.conteudo, "Versão inicial");
    return id;
  }).catch(desfazerEnvio(arm, enviados));
}

async function documentoNoAcesso(c: PoolClient, a: Ator, id: string) {
  if (!uuid(id)) throw new ErroDeRegra("Documento não encontrado.");
  const d = (await c.query("select id, obra_id, categoria, superado_por, baixada_em from documento where id = $1 for update", [id])).rows[0];
  if (!d) throw new ErroDeRegra("Documento não encontrado.");
  await obraNoAcesso(c, a, d.obra_id);
  return d as { id: string; obra_id: string; categoria: Categoria; superado_por: string | null; baixada_em: string | null };
}

export async function salvarDocumento(a: Ator, id: string, d: Omit<DadosDocumento, "categoria">) {
  exigir(a, "documentos.enviar");
  await comContexto(ctxCampo(a), async (c) => {
    const atual = await documentoNoAcesso(c, a, id);
    if (atual.superado_por) throw new ErroDeRegra("Documento superado não se altera.");
    const v = conferirDados({ ...d, categoria: atual.categoria });
    await c.query(
      `update documento set tipo = $2, titulo = $3, numero = $4, emissor = $5, emissao = $6, validade = $7, exigencia = $8, contrato_id = $9,
              conselho = $10, profissional = $11, registro = $12, atividade = $13 where id = $1`, [id, ...v.slice(1)]);
  });
}

export async function novaVersao(a: Ator, id: string, arquivo: Arquivo, mudanca: string): Promise<number> {
  exigir(a, "documentos.enviar");
  if (!limpo(mudanca)) throw new ErroDeRegra("Diga o que mudou nesta versão.");
  const f = conferirArquivo(arquivo);
  const arm = armazenamento();
  const enviados: string[] = [];
  return comContexto(ctxCampo(a), async (c) => {
    const d = await documentoNoAcesso(c, a, id);
    return gravarVersao(c, a, arm, enviados, d.obra_id, id, f, arquivo.conteudo, limpo(mudanca));
  }).catch(desfazerEnvio(arm, enviados));
}

export async function superarDocumento(a: Ator, id: string, substitutoId: string, motivo: string) {
  exigir(a, "documentos.enviar");
  if (!uuid(substitutoId)) throw new ErroDeRegra("Escolha o documento que substitui este.");
  if (!limpo(motivo)) throw new ErroDeRegra("Informe o motivo da substituição.");
  await comContexto(ctxCampo(a), async (c) => {
    const d = await documentoNoAcesso(c, a, id);
    if (d.superado_por) throw new ErroDeRegra("O documento já está superado.");
    await c.query("update documento set superado_por = $2, superado_em = now(), superado_motivo = $3 where id = $1", [id, substitutoId, limpo(motivo)]);
  });
}

export async function baixarArt(a: Ator, id: string, data: string) {
  exigir(a, "documentos.enviar");
  if (!dataValida(data) || data > hoje()) throw new ErroDeRegra("Data da baixa inválida.");
  await comContexto(ctxCampo(a), async (c) => {
    const d = await documentoNoAcesso(c, a, id);
    if (d.categoria !== "art_rrt") throw new ErroDeRegra("Só ART ou RRT tem baixa.");
    if (d.baixada_em) throw new ErroDeRegra("A ART ou RRT já está baixada.");
    await c.query("update documento set baixada_em = $2 where id = $1", [id, data]);
  });
}

export async function dispensarExigencia(a: Ator, obraId: string, exigencia: string, justificativa: string) {
  exigir(a, "documentos.dispensar");
  if (!EXIGENCIAS[exigencia as Exigencia]) throw new ErroDeRegra("Exigência inválida.");
  if (!limpo(justificativa) || limpo(justificativa)!.length < 10) throw new ErroDeRegra("Justifique a dispensa.");
  await comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    try {
      await c.query("insert into documento_dispensa (orgao_id, obra_id, exigencia, justificativa) values ($1,$2,$3,$4)", [a.orgaoId, obraId, exigencia, limpo(justificativa)]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new ErroDeRegra("Esta exigência já foi dispensada.");
      throw e;
    }
  });
}

// ---------------------------------------------------------------------------
// Visão de todas as obras
// ---------------------------------------------------------------------------
export type ResumoDocumentosObra = {
  id: string; codigo: string; nome: string; situacao: Situacao; total: number; vencidos: number; vencendo: number; pendentes: number; faltando: string[];
};
export type PainelDocumentos = {
  obras: ResumoDocumentosObra[];
  vencimentos: (Documento & { obraCodigo: string })[];
  recentes: (Documento & { obraCodigo: string })[];
  total: number; vencidos: number; vencendo: number; pendentes: number; semArt: number;
};

export async function painelDocumentos(a: Ator): Promise<PainelDocumentos> {
  exigirVer(a, "documentos.ver");
  return comContexto(ctxCampo(a), async (c) => {
    const v = obrasVisiveis(a, "o.id", 1);
    const obras = (await c.query(
      `select o.id, o.codigo, o.nome, o.situacao, o.forma_execucao as forma from obra o
        where o.situacao not in ('cancelada') and ${v.sql} order by o.codigo`, v.params)).rows;
    const resumo: ResumoDocumentosObra[] = [];
    const todos: (Documento & { obraCodigo: string })[] = [];
    let semArt = 0;
    for (const o of obras) {
      const docs = await documentosNaTransacao(c, o.id);
      const ex = await exigenciasDaObra(c, o.id, o.forma, docs);
      const ativa = OBRA_ATIVA.includes(o.situacao);
      const faltando = ativa ? ex.filter((e) => !e.atendida).map((e) => e.rotulo) : [];
      if (ativa && ex.some((e) => e.chave === "art_execucao" && !e.atendida)) semArt++;
      todos.push(...docs.map((d) => ({ ...d, obraCodigo: o.codigo })));
      resumo.push({ id: o.id, codigo: o.codigo, nome: o.nome, situacao: o.situacao, total: docs.filter((d) => d.situacao !== "superado").length,
        vencidos: docs.filter((d) => d.situacao === "vencido").length, vencendo: docs.filter((d) => d.situacao === "vencendo").length, pendentes: faltando.length, faltando });
    }
    return {
      obras: resumo,
      vencimentos: todos.filter((d) => d.situacao === "vencido" || d.situacao === "vencendo").sort((x, y) => (x.validade ?? "").localeCompare(y.validade ?? "")),
      recentes: [...todos].sort((x, y) => new Date(y.enviadoEm).getTime() - new Date(x.enviadoEm).getTime()).slice(0, 10),
      total: todos.filter((d) => d.situacao !== "superado").length,
      vencidos: resumo.reduce((s, o) => s + o.vencidos, 0), vencendo: resumo.reduce((s, o) => s + o.vencendo, 0),
      pendentes: resumo.reduce((s, o) => s + o.pendentes, 0), semArt,
    };
  });
}

/** Pendências de documentos para a página inicial. */
export async function pendenciasDeDocumentos(a: Ator) {
  if (!pode(a, "documentos.ver")) return null;
  const p = await painelDocumentos(a);
  return { vencidos: p.vencidos, vencendo: p.vencendo, pendentes: p.pendentes };
}

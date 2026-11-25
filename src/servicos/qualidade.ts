import type { PoolClient } from "pg";
import { comContexto, ErroDeRegra } from "../lib/db";
import { lerNumeroBr, texto } from "../lib/decimal";
import { COLUNAS_FOTO, ctxCampo, dataValida, exigirVer, hoje, limpo, obraNoAcesso, obrasVisiveis, uuid, type FotoResumo, type ObraCampo } from "./campo";
import { somarDias } from "./cpm";
import type { Ator } from "./obras";
import { exigir, pode } from "./permissoes";

export type Area = "qualidade" | "seguranca";
export type Gravidade = "leve" | "moderada" | "grave";
export type SituacaoNc = "aberta" | "corrigida" | "encerrada" | "cancelada";
export type Resposta = "conforme" | "nao_conforme" | "nao_aplica";

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { leve: "Leve", moderada: "Moderada", grave: "Grave" };
export const ROTULO_SITUACAO_NC: Record<SituacaoNc, string> = { aberta: "Aberta", corrigida: "Aguardando verificação", encerrada: "Encerrada", cancelada: "Cancelada" };
export const ROTULO_RESPOSTA: Record<Resposta, string> = { conforme: "Conforme", nao_conforme: "Não conforme", nao_aplica: "Não se aplica" };
export const ROTULO_ORIGEM_NC: Record<string, string> = { manual: "Fiscalização", inspecao: "Inspeção", ensaio: "Ensaio", seguranca: "Segurança" };
export const PRAZO_PADRAO: Record<Gravidade, number> = { leve: 15, moderada: 7, grave: 3 };

// ---------------------------------------------------------------------------
// Modelos de checklist
// ---------------------------------------------------------------------------
export type ModeloChecklist = { chave: string; area: Area; titulo: string; itens: string[] };

export const MODELOS: ModeloChecklist[] = [
  { chave: "concretagem", area: "qualidade", titulo: "Concretagem", itens: [
    "Fôrmas limpas, estanques, alinhadas e escoradas", "Armadura conforme projeto (bitolas, espaçamento, quantidade)",
    "Cobrimento garantido por espaçadores", "Nota fiscal do concreto com fck e slump conferidos", "Abatimento (slump) medido na obra",
    "Corpos de prova moldados e identificados", "Lançamento e adensamento sem segregação", "Cura iniciada e programada",
  ] },
  { chave: "alvenaria", area: "qualidade", titulo: "Alvenaria", itens: [
    "Blocos conforme especificação", "Prumo e nível dentro da tolerância", "Juntas uniformes e preenchidas", "Amarração com a estrutura (tela ou ferro-cabelo)",
    "Vergas e contravergas executadas", "Encunhamento após o prazo previsto",
  ] },
  { chave: "revestimento", area: "qualidade", titulo: "Revestimento de argamassa", itens: [
    "Base limpa e chapiscada", "Taliscas e mestras conferidas", "Espessura dentro do projeto", "Sem fissuras ou som cavo", "Planeza e prumo conferidos",
  ] },
  { chave: "pintura", area: "qualidade", titulo: "Pintura", itens: [
    "Superfície lixada, limpa e seca", "Selador ou fundo aplicado", "Número de demãos conforme especificação", "Cobertura uniforme, sem manchas ou escorrimentos",
    "Cor e acabamento conforme projeto",
  ] },
  { chave: "pavimentacao", area: "qualidade", titulo: "Pavimentação asfáltica", itens: [
    "Base compactada e liberada pelo ensaio", "Imprimação ou pintura de ligação aplicada", "Temperatura da massa na aplicação conferida",
    "Espessura da camada conferida", "Compactação e acabamento sem desagregação", "Drenagem superficial funcionando",
  ] },
  { chave: "instalacoes", area: "qualidade", titulo: "Instalações hidráulicas e elétricas", itens: [
    "Tubulações conforme projeto", "Teste de estanqueidade realizado", "Eletrodutos e caixas fixados e alinhados", "Circuitos identificados no quadro",
    "Aterramento executado", "Teste de funcionamento realizado",
  ] },
  { chave: "canteiro", area: "seguranca", titulo: "Canteiro e condições gerais (NR-18)", itens: [
    "Área de vivência limpa (sanitários, vestiário, refeitório)", "Canteiro sinalizado e isolado", "Circulação desobstruída", "Extintores sinalizados e dentro da validade",
    "Materiais armazenados com segurança", "Instalações elétricas provisórias protegidas",
  ] },
  { chave: "altura", area: "seguranca", titulo: "Trabalho em altura (NR-35)", itens: [
    "Trabalhadores com treinamento NR-35 válido", "Permissão de trabalho emitida", "Cinto paraquedista e talabarte em uso", "Linha de vida ou ponto de ancoragem instalado",
    "Andaimes montados, travados e com guarda-corpo", "Proteção de periferia e aberturas",
  ] },
  { chave: "escavacao", area: "seguranca", titulo: "Escavação", itens: [
    "Escoramento ou talude conforme projeto", "Material escavado afastado da borda", "Acesso por escada ou rampa", "Sinalização e isolamento da vala",
    "Interferências (redes) identificadas",
  ] },
  { chave: "epi", area: "seguranca", titulo: "Uso de EPI", itens: [
    "Capacete", "Calçado de segurança", "Luvas adequadas à tarefa", "Óculos ou protetor facial", "Protetor auricular onde há ruído", "Uniforme e colete refletivo",
  ] },
];

export const modelo = (chave: string) => MODELOS.find((m) => m.chave === chave) ?? null;

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export type NaoConformidade = {
  id: string; obraId: string; numero: number; area: Area; titulo: string; descricao: string; local: string | null;
  itemServicoId: string | null; itemNumero: string | null; itemDescricao: string | null; contratoNumero: string | null;
  gravidade: Gravidade; impeditiva: boolean; responsavel: string; prazo: string; origem: string; inspecaoId: string | null; inspecaoNumero: number | null;
  ensaioId: string | null; ensaioNumero: number | null; situacao: SituacaoNc;
  correcao: string | null; corrigidaPor: string | null; corrigidaEm: Date | null; verificacao: string | null; encerradaPor: string | null; encerradaEm: Date | null;
  canceladaMotivo: string | null; criadoPor: string | null; criadoEm: Date; vencida: boolean; diasEmAberto: number;
};

const COLUNAS_NC = `n.id, n.obra_id as "obraId", n.numero, n.area, n.titulo, n.descricao, n.local, n.item_servico_id as "itemServicoId",
  i.numero as "itemNumero", i.descricao as "itemDescricao", k.numero as "contratoNumero", n.gravidade, n.impeditiva, n.responsavel,
  to_char(n.prazo, 'YYYY-MM-DD') as prazo, n.origem, n.inspecao_id as "inspecaoId", ins.numero as "inspecaoNumero", n.ensaio_id as "ensaioId", en.numero as "ensaioNumero",
  n.situacao, n.correcao, uc.nome as "corrigidaPor", n.corrigida_em as "corrigidaEm", n.verificacao, ue.nome as "encerradaPor", n.encerrada_em as "encerradaEm",
  n.cancelada_motivo as "canceladaMotivo", ucr.nome as "criadoPor", n.criado_em as "criadoEm",
  (n.situacao in ('aberta', 'corrigida') and n.prazo < hoje_local()) as vencida,
  (coalesce(n.encerrada_em::date, hoje_local()) - n.criado_em::date) as "diasEmAberto"`;
const DE_NC = `from nao_conformidade n left join item_servico i on i.id = n.item_servico_id left join contrato k on k.id = i.contrato_id
  left join inspecao ins on ins.id = n.inspecao_id left join ensaio en on en.id = n.ensaio_id
  left join usuario uc on uc.id = n.corrigida_por left join usuario ue on ue.id = n.encerrada_por left join usuario ucr on ucr.id = n.criado_por`;

export type Inspecao = {
  id: string; obraId: string; numero: number; area: Area; modelo: string; titulo: string; data: string; local: string | null;
  itemServicoId: string | null; itemNumero: string | null; respostas: { pergunta: string; resposta: Resposta; observacao?: string | null }[];
  conformes: number; naoConformes: number; observacao: string | null; criadoPor: string | null; criadoEm: Date; ncs: number;
};
const COLUNAS_INSPECAO = `x.id, x.obra_id as "obraId", x.numero, x.area, x.modelo, x.titulo, to_char(x.data, 'YYYY-MM-DD') as data, x.local,
  x.item_servico_id as "itemServicoId", i.numero as "itemNumero", x.respostas, x.conformes, x.nao_conformes as "naoConformes", x.observacao,
  u.nome as "criadoPor", x.criado_em as "criadoEm", (select count(*)::int from nao_conformidade where inspecao_id = x.id) as ncs`;
const DE_INSPECAO = "from inspecao x left join item_servico i on i.id = x.item_servico_id left join usuario u on u.id = x.criado_por";

export type Ensaio = {
  id: string; numero: number; tipo: string; itemServicoId: string | null; itemNumero: string | null; local: string | null; dataColeta: string; dataResultado: string;
  unidade: string; criterio: "minimo" | "maximo"; especificado: string; resultado: string; aprovado: boolean; laboratorio: string | null; laudo: string | null;
  criadoPor: string | null; ncId: string | null; ncNumero: number | null;
};
const COLUNAS_ENSAIO = `e.id, e.numero, e.tipo, e.item_servico_id as "itemServicoId", i.numero as "itemNumero", e.local, to_char(e.data_coleta, 'YYYY-MM-DD') as "dataColeta",
  to_char(e.data_resultado, 'YYYY-MM-DD') as "dataResultado", e.unidade, e.criterio, trim_scale(e.especificado)::text as especificado,
  trim_scale(e.resultado)::text as resultado, e.aprovado, e.laboratorio, e.laudo, u.nome as "criadoPor",
  n.id as "ncId", n.numero as "ncNumero"`;
const DE_ENSAIO = "from ensaio e left join item_servico i on i.id = e.item_servico_id left join usuario u on u.id = e.criado_por left join nao_conformidade n on n.ensaio_id = e.id";

export const TIPOS_ENSAIO = [
  { tipo: "Resistência à compressão do concreto", unidade: "MPa", criterio: "minimo" as const },
  { tipo: "Abatimento do concreto (slump)", unidade: "mm", criterio: "maximo" as const },
  { tipo: "Grau de compactação", unidade: "%", criterio: "minimo" as const },
  { tipo: "Índice de suporte Califórnia (CBR)", unidade: "%", criterio: "minimo" as const },
  { tipo: "Teor de betume", unidade: "%", criterio: "minimo" as const },
  { tipo: "Resistência de aderência à tração", unidade: "MPa", criterio: "minimo" as const },
];

export type ItemObra = { id: string; numero: string; descricao: string; contratoNumero: string };
export async function itensDaObra(c: PoolClient, obraId: string): Promise<ItemObra[]> {
  return (await c.query(
    `select i.id, i.numero, i.descricao, k.numero as "contratoNumero"
       from item_servico i join contrato k on k.id = i.contrato_id
      where k.obra_id = $1 and k.situacao not in ('rascunho', 'rescindido') and item_vigente(i.id)
      order by k.numero, i.ordem`, [obraId])).rows;
}

export type PainelQualidade = {
  obra: ObraCampo; ncs: NaoConformidade[]; inspecoes: Inspecao[]; ensaios: Ensaio[]; itens: ItemObra[];
  abertas: number; aguardando: number; vencidas: number; impeditivas: number; encerradas: number; tempoMedio: number | null;
  conformidade: number | null; ensaiosReprovados: number;
  podeRegistrar: boolean; podeVerificar: boolean;
};

export async function painelQualidade(a: Ator, obraId: string, area: Area = "qualidade"): Promise<PainelQualidade> {
  exigirVer(a, area === "qualidade" ? "qualidade.ver" : "seguranca.ver");
  return comContexto(ctxCampo(a), async (c) => {
    const obra = await obraNoAcesso(c, a, obraId);
    const ncs = (await c.query(`select ${COLUNAS_NC} ${DE_NC} where n.obra_id = $1 and n.area = $2
      order by case n.situacao when 'aberta' then 0 when 'corrigida' then 1 else 2 end, n.numero desc`, [obraId, area])).rows as NaoConformidade[];
    const inspecoes = (await c.query(`select ${COLUNAS_INSPECAO} ${DE_INSPECAO} where x.obra_id = $1 and x.area = $2 order by x.data desc, x.numero desc`, [obraId, area])).rows as Inspecao[];
    const ensaios = area === "qualidade" ? (await c.query(`select ${COLUNAS_ENSAIO} ${DE_ENSAIO} where e.obra_id = $1 order by e.data_resultado desc, e.numero desc`, [obraId])).rows as Ensaio[] : [];
    const encerradas = ncs.filter((n) => n.situacao === "encerrada");
    const respostas = inspecoes.reduce((s, i) => ({ c: s.c + i.conformes, n: s.n + i.naoConformes }), { c: 0, n: 0 });
    return {
      obra, ncs, inspecoes, ensaios, itens: await itensDaObra(c, obraId),
      abertas: ncs.filter((n) => n.situacao === "aberta").length, aguardando: ncs.filter((n) => n.situacao === "corrigida").length,
      vencidas: ncs.filter((n) => n.vencida).length, impeditivas: ncs.filter((n) => n.impeditiva && (n.situacao === "aberta" || n.situacao === "corrigida")).length,
      encerradas: encerradas.length,
      tempoMedio: encerradas.length ? Math.round((encerradas.reduce((s, n) => s + n.diasEmAberto, 0) / encerradas.length) * 10) / 10 : null,
      conformidade: respostas.c + respostas.n ? (respostas.c / (respostas.c + respostas.n)) * 100 : null,
      ensaiosReprovados: ensaios.filter((e) => !e.aprovado).length,
      podeRegistrar: pode(a, area === "qualidade" ? "qualidade.registrar" : "seguranca.registrar"), podeVerificar: pode(a, "qualidade.verificar"),
    };
  });
}

/** Não conformidades em aberto de todas as obras visíveis. */
export async function ncsEmAberto(a: Ator, area?: Area) {
  exigirVer(a, area === "seguranca" ? "seguranca.ver" : "qualidade.ver");
  return comContexto(ctxCampo(a), async (c) => {
    const v = obrasVisiveis(a, "n.obra_id", area ? 2 : 1);
    return (await c.query(
      `select ${COLUNAS_NC}, o.codigo as "obraCodigo", o.nome as "obraNome" ${DE_NC} join obra o on o.id = n.obra_id
        where n.situacao in ('aberta', 'corrigida') ${area ? "and n.area = $1" : ""} and ${v.sql}
        order by (n.prazo < hoje_local()) desc, n.prazo, n.numero`, area ? [area, ...v.params] : v.params)).rows as (NaoConformidade & { obraCodigo: string; obraNome: string })[];
  });
}

export type NcCompleta = NaoConformidade & {
  obra: ObraCampo; fotosAntes: FotoResumo[]; fotosDepois: FotoResumo[];
  podeCorrigir: boolean; podeVerificar: boolean; podeCancelar: boolean; podeFotoAntes: boolean;
};

export async function obterNc(a: Ator, id: string): Promise<NcCompleta> {
  if (!pode(a, "qualidade.ver") && !pode(a, "seguranca.ver")) exigirVer(a, "qualidade.ver");
  if (!uuid(id)) throw new ErroDeRegra("Não conformidade não encontrada.");
  return comContexto(ctxCampo(a), async (c) => {
    const n = (await c.query(`select ${COLUNAS_NC} ${DE_NC} where n.id = $1`, [id])).rows[0] as NaoConformidade | undefined;
    if (!n) throw new ErroDeRegra("Não conformidade não encontrada.");
    exigirVer(a, n.area === "qualidade" ? "qualidade.ver" : "seguranca.ver");
    const obra = await obraNoAcesso(c, a, n.obraId);
    const fotos = (await c.query(`select ${COLUNAS_FOTO} from foto f left join usuario u on u.id = f.criado_por where f.nao_conformidade_id = $1 order by f.criado_em`, [id])).rows as FotoResumo[];
    const ativa = n.situacao === "aberta" || n.situacao === "corrigida";
    return {
      ...n, obra, fotosAntes: fotos.filter((f) => f.momento !== "depois"), fotosDepois: fotos.filter((f) => f.momento === "depois"),
      podeCorrigir: n.situacao === "aberta" && pode(a, "qualidade.corrigir"),
      podeVerificar: n.situacao === "corrigida" && pode(a, "qualidade.verificar"),
      podeCancelar: n.situacao === "aberta" && pode(a, "qualidade.verificar"),
      podeFotoAntes: ativa && (pode(a, "qualidade.registrar") || pode(a, "qualidade.verificar")),
    };
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export type DadosNc = {
  area?: Area; titulo: string; descricao: string; local?: string | null; itemServicoId?: string | null; gravidade: string;
  impeditiva?: boolean; responsavel: string; prazo?: string | null;
};

function validarNc(d: DadosNc) {
  if (!limpo(d.titulo)) throw new ErroDeRegra("Dê um título à não conformidade.");
  if (!limpo(d.descricao)) throw new ErroDeRegra("Descreva a não conformidade.");
  if (!["leve", "moderada", "grave"].includes(d.gravidade)) throw new ErroDeRegra("Escolha a gravidade.");
  if (!limpo(d.responsavel)) throw new ErroDeRegra("Informe o responsável pela correção.");
  if (d.prazo && !dataValida(d.prazo)) throw new ErroDeRegra("Prazo inválido.");
  if (d.prazo && d.prazo < hoje()) throw new ErroDeRegra("O prazo não pode ser anterior a hoje.");
  if (d.impeditiva && !d.itemServicoId) throw new ErroDeRegra("A não conformidade impeditiva indica o item da planilha que fica travado.");
}

async function inserirNc(c: PoolClient, a: Ator, obraId: string, d: DadosNc, origem: { tipo: string; inspecaoId?: string }) {
  const itens = await itensDaObra(c, obraId);
  if (d.itemServicoId && !itens.some((i) => i.id === d.itemServicoId)) throw new ErroDeRegra("Item da planilha não encontrado nesta obra.");
  const g = d.gravidade as keyof typeof PRAZO_PADRAO;
  return (await c.query(
    `insert into nao_conformidade (orgao_id, obra_id, area, titulo, descricao, local, item_servico_id, gravidade, impeditiva, responsavel, prazo, origem, inspecao_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [a.orgaoId, obraId, d.area ?? "qualidade", limpo(d.titulo), limpo(d.descricao), limpo(d.local), d.itemServicoId || null, d.gravidade,
      !!d.impeditiva, limpo(d.responsavel), d.prazo || somarDias(hoje(), PRAZO_PADRAO[g]), origem.tipo, origem.inspecaoId ?? null])).rows[0].id as string;
}

export async function abrirNc(a: Ator, obraId: string, d: DadosNc): Promise<string> {
  exigir(a, d.area === "seguranca" ? "seguranca.registrar" : "qualidade.registrar");
  validarNc(d);
  return comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    return inserirNc(c, a, obraId, d, { tipo: d.area === "seguranca" ? "seguranca" : "manual" });
  });
}

async function ncNoAcesso(c: PoolClient, a: Ator, id: string) {
  if (!uuid(id)) throw new ErroDeRegra("Não conformidade não encontrada.");
  const n = (await c.query("select id, obra_id, situacao from nao_conformidade where id = $1 for update", [id])).rows[0];
  if (!n) throw new ErroDeRegra("Não conformidade não encontrada.");
  await obraNoAcesso(c, a, n.obra_id);
  return n as { id: string; obra_id: string; situacao: SituacaoNc };
}

export async function corrigirNc(a: Ator, id: string, correcao: string) {
  exigir(a, "qualidade.corrigir");
  if (!limpo(correcao)) throw new ErroDeRegra("Descreva a correção feita.");
  await comContexto(ctxCampo(a), async (c) => {
    const n = await ncNoAcesso(c, a, id);
    if (n.situacao !== "aberta") throw new ErroDeRegra("Só não conformidade aberta recebe correção.");
    await c.query("update nao_conformidade set situacao = 'corrigida', correcao = $2 where id = $1", [id, limpo(correcao)]);
  });
}

/** Verificação do fiscal: aceita (encerra) ou recusa (volta aberta). */
export async function verificarNc(a: Ator, id: string, aceita: boolean, verificacao: string) {
  exigir(a, "qualidade.verificar");
  if (!limpo(verificacao)) throw new ErroDeRegra("Registre o resultado da verificação.");
  await comContexto(ctxCampo(a), async (c) => {
    const n = await ncNoAcesso(c, a, id);
    if (n.situacao !== "corrigida") throw new ErroDeRegra("A verificação é feita depois da correção.");
    if (aceita) {
      const depois = (await c.query("select 1 from foto where nao_conformidade_id = $1 and momento = 'depois'", [id])).rowCount;
      if (!depois) throw new ErroDeRegra("Anexe a foto da correção antes de encerrar.");
      await c.query("update nao_conformidade set situacao = 'encerrada', verificacao = $2 where id = $1", [id, limpo(verificacao)]);
    } else {
      await c.query("update nao_conformidade set situacao = 'aberta', verificacao = $2 where id = $1", [id, `Correção recusada: ${limpo(verificacao)}`]);
    }
  });
}

export async function cancelarNc(a: Ator, id: string, motivo: string) {
  exigir(a, "qualidade.verificar");
  if (!limpo(motivo)) throw new ErroDeRegra("Informe o motivo do cancelamento.");
  await comContexto(ctxCampo(a), async (c) => {
    const n = await ncNoAcesso(c, a, id);
    if (n.situacao !== "aberta") throw new ErroDeRegra("Só não conformidade aberta pode ser cancelada.");
    await c.query("update nao_conformidade set situacao = 'cancelada', cancelada_motivo = $2 where id = $1", [id, limpo(motivo)]);
  });
}

export type DadosInspecao = {
  modelo: string; data: string; local?: string | null; itemServicoId?: string | null; observacao?: string | null;
  respostas: { resposta: string; observacao?: string | null }[];
  abrirNcs?: boolean; responsavel?: string | null;
};

export async function registrarInspecao(a: Ator, obraId: string, d: DadosInspecao): Promise<{ id: string; ncs: number }> {
  const m = modelo(d.modelo);
  if (!m) throw new ErroDeRegra("Escolha o checklist.");
  exigir(a, m.area === "seguranca" ? "seguranca.registrar" : "qualidade.registrar");
  if (!dataValida(d.data) || d.data > hoje()) throw new ErroDeRegra("Data inválida.");
  if (d.respostas.length !== m.itens.length || d.respostas.some((r) => !["conforme", "nao_conforme", "nao_aplica"].includes(r.resposta))) {
    throw new ErroDeRegra("Responda todos os itens do checklist.");
  }
  const respostas = m.itens.map((pergunta, i) => ({ pergunta, resposta: d.respostas[i].resposta, observacao: limpo(d.respostas[i].observacao) }));
  const falhas = respostas.filter((r) => r.resposta === "nao_conforme");
  if (falhas.length && d.abrirNcs && !limpo(d.responsavel)) throw new ErroDeRegra("Informe o responsável pelas correções.");
  return comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    if (d.itemServicoId && !(await itensDaObra(c, obraId)).some((i) => i.id === d.itemServicoId)) throw new ErroDeRegra("Item da planilha não encontrado nesta obra.");
    const r = (await c.query(
      `insert into inspecao (orgao_id, obra_id, area, modelo, titulo, data, local, item_servico_id, respostas, observacao)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, numero`,
      [a.orgaoId, obraId, m.area, m.chave, m.titulo, d.data, limpo(d.local), d.itemServicoId || null, JSON.stringify(respostas), limpo(d.observacao)])).rows[0];
    let ncs = 0;
    if (d.abrirNcs) {
      for (const f of falhas) {
        await inserirNc(c, a, obraId, {
          area: m.area, titulo: f.pergunta, descricao: `${m.titulo}, inspeção nº ${r.numero}${limpo(d.local) ? `, ${limpo(d.local)}` : ""}. ${f.observacao ?? "Item não conforme no checklist."}`,
          local: d.local, itemServicoId: d.itemServicoId || null, gravidade: "moderada", responsavel: d.responsavel!,
        }, { tipo: "inspecao", inspecaoId: r.id });
        ncs++;
      }
    }
    return { id: r.id as string, ncs };
  });
}

export async function obterInspecao(a: Ator, id: string) {
  if (!uuid(id)) throw new ErroDeRegra("Inspeção não encontrada.");
  return comContexto(ctxCampo(a), async (c) => {
    const x = (await c.query(`select ${COLUNAS_INSPECAO} ${DE_INSPECAO} where x.id = $1`, [id])).rows[0] as Inspecao | undefined;
    if (!x) throw new ErroDeRegra("Inspeção não encontrada.");
    exigirVer(a, x.area === "qualidade" ? "qualidade.ver" : "seguranca.ver");
    const obra = await obraNoAcesso(c, a, x.obraId);
    const ncs = (await c.query(`select ${COLUNAS_NC} ${DE_NC} where n.inspecao_id = $1 order by n.numero`, [id])).rows as NaoConformidade[];
    return { ...x, obra, ncsAbertas: ncs };
  });
}

export type DadosEnsaio = {
  tipo: string; itemServicoId?: string | null; local?: string | null; dataColeta: string; dataResultado: string; unidade: string;
  criterio: string; especificado: string; resultado: string; laboratorio?: string | null; laudo?: string | null;
};

export async function registrarEnsaio(a: Ator, obraId: string, d: DadosEnsaio): Promise<{ id: string; aprovado: boolean; ncId: string | null }> {
  exigir(a, "qualidade.registrar");
  if (!limpo(d.tipo)) throw new ErroDeRegra("Informe o ensaio.");
  if (!limpo(d.unidade)) throw new ErroDeRegra("Informe a unidade.");
  if (!dataValida(d.dataColeta) || !dataValida(d.dataResultado) || d.dataResultado < d.dataColeta) throw new ErroDeRegra("Confira as datas de coleta e resultado.");
  if (d.dataResultado > hoje()) throw new ErroDeRegra("A data do resultado não pode ser futura.");
  const esp = lerNumeroBr(d.especificado);
  const res = lerNumeroBr(d.resultado);
  if (esp == null || res == null) throw new ErroDeRegra("Informe o valor especificado e o resultado.");
  return comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    if (d.itemServicoId && !(await itensDaObra(c, obraId)).some((i) => i.id === d.itemServicoId)) throw new ErroDeRegra("Item da planilha não encontrado nesta obra.");
    const r = (await c.query(
      `insert into ensaio (orgao_id, obra_id, tipo, item_servico_id, local, data_coleta, data_resultado, unidade, criterio, especificado, resultado, aprovado, laboratorio, laudo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13) returning id, aprovado`,
      [a.orgaoId, obraId, limpo(d.tipo), d.itemServicoId || null, limpo(d.local), d.dataColeta, d.dataResultado, limpo(d.unidade),
        d.criterio === "maximo" ? "maximo" : "minimo", texto(esp, 4), texto(res, 4), limpo(d.laboratorio), limpo(d.laudo)])).rows[0];
    const nc = (await c.query("select id from nao_conformidade where ensaio_id = $1", [r.id])).rows[0];
    return { id: r.id as string, aprovado: r.aprovado as boolean, ncId: (nc?.id as string) ?? null };
  });
}

/** Itens do contrato com não conformidade impeditiva em aberto (travam a medição). */
export async function impeditivasDoContrato(c: PoolClient, contratoId: string): Promise<Map<string, { id: string; numero: number; titulo: string }>> {
  const r = await c.query(
    `select n.item_servico_id as item, n.id, n.numero, n.titulo from nao_conformidade n join item_servico i on i.id = n.item_servico_id
      where i.contrato_id = $1 and n.impeditiva and n.situacao in ('aberta', 'corrigida') order by n.numero`, [contratoId]);
  const m = new Map<string, { id: string; numero: number; titulo: string }>();
  for (const l of r.rows) if (!m.has(l.item)) m.set(l.item, { id: l.id, numero: l.numero, titulo: l.titulo });
  return m;
}

export const rotuloNc = (n: { numero: number }) => `NC ${String(n.numero).padStart(3, "0")}`;

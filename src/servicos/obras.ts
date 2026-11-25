import { comContexto, ErroDeRegra, type Contexto } from "../lib/db";
import { exigir, pode, SemPermissao, type Quem } from "./permissoes";
import {
  FORMAS_EXECUCAO, PAPEIS, SITUACOES, TIPOS_OBRA,
  type FormaExecucao, type Papel, type Situacao, type TipoObra,
} from "./rotulos";

/** Quem executa a ação: identidade, órgão e perfil. */
export type Ator = Quem & { id: string; orgaoId: string };
const ctx = (a: Ator): Contexto => ({ usuarioId: a.id, orgaoId: a.orgaoId });

export type DadosObra = {
  codigo: string;
  nome: string;
  tipo: TipoObra;
  formaExecucao: FormaExecucao;
  endereco?: string | null;
  municipio?: string | null;
  uf?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  areaM2?: number | null;
  extensaoM?: number | null;
  fonteRecurso?: string | null;
  convenio?: string | null;
  processoAdministrativo?: string | null;
  licitacao?: string | null;
  artNumero?: string | null;
  ordemServicoNumero?: string | null;
  ordemServicoData?: string | null;
  dataInicioPrevista?: string | null;
  dataFimPrevista?: string | null;
};

export type Obra = DadosObra & {
  id: string;
  situacao: Situacao;
  criadoEm: Date;
  alteradoEm: Date | null;
};

export type ResumoObra = Pick<Obra, "id" | "codigo" | "nome" | "tipo" | "formaExecucao" | "municipio" | "uf" | "situacao" | "dataFimPrevista">;

const limpo = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** Confere os dados da obra e devolve os erros por campo. Vazio quer dizer válido. */
export function validarObra(d: DadosObra): Record<string, string> {
  const e: Record<string, string> = {};
  if (!limpo(d.codigo)) e.codigo = "Informe o código da obra.";
  else if (d.codigo.trim().length > 30) e.codigo = "O código pode ter até 30 caracteres.";
  if (!limpo(d.nome)) e.nome = "Informe o nome da obra.";
  if (!TIPOS_OBRA.includes(d.tipo)) e.tipo = "Escolha o tipo da obra.";
  if (!FORMAS_EXECUCAO.includes(d.formaExecucao)) e.formaExecucao = "Escolha a forma de execução.";
  if (d.uf && !/^[A-Za-z]{2}$/.test(d.uf.trim())) e.uf = "A UF tem duas letras.";
  if (d.latitude != null && (Number.isNaN(d.latitude) || d.latitude < -90 || d.latitude > 90)) e.latitude = "Latitude entre -90 e 90.";
  if (d.longitude != null && (Number.isNaN(d.longitude) || d.longitude < -180 || d.longitude > 180)) e.longitude = "Longitude entre -180 e 180.";
  if ((d.latitude == null) !== (d.longitude == null)) e.latitude = e.latitude ?? "Informe latitude e longitude juntas.";
  if (d.areaM2 != null && (Number.isNaN(d.areaM2) || d.areaM2 < 0)) e.areaM2 = "A área não pode ser negativa.";
  if (d.extensaoM != null && (Number.isNaN(d.extensaoM) || d.extensaoM < 0)) e.extensaoM = "A extensão não pode ser negativa.";
  if (d.dataInicioPrevista && d.dataFimPrevista && d.dataFimPrevista < d.dataInicioPrevista)
    e.dataFimPrevista = "O término previsto não pode ser antes do início.";
  if (limpo(d.ordemServicoNumero) && !d.ordemServicoData) e.ordemServicoData = "Informe a data da ordem de serviço.";
  return e;
}

export class DadosInvalidos extends Error {
  constructor(public erros: Record<string, string>) {
    super("Dados inválidos.");
    this.name = "DadosInvalidos";
  }
}

const COLUNAS = `id, codigo, nome, tipo, forma_execucao as "formaExecucao", endereco, municipio, uf,
  latitude::float8 as latitude, longitude::float8 as longitude, area_m2::float8 as "areaM2", extensao_m::float8 as "extensaoM",
  fonte_recurso as "fonteRecurso", convenio, processo_administrativo as "processoAdministrativo", licitacao,
  art_numero as "artNumero", ordem_servico_numero as "ordemServicoNumero",
  to_char(ordem_servico_data, 'YYYY-MM-DD') as "ordemServicoData",
  to_char(data_inicio_prevista, 'YYYY-MM-DD') as "dataInicioPrevista",
  to_char(data_fim_prevista, 'YYYY-MM-DD') as "dataFimPrevista",
  situacao, criado_em as "criadoEm", alterado_em as "alteradoEm"`;

function valores(d: DadosObra) {
  return [
    d.codigo.trim(), d.nome.trim(), d.tipo, d.formaExecucao, limpo(d.endereco), limpo(d.municipio),
    limpo(d.uf)?.toUpperCase() ?? null, d.latitude ?? null, d.longitude ?? null, d.areaM2 ?? null, d.extensaoM ?? null,
    limpo(d.fonteRecurso), limpo(d.convenio), limpo(d.processoAdministrativo), limpo(d.licitacao),
    limpo(d.artNumero), limpo(d.ordemServicoNumero), d.ordemServicoData || null,
    d.dataInicioPrevista || null, d.dataFimPrevista || null,
  ];
}

/** Filtro de visibilidade: direção e administrador veem todas; os demais, só as obras a que estão vinculados. */
function filtroVisibilidade(a: Ator, alias: string, n: number) {
  if (pode(a, "obra.ver_todas")) return { sql: "true", params: [] as unknown[] };
  return {
    sql: `exists (select 1 from vinculo_obra v where v.obra_id = ${alias}.id and v.usuario_id = $${n}
                   and (v.fim is null or v.fim >= current_date))`,
    params: [a.id],
  };
}

export async function criarObra(a: Ator, d: DadosObra): Promise<string> {
  exigir(a, "obra.criar");
  const erros = validarObra(d);
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `insert into obra (orgao_id, codigo, nome, tipo, forma_execucao, endereco, municipio, uf, latitude, longitude,
                         area_m2, extensao_m, fonte_recurso, convenio, processo_administrativo, licitacao,
                         art_numero, ordem_servico_numero, ordem_servico_data, data_inicio_prevista, data_fim_prevista)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`,
      [a.orgaoId, ...valores(d)],
    );
    const id = r.rows[0].id as string;
    // Quem cadastra sem ver todas as obras precisa ficar vinculado, ou perderia a obra de vista.
    if (!pode(a, "obra.ver_todas")) {
      const papel: Papel = a.perfil === "engenheiro" ? "responsavel_tecnico" : "administrativo";
      await c.query("insert into vinculo_obra (orgao_id, obra_id, usuario_id, papel) values ($1,$2,$3,$4)", [a.orgaoId, id, a.id, papel]);
    }
    return id;
  });
}

export async function editarObra(a: Ator, id: string, d: DadosObra): Promise<void> {
  exigir(a, "obra.editar");
  const erros = validarObra(d);
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  await obterObra(a, id);
  await comContexto(ctx(a), async (c) => {
    await c.query(
      `update obra set codigo=$2, nome=$3, tipo=$4, forma_execucao=$5, endereco=$6, municipio=$7, uf=$8, latitude=$9,
              longitude=$10, area_m2=$11, extensao_m=$12, fonte_recurso=$13, convenio=$14, processo_administrativo=$15,
              licitacao=$16, art_numero=$17, ordem_servico_numero=$18, ordem_servico_data=$19,
              data_inicio_prevista=$20, data_fim_prevista=$21
        where id=$1`,
      [id, ...valores(d)],
    );
  });
}

export async function obterObra(a: Ator, id: string): Promise<Obra> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroDeRegra("Obra não encontrada.");
  return comContexto(ctx(a), async (c) => {
    const f = filtroVisibilidade(a, "o", 2);
    const r = await c.query(`select ${COLUNAS} from obra o where o.id = $1 and ${f.sql}`, [id, ...f.params]);
    if (!r.rows[0]) throw new ErroDeRegra("Obra não encontrada ou fora do seu acesso.");
    return r.rows[0] as Obra;
  });
}

export async function listarObras(a: Ator, filtros: { busca?: string; situacao?: string } = {}): Promise<ResumoObra[]> {
  return comContexto(ctx(a), async (c) => {
    const params: unknown[] = [];
    const cond: string[] = [];
    const f = filtroVisibilidade(a, "o", 1);
    cond.push(f.sql);
    params.push(...f.params);
    if (filtros.busca?.trim()) {
      params.push(`%${filtros.busca.trim()}%`);
      cond.push(`(o.nome ilike $${params.length} or o.codigo ilike $${params.length} or o.municipio ilike $${params.length})`);
    }
    if (filtros.situacao && (SITUACOES as readonly string[]).includes(filtros.situacao)) {
      params.push(filtros.situacao);
      cond.push(`o.situacao = $${params.length}`);
    }
    const r = await c.query(
      `select id, codigo, nome, tipo, forma_execucao as "formaExecucao", municipio, uf, situacao,
              to_char(data_fim_prevista, 'YYYY-MM-DD') as "dataFimPrevista"
         from obra o where ${cond.join(" and ")} order by o.criado_em desc, o.codigo`,
      params,
    );
    return r.rows as ResumoObra[];
  });
}

export async function contarPorSituacao(a: Ator): Promise<Record<string, number>> {
  return comContexto(ctx(a), async (c) => {
    const f = filtroVisibilidade(a, "o", 1);
    const r = await c.query(`select situacao, count(*)::int as n from obra o where ${f.sql} group by situacao`, f.params);
    return Object.fromEntries(r.rows.map((l) => [l.situacao, l.n]));
  });
}

export async function mudarSituacao(a: Ator, obraId: string, para: Situacao, documento: string, justificativa?: string | null) {
  exigir(a, "obra.mudar_situacao");
  if (!SITUACOES.includes(para)) throw new ErroDeRegra("Situação inválida.");
  await obterObra(a, obraId);
  await comContexto(ctx(a), (c) => c.query("select mudar_situacao_obra($1, $2, $3, $4)", [obraId, para, documento, justificativa ?? null]));
}

export type Vinculo = { id: string; usuarioId: string; nome: string; papel: Papel; inicio: string; fim: string | null };

export async function listarVinculos(a: Ator, obraId: string): Promise<Vinculo[]> {
  await obterObra(a, obraId);
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `select v.id, v.usuario_id as "usuarioId", u.nome, v.papel, to_char(v.inicio,'YYYY-MM-DD') as inicio, to_char(v.fim,'YYYY-MM-DD') as fim
         from vinculo_obra v join usuario u on u.id = v.usuario_id
        where v.obra_id = $1 and (v.fim is null or v.fim >= current_date) order by v.papel, u.nome`,
      [obraId],
    );
    return r.rows as Vinculo[];
  });
}

export async function vincular(a: Ator, obraId: string, usuarioId: string, papel: Papel) {
  exigir(a, "obra.vincular");
  if (!PAPEIS.includes(papel)) throw new ErroDeRegra("Papel inválido.");
  await obterObra(a, obraId);
  await comContexto(ctx(a), async (c) => {
    const u = await c.query("select 1 from usuario where id = $1 and orgao_id = $2 and ativo", [usuarioId, a.orgaoId]);
    if (!u.rowCount) throw new ErroDeRegra("Usuário não encontrado.");
    await c.query("insert into vinculo_obra (orgao_id, obra_id, usuario_id, papel) values ($1,$2,$3,$4)", [a.orgaoId, obraId, usuarioId, papel]);
  });
}

export async function encerrarVinculo(a: Ator, vinculoId: string) {
  exigir(a, "obra.vincular");
  await comContexto(ctx(a), async (c) => {
    const v = await c.query("select obra_id, papel from vinculo_obra where id = $1 and fim is null", [vinculoId]);
    if (!v.rows[0]) throw new ErroDeRegra("Vínculo não encontrado.");
    if (v.rows[0].papel === "fiscal") {
      const r = await c.query(
        `select o.situacao, (select count(*) from vinculo_obra x where x.obra_id = o.id and x.papel = 'fiscal' and x.fim is null)::int as fiscais
           from obra o where o.id = $1`,
        [v.rows[0].obra_id],
      );
      if (r.rows[0].situacao === "em_execucao" && r.rows[0].fiscais <= 1)
        throw new ErroDeRegra("Uma obra em execução não pode ficar sem fiscal. Vincule o novo fiscal antes de encerrar este.");
    }
    await c.query("update vinculo_obra set fim = current_date where id = $1", [vinculoId]);
  });
}

export type Evento = { id: string; quando: Date; tipo: string; resumo: string; autor: string | null };

export async function linhaDoTempo(a: Ator, obraId: string): Promise<Evento[]> {
  await obterObra(a, obraId);
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `select e.id, e.quando, e.tipo, e.resumo, u.nome as autor
         from obra_evento e left join usuario u on u.id = e.usuario_id
        where e.obra_id = $1 order by e.quando desc, e.id`,
      [obraId],
    );
    return r.rows as Evento[];
  });
}

export async function eventosRecentes(a: Ator, limite = 8): Promise<(Evento & { obraId: string; obraNome: string })[]> {
  return comContexto(ctx(a), async (c) => {
    const f = filtroVisibilidade(a, "o", 1);
    const r = await c.query(
      `select e.id, e.quando, e.tipo, e.resumo, u.nome as autor, o.id as "obraId", o.nome as "obraNome"
         from obra_evento e join obra o on o.id = e.obra_id left join usuario u on u.id = e.usuario_id
        where ${f.sql} order by e.quando desc limit ${Number(limite)}`,
      f.params,
    );
    return r.rows;
  });
}

export { SemPermissao };

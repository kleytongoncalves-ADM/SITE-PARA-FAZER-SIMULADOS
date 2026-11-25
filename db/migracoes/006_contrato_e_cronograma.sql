-- Etapa 3: contrato, planilha contratual e cronograma com linha de base.
--
-- O contrato nasce de um orçamento aprovado. Na assinatura, cada item do
-- orçamento vira um item de serviço da planilha contratual, com o preço da
-- proposta. Contrato assinado e planilha ficam congelados: a mudança vem por
-- aditivo (etapa 5). Execução direta usa o mesmo registro, sem contratada.
--
-- O cronograma tem atividades e dependências. Datas, folgas e caminho crítico
-- são calculados pela aplicação a cada alteração e gravados na atividade. A
-- linha de base congela o cronograma; o avanço físico é registrado sobre ela.

create type tipo_empresa as enum ('contratada', 'fornecedor', 'terceirizada');
create type regime_execucao as enum ('preco_unitario', 'preco_global', 'integral', 'tarefa', 'integrada', 'semi_integrada', 'direta');
create type situacao_contrato as enum ('rascunho', 'vigente', 'encerrado', 'rescindido');
create type executor_item as enum ('contratada', 'equipe_propria');
create type modalidade_garantia as enum ('caucao', 'seguro_garantia', 'fianca_bancaria');
create type situacao_cronograma as enum ('rascunho', 'linha_base', 'substituido');
create type tipo_dependencia as enum ('TI', 'II', 'TT', 'IT');
create type origem_avanco as enum ('manual', 'medicao', 'diario');

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
create table empresa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  razao_social text not null check (btrim(razao_social) <> ''),
  cnpj text not null check (cnpj ~ '^\d{14}$'),
  tipo tipo_empresa not null default 'contratada',
  responsavel text,
  email text,
  telefone text,
  ativa boolean not null default true,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  constraint empresa_cnpj_unico unique (orgao_id, cnpj)
);

-- ---------------------------------------------------------------------------
-- Contrato e planilha contratual
-- ---------------------------------------------------------------------------
create table contrato (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  orcamento_id uuid not null references orcamento(id),
  empresa_id uuid references empresa(id),
  numero text not null check (btrim(numero) <> ''),
  processo text,
  objeto text not null check (btrim(objeto) <> ''),
  regime regime_execucao not null,
  natureza text not null default 'obra_nova' check (natureza in ('obra_nova', 'reforma')),
  desconto numeric(7,4) not null default 0 check (desconto >= 0 and desconto < 100),
  valor_inicial numeric(16,2) not null default 0 check (valor_inicial >= 0),
  data_assinatura date,
  data_ordem_servico date,
  prazo_execucao_dias int check (prazo_execucao_dias > 0),
  vigencia_fim date,
  data_base date,
  indice_reajuste text,
  gestor_id uuid references usuario(id),
  fiscal_id uuid references usuario(id),
  situacao situacao_contrato not null default 'rascunho',
  assinado_por uuid references usuario(id),
  assinado_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  constraint contrato_numero_unico unique (orgao_id, numero),
  check ((regime = 'direta') = (empresa_id is null)),
  check (data_ordem_servico is null or data_assinatura is null or data_ordem_servico >= data_assinatura),
  check (vigencia_fim is null or data_assinatura is null or vigencia_fim >= data_assinatura)
);
create unique index contrato_um_por_orcamento on contrato (orcamento_id) where situacao in ('rascunho', 'vigente');
create index contrato_por_obra on contrato (obra_id);

create table planilha_contratual (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  versao int not null check (versao > 0),
  origem text not null default 'inicial' check (origem in ('inicial', 'aditivo')),
  criada_em timestamptz not null default now(),
  unique (contrato_id, versao)
);

create table item_servico (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  planilha_id uuid not null references planilha_contratual(id),
  orcamento_item_id uuid references orcamento_item(id),
  etapa text not null,
  numero text not null,
  ordem int not null check (ordem > 0),
  fonte fonte_preco not null,
  codigo text,
  descricao text not null,
  unidade text not null,
  quantidade numeric(16,4) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  total numeric(16,2) not null check (total >= 0),
  executor executor_item not null,
  unique (planilha_id, numero)
);
create index item_servico_por_contrato on item_servico (contrato_id);

create table garantia (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  modalidade modalidade_garantia not null,
  valor numeric(16,2) not null check (valor > 0),
  instituicao text,
  documento text,
  inicio date not null,
  vencimento date not null,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (vencimento >= inicio)
);

-- ---------------------------------------------------------------------------
-- Cronograma
-- ---------------------------------------------------------------------------
create table feriado (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid references orgao(id),
  data date not null,
  nome text not null,
  unique nulls not distinct (orgao_id, data)
);

-- Feriados nacionais (2026 a 2028). O órgão acrescenta os estaduais e municipais.
insert into feriado (orgao_id, data, nome) values
  (null, '2026-01-01', 'Confraternização Universal'), (null, '2026-02-16', 'Carnaval'), (null, '2026-02-17', 'Carnaval'),
  (null, '2026-04-03', 'Paixão de Cristo'), (null, '2026-04-21', 'Tiradentes'), (null, '2026-05-01', 'Dia do Trabalho'),
  (null, '2026-06-04', 'Corpus Christi'), (null, '2026-09-07', 'Independência do Brasil'), (null, '2026-10-12', 'Nossa Senhora Aparecida'),
  (null, '2026-11-02', 'Finados'), (null, '2026-11-15', 'Proclamação da República'), (null, '2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  (null, '2026-12-25', 'Natal'),
  (null, '2027-01-01', 'Confraternização Universal'), (null, '2027-02-08', 'Carnaval'), (null, '2027-02-09', 'Carnaval'),
  (null, '2027-03-26', 'Paixão de Cristo'), (null, '2027-04-21', 'Tiradentes'), (null, '2027-05-01', 'Dia do Trabalho'),
  (null, '2027-05-27', 'Corpus Christi'), (null, '2027-09-07', 'Independência do Brasil'), (null, '2027-10-12', 'Nossa Senhora Aparecida'),
  (null, '2027-11-02', 'Finados'), (null, '2027-11-15', 'Proclamação da República'), (null, '2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  (null, '2027-12-25', 'Natal'),
  (null, '2028-01-01', 'Confraternização Universal'), (null, '2028-02-28', 'Carnaval'), (null, '2028-02-29', 'Carnaval'),
  (null, '2028-04-14', 'Paixão de Cristo'), (null, '2028-04-21', 'Tiradentes'), (null, '2028-05-01', 'Dia do Trabalho'),
  (null, '2028-06-15', 'Corpus Christi'), (null, '2028-09-07', 'Independência do Brasil'), (null, '2028-10-12', 'Nossa Senhora Aparecida'),
  (null, '2028-11-02', 'Finados'), (null, '2028-11-15', 'Proclamação da República'), (null, '2028-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  (null, '2028-12-25', 'Natal');

create table cronograma (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  contrato_id uuid not null references contrato(id),
  versao int not null check (versao > 0),
  versao_anterior_id uuid references cronograma(id),
  situacao situacao_cronograma not null default 'rascunho',
  inicio date not null,
  calendario text not null default 'uteis' check (calendario in ('corridos', 'uteis')),
  unidade_periodo text not null default 'semana' check (unidade_periodo in ('semana', 'mes')),
  motivo text,
  linha_base_por uuid references usuario(id),
  linha_base_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (contrato_id, versao)
);
create unique index cronograma_uma_linha_base on cronograma (obra_id) where situacao = 'linha_base';
create unique index cronograma_um_rascunho on cronograma (contrato_id) where situacao = 'rascunho';

create table atividade (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  cronograma_id uuid not null references cronograma(id),
  origem_id uuid references atividade(id),
  ordem int not null check (ordem > 0),
  codigo text not null check (btrim(codigo) <> ''),
  nome text not null check (btrim(nome) <> ''),
  duracao int not null check (duracao between 0 and 3650),
  item_servico_id uuid references item_servico(id),
  parcela numeric(7,4) not null default 100 check (parcela > 0 and parcela <= 100),
  -- Calculados pela aplicação (caminho crítico) a cada alteração do cronograma.
  inicio date,
  fim date,
  folga int,
  critica boolean not null default false,
  unique (cronograma_id, codigo)
);
create index atividade_por_cronograma on atividade (cronograma_id);

create table dependencia (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  atividade_id uuid not null references atividade(id) on delete cascade,
  predecessora_id uuid not null references atividade(id) on delete cascade,
  tipo tipo_dependencia not null default 'TI',
  defasagem int not null default 0 check (defasagem between -365 and 365),
  unique (atividade_id, predecessora_id),
  check (atividade_id <> predecessora_id)
);

-- Avanço físico acumulado da atividade na data. Não se altera nem se exclui.
create table avanco (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  atividade_id uuid not null references atividade(id),
  data date not null,
  percentual numeric(7,4) not null check (percentual between 0 and 100),
  origem origem_avanco not null default 'manual',
  justificativa text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (origem <> 'manual' or coalesce(btrim(justificativa), '') <> '')
);
create index avanco_por_atividade on avanco (atividade_id, data);

-- ---------------------------------------------------------------------------
-- Isolamento por órgão
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['empresa', 'contrato', 'planilha_contratual', 'item_servico', 'garantia', 'cronograma', 'atividade', 'dependencia', 'avanco'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

alter table feriado enable row level security; alter table feriado force row level security;
create policy feriado_leitura on feriado for select using (orgao_id is null or orgao_id = ctx_orgao());
create policy feriado_escrita on feriado for all using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao());

create trigger empresa_carimbo before insert or update on empresa for each row execute function carimbar();
create trigger contrato_carimbo before insert or update on contrato for each row execute function carimbar();
create trigger cronograma_carimbo before insert or update on cronograma for each row execute function carimbar();
create trigger garantia_carimbo before insert on garantia for each row execute function carimbar();
create trigger avanco_carimbo before insert on avanco for each row execute function carimbar();
create trigger empresa_auditoria after insert or update on empresa for each row execute function auditar();
create trigger contrato_auditoria after insert or update on contrato for each row execute function auditar();
create trigger garantia_auditoria after insert or update on garantia for each row execute function auditar();
create trigger cronograma_auditoria after insert or update on cronograma for each row execute function auditar();
create trigger atividade_auditoria after insert or update on atividade for each row execute function auditar();
create trigger avanco_auditoria after insert on avanco for each row execute function auditar();

create trigger empresa_sem_exclusao before delete on empresa for each row execute function proibir_exclusao();
create trigger contrato_sem_exclusao before delete on contrato for each row execute function proibir_exclusao();
create trigger planilha_sem_exclusao before delete on planilha_contratual for each row execute function proibir_exclusao();
create trigger garantia_sem_exclusao before delete on garantia for each row execute function proibir_exclusao();
create trigger cronograma_sem_exclusao before delete on cronograma for each row execute function proibir_exclusao();
create trigger avanco_sem_exclusao before delete on avanco for each row execute function proibir_exclusao();
create trigger avanco_sem_alteracao before update on avanco for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Contrato assinado é congelado
-- ---------------------------------------------------------------------------
-- Depois de assinado, só mudam gestor, fiscal e a situação (encerrar ou rescindir).
create function proteger_contrato() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.situacao = 'rascunho' then
    if new.situacao not in ('rascunho', 'vigente') then
      raise exception 'Contrato em elaboração só pode ser assinado.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'situacao' - 'gestor_id' - 'fiscal_id' - 'alterado_por' - 'alterado_em')
     is distinct from (to_jsonb(old) - 'situacao' - 'gestor_id' - 'fiscal_id' - 'alterado_por' - 'alterado_em') then
    raise exception 'Contrato assinado não pode ser alterado. A mudança é feita por aditivo ou apostilamento.' using errcode = 'P0001';
  end if;
  if new.situacao is distinct from old.situacao and not (old.situacao = 'vigente' and new.situacao in ('encerrado', 'rescindido')) then
    raise exception 'Mudança de situação do contrato não permitida.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger contrato_protegido before update on contrato for each row execute function proteger_contrato();

create function exigir_contrato_em_rascunho() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_contrato;
begin
  select situacao into s from contrato where id = coalesce(new.contrato_id, old.contrato_id);
  if s is distinct from 'rascunho' then
    raise exception 'Contrato assinado não pode ser alterado. A mudança é feita por aditivo ou apostilamento.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger item_servico_congelado before insert or update or delete on item_servico for each row execute function exigir_contrato_em_rascunho();
create trigger planilha_congelada before insert or update on planilha_contratual for each row execute function exigir_contrato_em_rascunho();

-- O contrato tem de vir de um orçamento aprovado da mesma obra.
create function validar_contrato() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare o orcamento%rowtype;
begin
  select * into o from orcamento where id = new.orcamento_id;
  if o.obra_id is distinct from new.obra_id then
    raise exception 'O orçamento não é desta obra.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and o.situacao <> 'aprovado' then
    raise exception 'O contrato precisa de um orçamento aprovado.' using errcode = 'P0001';
  end if;
  if new.situacao = 'vigente' and (tg_op = 'INSERT' or old.situacao = 'rascunho') then
    if new.data_assinatura is null or new.prazo_execucao_dias is null or new.vigencia_fim is null then
      raise exception 'Para assinar, informe data de assinatura, prazo de execução e fim da vigência.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from item_servico where contrato_id = new.id) then
      raise exception 'A planilha contratual está vazia.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger contrato_valida before insert or update on contrato for each row execute function validar_contrato();

create function evento_contrato() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare rotulo_c text := case when new.regime = 'direta' then 'Execução direta ' else 'Contrato ' end || new.numero;
begin
  if tg_op = 'INSERT' then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'contrato', rotulo_c || ' cadastrado.', ctx_usuario());
  elsif new.situacao is distinct from old.situacao then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'contrato',
            rotulo_c || ' ' || case new.situacao when 'vigente' then 'assinado' when 'encerrado' then 'encerrado'
              when 'rescindido' then 'rescindido' else 'alterado' end || '.', ctx_usuario());
  end if;
  return new;
end $$;
create trigger contrato_evento after insert or update on contrato for each row execute function evento_contrato();

-- ---------------------------------------------------------------------------
-- Linha de base é congelada
-- ---------------------------------------------------------------------------
create function proteger_cronograma() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.situacao = 'rascunho' then
    if new.situacao = 'substituido' then
      raise exception 'Mudança de situação do cronograma não permitida.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'situacao' - 'alterado_por' - 'alterado_em') is distinct from (to_jsonb(old) - 'situacao' - 'alterado_por' - 'alterado_em')
     or not (old.situacao = 'linha_base' and new.situacao = 'substituido') then
    raise exception 'A linha de base não pode ser alterada. Crie uma nova versão do cronograma.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cronograma_protegido before update on cronograma for each row execute function proteger_cronograma();

create function exigir_cronograma_em_rascunho() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  alvo uuid;
  s situacao_cronograma;
begin
  if tg_table_name = 'dependencia' then
    select cronograma_id into alvo from atividade where id = coalesce(new.atividade_id, old.atividade_id);
    if alvo is null then return coalesce(new, old); end if; -- atividade já excluída junto (cascata)
  else
    alvo := coalesce(new.cronograma_id, old.cronograma_id);
  end if;
  select situacao into s from cronograma where id = alvo;
  if s is distinct from 'rascunho' then
    raise exception 'A linha de base não pode ser alterada. Crie uma nova versão do cronograma.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger atividade_congelada before insert or update or delete on atividade for each row execute function exigir_cronograma_em_rascunho();
create trigger dependencia_congelada before insert or update or delete on dependencia for each row execute function exigir_cronograma_em_rascunho();

-- Avanço só na linha de base em vigor, sem voltar para trás.
create function validar_avanco() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  s situacao_cronograma;
  ini date;
  anterior numeric;
  posterior numeric;
begin
  select c.situacao, c.inicio into s, ini from atividade a join cronograma c on c.id = a.cronograma_id where a.id = new.atividade_id;
  if s is distinct from 'linha_base' then
    raise exception 'O avanço é registrado na linha de base em vigor.' using errcode = 'P0001';
  end if;
  if new.data < ini then
    raise exception 'A data do avanço é anterior ao início do cronograma.' using errcode = 'P0001';
  end if;
  if new.data > current_date + 1 and coalesce(current_setting('app.copiando_avanco', true), '') <> 'sim' then
    raise exception 'A data do avanço não pode ser futura.' using errcode = 'P0001';
  end if;
  select percentual into anterior from avanco where atividade_id = new.atividade_id and data <= new.data order by data desc, criado_em desc limit 1;
  select percentual into posterior from avanco where atividade_id = new.atividade_id and data > new.data order by data, criado_em limit 1;
  if new.percentual < coalesce(anterior, 0) then
    raise exception 'O avanço acumulado não pode ser menor que o registrado antes (% %%).', replace(trim_scale(anterior)::text, '.', ',') using errcode = 'P0001';
  end if;
  if posterior is not null and new.percentual > posterior then
    raise exception 'Já existe avanço menor registrado em data posterior (% %%).', replace(trim_scale(posterior)::text, '.', ',') using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger avanco_valida before insert on avanco for each row execute function validar_avanco();

create function evento_cronograma() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.situacao = 'linha_base' and old.situacao = 'rascunho' then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'cronograma',
            'Linha de base do cronograma gravada (versão ' || new.versao || ')' ||
            case when new.motivo is not null then ': ' || new.motivo else '' end || '.', ctx_usuario());
  end if;
  return new;
end $$;
create trigger cronograma_evento after update on cronograma for each row execute function evento_cronograma();

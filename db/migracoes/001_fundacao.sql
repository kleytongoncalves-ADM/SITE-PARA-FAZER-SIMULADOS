-- Etapa 1 (Fundação): órgão, usuários, perfis, obras, vínculos, linha do tempo e auditoria.
-- As regras de integridade ficam no banco: isolamento por órgão, histórico imutável
-- e mudança de situação da obra só pela função mudar_situacao_obra.

create type perfil_usuario as enum (
  'direcao', 'gestor_contrato', 'engenheiro', 'fiscal',
  'administrativo', 'financeiro', 'campo', 'contratada'
);

create type tipo_obra as enum (
  'edificacao', 'pavimentacao', 'saneamento', 'reforma', 'urbanizacao', 'outro'
);

create type forma_execucao as enum ('direta', 'contratada', 'mista');

create type situacao_obra as enum (
  'em_estudo', 'orcada', 'licitada', 'contratada', 'em_execucao', 'paralisada',
  'concluida', 'recebida_provisoriamente', 'recebida_definitivamente', 'cancelada'
);

create type papel_na_obra as enum (
  'gestor_contrato', 'fiscal', 'responsavel_tecnico', 'campo',
  'contratada', 'administrativo', 'financeiro'
);

create type regra_arredondamento as enum ('arredondar', 'truncar');
create type regime_sinapi as enum ('desonerado', 'nao_desonerado');

-- Contexto da requisição, gravado pela aplicação no início de cada transação.
create function ctx_orgao() returns uuid language sql stable as
$$ select nullif(current_setting('app.orgao_id', true), '')::uuid $$;

create function ctx_usuario() returns uuid language sql stable as
$$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

create table orgao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null unique,
  esfera text not null check (esfera in ('municipal', 'estadual', 'federal', 'empresa_publica')),
  uf char(2) not null,
  municipio text,
  arredondamento regra_arredondamento not null default 'arredondar',
  regime_sinapi_padrao regime_sinapi not null default 'nao_desonerado',
  criado_em timestamptz not null default now()
);

create table unidade (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  nome text not null,
  sigla text not null,
  criado_em timestamptz not null default now(),
  unique (orgao_id, sigla)
);

create table usuario (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  unidade_id uuid references unidade(id),
  nome text not null,
  email text not null,
  cpf text,
  registro_profissional text,
  perfil perfil_usuario not null,
  administrador boolean not null default false,
  senha_hash text not null,
  ativo boolean not null default true,
  tentativas_falhas int not null default 0,
  bloqueado_ate timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz
);
create unique index usuario_email_unico on usuario (lower(email));

create table sessao (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  usuario_id uuid not null references usuario(id),
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create table obra (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  unidade_id uuid references unidade(id),
  codigo text not null,
  nome text not null,
  tipo tipo_obra not null,
  forma_execucao forma_execucao not null,
  endereco text,
  municipio text,
  uf char(2),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  area_m2 numeric(14,2) check (area_m2 >= 0),
  extensao_m numeric(14,2) check (extensao_m >= 0),
  fonte_recurso text,
  convenio text,
  processo_administrativo text,
  licitacao text,
  art_numero text,
  ordem_servico_numero text,
  ordem_servico_data date,
  data_inicio_prevista date,
  data_fim_prevista date,
  situacao situacao_obra not null default 'em_estudo',
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (orgao_id, codigo),
  check (data_fim_prevista is null or data_inicio_prevista is null or data_fim_prevista >= data_inicio_prevista)
);

create table vinculo_obra (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  usuario_id uuid not null references usuario(id),
  papel papel_na_obra not null,
  inicio date not null default current_date,
  fim date,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create unique index vinculo_ativo_unico on vinculo_obra (obra_id, usuario_id, papel) where fim is null;

create table obra_mudanca_situacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  de situacao_obra not null,
  para situacao_obra not null,
  documento text not null,
  justificativa text,
  usuario_id uuid references usuario(id),
  criado_em timestamptz not null default now()
);

create table obra_evento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  quando timestamptz not null default now(),
  tipo text not null,
  resumo text not null,
  usuario_id uuid references usuario(id)
);
create index obra_evento_por_obra on obra_evento (obra_id, quando desc);

create table auditoria (
  id bigint generated always as identity primary key,
  orgao_id uuid references orgao(id),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criou', 'alterou')),
  campo text,
  valor_anterior text,
  valor_novo text,
  usuario_id uuid,
  quando timestamptz not null default now()
);
create index auditoria_por_registro on auditoria (tabela, registro_id, quando desc);

-- ---------------------------------------------------------------------------
-- Histórico imutável: nada se apaga, e os registros de histórico não mudam.
-- ---------------------------------------------------------------------------
create function proibir_exclusao() returns trigger language plpgsql as $$
begin
  raise exception 'Registros de % não podem ser excluídos. Cancele ou corrija com um novo lançamento.', tg_table_name
    using errcode = 'P0001';
end $$;

create function proibir_alteracao() returns trigger language plpgsql as $$
begin
  raise exception 'Registros de % são históricos e não podem ser alterados.', tg_table_name
    using errcode = 'P0001';
end $$;

create trigger obra_sem_exclusao before delete on obra for each row execute function proibir_exclusao();
create trigger usuario_sem_exclusao before delete on usuario for each row execute function proibir_exclusao();
create trigger vinculo_sem_exclusao before delete on vinculo_obra for each row execute function proibir_exclusao();
create trigger mudanca_sem_exclusao before delete on obra_mudanca_situacao for each row execute function proibir_exclusao();
create trigger evento_sem_exclusao before delete on obra_evento for each row execute function proibir_exclusao();
create trigger auditoria_sem_exclusao before delete on auditoria for each row execute function proibir_exclusao();
create trigger mudanca_sem_alteracao before update on obra_mudanca_situacao for each row execute function proibir_alteracao();
create trigger evento_sem_alteracao before update on obra_evento for each row execute function proibir_alteracao();
create trigger auditoria_sem_alteracao before update on auditoria for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Quem alterou e quando, preenchido pelo banco.
-- ---------------------------------------------------------------------------
create function carimbar() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, ctx_usuario());
  else
    new.alterado_por := ctx_usuario();
    new.alterado_em := now();
  end if;
  return new;
end $$;

create trigger obra_carimbo before insert or update on obra for each row execute function carimbar();
create trigger usuario_carimbo before insert or update on usuario for each row execute function carimbar();

-- ---------------------------------------------------------------------------
-- Trilha de auditoria: uma linha por campo alterado, com o valor anterior.
-- ---------------------------------------------------------------------------
create function auditar() returns trigger language plpgsql as $$
declare
  antes jsonb;
  depois jsonb := to_jsonb(new);
  chave text;
  ignorados text[] := array['alterado_em', 'alterado_por', 'criado_em', 'criado_por', 'tentativas_falhas', 'bloqueado_ate'];
  sigilosos text[] := array['senha_hash'];
begin
  if tg_op = 'INSERT' then
    insert into auditoria (orgao_id, tabela, registro_id, acao, usuario_id)
    values (new.orgao_id, tg_table_name, new.id, 'criou', ctx_usuario());
    return new;
  end if;
  antes := to_jsonb(old);
  for chave in select jsonb_object_keys(depois) loop
    if chave = any(ignorados) then continue; end if;
    if antes -> chave is distinct from depois -> chave then
      insert into auditoria (orgao_id, tabela, registro_id, acao, campo, valor_anterior, valor_novo, usuario_id)
      values (
        new.orgao_id, tg_table_name, new.id, 'alterou', chave,
        case when chave = any(sigilosos) then '(protegido)' else antes ->> chave end,
        case when chave = any(sigilosos) then '(protegido)' else depois ->> chave end,
        ctx_usuario()
      );
    end if;
  end loop;
  return new;
end $$;

create trigger obra_auditoria after insert or update on obra for each row execute function auditar();
create trigger usuario_auditoria after insert or update on usuario for each row execute function auditar();
create trigger vinculo_auditoria after insert or update on vinculo_obra for each row execute function auditar();

-- ---------------------------------------------------------------------------
-- Situação da obra: sequência fixa, cada mudança com o documento que a justifica.
-- ---------------------------------------------------------------------------
create function transicao_permitida(de situacao_obra, para situacao_obra, forma forma_execucao)
returns boolean language sql immutable as $$
  select case de
    when 'em_estudo' then para in ('orcada', 'cancelada')
    when 'orcada' then para in ('licitada', 'em_estudo', 'cancelada')
      or (para = 'em_execucao' and forma = 'direta')
    when 'licitada' then para in ('contratada', 'cancelada')
    when 'contratada' then para in ('em_execucao', 'cancelada')
    when 'em_execucao' then para in ('paralisada', 'concluida')
    when 'paralisada' then para in ('em_execucao', 'cancelada')
    when 'concluida' then para in ('recebida_provisoriamente')
    when 'recebida_provisoriamente' then para in ('recebida_definitivamente')
    else false
  end
$$;

-- Rótulos legíveis para os textos gerados pelo banco.
create function rotulo(s situacao_obra) returns text language sql immutable as $$
  select case s
    when 'em_estudo' then 'Em estudo' when 'orcada' then 'Orçada' when 'licitada' then 'Licitada'
    when 'contratada' then 'Contratada' when 'em_execucao' then 'Em execução' when 'paralisada' then 'Paralisada'
    when 'concluida' then 'Concluída' when 'recebida_provisoriamente' then 'Recebida provisoriamente'
    when 'recebida_definitivamente' then 'Recebida definitivamente' when 'cancelada' then 'Cancelada'
  end
$$;

create function rotulo(p papel_na_obra) returns text language sql immutable as $$
  select case p
    when 'gestor_contrato' then 'gestor do contrato' when 'fiscal' then 'fiscal'
    when 'responsavel_tecnico' then 'responsável técnico' when 'campo' then 'equipe de campo'
    when 'contratada' then 'representante da contratada' when 'administrativo' then 'administrativo'
    when 'financeiro' then 'financeiro'
  end
$$;

create function proteger_situacao() returns trigger language plpgsql as $$
begin
  if new.situacao is distinct from old.situacao
     and coalesce(current_setting('app.mudando_situacao', true), '') <> 'sim' then
    raise exception 'A situação da obra só muda pelo fluxo de mudança de situação, com o documento que a justifica.'
      using errcode = 'P0001';
  end if;
  if new.orgao_id is distinct from old.orgao_id then
    raise exception 'A obra não pode trocar de órgão.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger obra_protege_situacao before update on obra for each row execute function proteger_situacao();

create function mudar_situacao_obra(p_obra uuid, p_para situacao_obra, p_documento text, p_justificativa text default null)
returns void language plpgsql as $$
declare
  o obra%rowtype;
begin
  select * into o from obra where id = p_obra for update;
  if not found then
    raise exception 'Obra não encontrada.' using errcode = 'P0001';
  end if;
  if not transicao_permitida(o.situacao, p_para, o.forma_execucao) then
    raise exception 'A obra não pode passar de "%" para "%".', rotulo(o.situacao), rotulo(p_para) using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_documento), '') = '' then
    raise exception 'Informe o documento que justifica a mudança de situação.' using errcode = 'P0001';
  end if;
  if p_para in ('paralisada', 'cancelada') and coalesce(btrim(p_justificativa), '') = '' then
    raise exception 'Informe o motivo da paralisação ou do cancelamento.' using errcode = 'P0001';
  end if;
  if p_para = 'em_execucao' then
    if coalesce(btrim(o.ordem_servico_numero), '') = '' or o.ordem_servico_data is null then
      raise exception 'Para iniciar a execução, registre o número e a data da ordem de serviço.' using errcode = 'P0001';
    end if;
    if coalesce(btrim(o.art_numero), '') = '' then
      raise exception 'Para iniciar a execução, registre a ART ou RRT da obra.' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from vinculo_obra v
      where v.obra_id = o.id and v.papel = 'fiscal' and (v.fim is null or v.fim >= current_date)
    ) then
      raise exception 'Para iniciar a execução, a obra precisa de um fiscal vinculado.' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('app.mudando_situacao', 'sim', true);
  update obra set situacao = p_para where id = o.id;
  perform set_config('app.mudando_situacao', '', true);

  insert into obra_mudanca_situacao (orgao_id, obra_id, de, para, documento, justificativa, usuario_id)
  values (o.orgao_id, o.id, o.situacao, p_para, btrim(p_documento), nullif(btrim(p_justificativa), ''), ctx_usuario());

  insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
  values (o.orgao_id, o.id, 'situacao',
          'Situação alterada de "' || rotulo(o.situacao) || '" para "' || rotulo(p_para) || '". Documento: ' || btrim(p_documento),
          ctx_usuario());
end $$;

-- Eventos automáticos da linha do tempo.
create function evento_obra_criada() returns trigger language plpgsql as $$
begin
  insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
  values (new.orgao_id, new.id, 'cadastro', 'Obra cadastrada.', ctx_usuario());
  return new;
end $$;
create trigger obra_evento_criacao after insert on obra for each row execute function evento_obra_criada();

create function evento_vinculo() returns trigger language plpgsql as $$
declare
  nome_usuario text;
begin
  select nome into nome_usuario from usuario where id = new.usuario_id;
  if tg_op = 'INSERT' then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'equipe', nome_usuario || ' vinculado como ' || rotulo(new.papel) || '.', ctx_usuario());
  elsif new.fim is distinct from old.fim and new.fim is not null then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'equipe', nome_usuario || ' deixou o papel de ' || rotulo(new.papel) || '.', ctx_usuario());
  end if;
  return new;
end $$;
create trigger vinculo_evento after insert or update on vinculo_obra for each row execute function evento_vinculo();

-- O vínculo só liga usuário e obra do mesmo órgão.
create function validar_vinculo() returns trigger language plpgsql as $$
begin
  if (select orgao_id from obra where id = new.obra_id) is distinct from new.orgao_id
     or (select orgao_id from usuario where id = new.usuario_id) is distinct from new.orgao_id then
    raise exception 'Usuário e obra precisam ser do mesmo órgão.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger vinculo_valida before insert or update on vinculo_obra for each row execute function validar_vinculo();

-- ---------------------------------------------------------------------------
-- Isolamento por órgão no próprio banco (vale também para o dono das tabelas).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['unidade', 'obra', 'vinculo_obra', 'obra_mudanca_situacao', 'obra_evento', 'auditoria'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

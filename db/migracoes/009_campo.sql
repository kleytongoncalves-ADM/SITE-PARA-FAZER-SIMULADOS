-- Etapa 6: campo. Diário de obra, fotos, qualidade e segurança do trabalho.
--
-- Diário: um por obra por dia. Em elaboração aceita efetivo, equipamentos,
-- serviços, ocorrências e fotos; assinado pelo responsável técnico, fica
-- congelado e recebe só complementos e o visto do fiscal. Os serviços com
-- percentual lançam o avanço da atividade na linha de base ao assinar.
--
-- Qualidade: não conformidade com gravidade, prazo e evidência antes e depois;
-- só encerra com a verificação do fiscal. A impeditiva trava a medição do
-- item. Ensaio fora do especificado abre não conformidade sozinho.
--
-- Segurança: ocorrências (acidente, quase acidente, risco grave), entrega de
-- EPI e inspeções por checklist. Paralisação de frente vai para o diário.

create type clima as enum ('bom', 'nublado', 'chuva_fraca', 'chuva_forte');
create type condicao_trabalho as enum ('praticavel', 'parcial', 'impraticavel');
create type situacao_diario as enum ('rascunho', 'assinado');
create type motivo_paralisacao as enum ('chuva', 'falta_frente', 'falta_material', 'falta_mao_de_obra', 'embargo', 'pagamento', 'seguranca', 'outro');
create type gravidade_nc as enum ('leve', 'moderada', 'grave');
create type situacao_nc as enum ('aberta', 'corrigida', 'encerrada', 'cancelada');
create type tipo_ocorrencia_seguranca as enum ('acidente_com_afastamento', 'acidente_sem_afastamento', 'quase_acidente', 'risco_grave');

create function hoje_local() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Numeração sequencial por obra (trava a obra para não repetir número).
create function numerar_por_obra() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.numero is null then
    perform 1 from obra where id = new.obra_id for update;
    execute format('select coalesce(max(numero), 0) + 1 from %I where obra_id = $1', tg_table_name) into new.numero using new.obra_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Diário de obra
-- ---------------------------------------------------------------------------
create table diario (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  data date not null,
  clima_manha clima not null default 'bom',
  clima_tarde clima not null default 'bom',
  condicao condicao_trabalho not null default 'praticavel',
  relato text,
  situacao situacao_diario not null default 'rascunho',
  assinado_por uuid references usuario(id),
  assinado_em timestamptz,
  visto_por uuid references usuario(id),
  visto_em timestamptz,
  visto_observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, data),
  unique (obra_id, numero),
  check (situacao <> 'assinado' or (assinado_por is not null and assinado_em is not null)),
  check (visto_em is null or situacao = 'assinado')
);
create index diario_por_obra on diario (obra_id, data desc);

create table diario_efetivo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  diario_id uuid not null references diario(id),
  funcao text not null check (btrim(funcao) <> ''),
  empresa text,
  quantidade int not null check (quantidade between 1 and 2000)
);
create index diario_efetivo_por_diario on diario_efetivo (diario_id);

create table diario_equipamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  diario_id uuid not null references diario(id),
  descricao text not null check (btrim(descricao) <> ''),
  quantidade int not null default 1 check (quantidade between 1 and 500),
  horas numeric(5,1) check (horas between 0 and 24)
);
create index diario_equipamento_por_diario on diario_equipamento (diario_id);

create table diario_servico (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  diario_id uuid not null references diario(id),
  atividade_id uuid references atividade(id),
  descricao text not null check (btrim(descricao) <> ''),
  local text,
  avanco_pct numeric(7,4) check (avanco_pct between 0 and 100),
  check (avanco_pct is null or atividade_id is not null)
);
create index diario_servico_por_diario on diario_servico (diario_id);

create table diario_ocorrencia (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  diario_id uuid not null references diario(id),
  tipo text not null check (tipo in ('ocorrencia', 'visita', 'paralisacao')),
  motivo motivo_paralisacao,
  horas numeric(4,1),
  descricao text not null check (btrim(descricao) <> ''),
  ocorrencia_seguranca_id uuid,
  check (tipo <> 'paralisacao' or (motivo is not null and horas > 0 and horas <= 24)),
  check (tipo = 'paralisacao' or (motivo is null and horas is null))
);
create index diario_ocorrencia_por_diario on diario_ocorrencia (diario_id);

create table diario_complemento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  diario_id uuid not null references diario(id),
  texto text not null check (btrim(texto) <> ''),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index diario_complemento_por_diario on diario_complemento (diario_id);

-- ---------------------------------------------------------------------------
-- Qualidade
-- ---------------------------------------------------------------------------
create table inspecao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  area text not null check (area in ('qualidade', 'seguranca')),
  modelo text not null,
  titulo text not null check (btrim(titulo) <> ''),
  data date not null,
  local text,
  item_servico_id uuid references item_servico(id),
  -- [{ "pergunta": text, "resposta": "conforme" | "nao_conforme" | "nao_aplica", "observacao": text }]
  respostas jsonb not null check (jsonb_typeof(respostas) = 'array' and jsonb_array_length(respostas) > 0),
  conformes int not null default 0,
  nao_conformes int not null default 0,
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (obra_id, numero)
);
create index inspecao_por_obra on inspecao (obra_id, data desc);

create table ensaio (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  tipo text not null check (btrim(tipo) <> ''),
  item_servico_id uuid references item_servico(id),
  local text,
  data_coleta date not null,
  data_resultado date not null,
  unidade text not null check (btrim(unidade) <> ''),
  criterio text not null default 'minimo' check (criterio in ('minimo', 'maximo')),
  especificado numeric(14,4) not null,
  resultado numeric(14,4) not null,
  aprovado boolean not null,
  laboratorio text,
  laudo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (obra_id, numero),
  check (data_resultado >= data_coleta)
);
create index ensaio_por_obra on ensaio (obra_id, data_resultado desc);

create table nao_conformidade (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  area text not null default 'qualidade' check (area in ('qualidade', 'seguranca')),
  titulo text not null check (btrim(titulo) <> ''),
  descricao text not null check (btrim(descricao) <> ''),
  local text,
  item_servico_id uuid references item_servico(id),
  gravidade gravidade_nc not null,
  impeditiva boolean not null default false,
  responsavel text not null check (btrim(responsavel) <> ''),
  prazo date not null,
  origem text not null default 'manual' check (origem in ('manual', 'inspecao', 'ensaio', 'seguranca')),
  inspecao_id uuid references inspecao(id),
  ensaio_id uuid references ensaio(id),
  situacao situacao_nc not null default 'aberta',
  correcao text,
  corrigida_por uuid references usuario(id),
  corrigida_em timestamptz,
  verificacao text,
  encerrada_por uuid references usuario(id),
  encerrada_em timestamptz,
  cancelada_motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero),
  check (not impeditiva or item_servico_id is not null),
  check (situacao not in ('corrigida', 'encerrada') or coalesce(btrim(correcao), '') <> ''),
  check (situacao <> 'encerrada' or (coalesce(btrim(verificacao), '') <> '' and encerrada_por is not null)),
  check (situacao <> 'cancelada' or coalesce(btrim(cancelada_motivo), '') <> '')
);
create index nc_por_obra on nao_conformidade (obra_id, situacao);
create index nc_impeditiva on nao_conformidade (item_servico_id) where impeditiva and situacao in ('aberta', 'corrigida');

-- ---------------------------------------------------------------------------
-- Segurança do trabalho
-- ---------------------------------------------------------------------------
create table ocorrencia_seguranca (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  tipo tipo_ocorrencia_seguranca not null,
  data date not null,
  hora time,
  local text,
  descricao text not null check (btrim(descricao) <> ''),
  envolvido text,
  empresa text,
  dias_afastamento int check (dias_afastamento >= 0),
  cat text,
  paralisacao boolean not null default false,
  horas_paralisadas numeric(4,1),
  acao_corretiva text not null check (btrim(acao_corretiva) <> ''),
  responsavel text not null check (btrim(responsavel) <> ''),
  prazo date not null,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'encerrada')),
  encerramento text,
  encerrada_por uuid references usuario(id),
  encerrada_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero),
  check (not paralisacao or (horas_paralisadas > 0 and horas_paralisadas <= 24)),
  check (situacao <> 'encerrada' or (coalesce(btrim(encerramento), '') <> '' and encerrada_por is not null))
);
create index ocorrencia_seg_por_obra on ocorrencia_seguranca (obra_id, data desc);
alter table diario_ocorrencia add constraint diario_ocorrencia_seguranca_fk foreign key (ocorrencia_seguranca_id) references ocorrencia_seguranca(id);

create table entrega_epi (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  data date not null,
  trabalhador text not null check (btrim(trabalhador) <> ''),
  funcao text,
  empresa text,
  epi text not null check (btrim(epi) <> ''),
  ca text,
  quantidade int not null default 1 check (quantidade between 1 and 500),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index entrega_epi_por_obra on entrega_epi (obra_id, data desc);

-- ---------------------------------------------------------------------------
-- Fotos (evidência). Guardadas já reduzidas pelo navegador, com miniatura.
-- ---------------------------------------------------------------------------
create table foto (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  diario_id uuid references diario(id),
  nao_conformidade_id uuid references nao_conformidade(id),
  ocorrencia_seguranca_id uuid references ocorrencia_seguranca(id),
  inspecao_id uuid references inspecao(id),
  momento text check (momento in ('antes', 'depois')),
  legenda text,
  tirada_em timestamptz,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  largura int not null check (largura between 1 and 4000),
  altura int not null check (altura between 1 and 4000),
  conteudo bytea not null check (octet_length(conteudo) <= 3000000),
  miniatura bytea not null check (octet_length(miniatura) <= 200000),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (num_nonnulls(diario_id, nao_conformidade_id, ocorrencia_seguranca_id, inspecao_id) <= 1)
);
create index foto_por_obra on foto (obra_id, criado_em desc);
create index foto_por_diario on foto (diario_id) where diario_id is not null;
create index foto_por_nc on foto (nao_conformidade_id) where nao_conformidade_id is not null;
create index foto_por_ocorrencia on foto (ocorrencia_seguranca_id) where ocorrencia_seguranca_id is not null;

-- ---------------------------------------------------------------------------
-- Isolamento por órgão, carimbo, auditoria e imutabilidade
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['diario', 'diario_efetivo', 'diario_equipamento', 'diario_servico', 'diario_ocorrencia', 'diario_complemento',
                           'inspecao', 'ensaio', 'nao_conformidade', 'ocorrencia_seguranca', 'entrega_epi', 'foto'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

create trigger diario_numero before insert on diario for each row execute function numerar_por_obra();
create trigger inspecao_numero before insert on inspecao for each row execute function numerar_por_obra();
create trigger ensaio_numero before insert on ensaio for each row execute function numerar_por_obra();
create trigger nc_numero before insert on nao_conformidade for each row execute function numerar_por_obra();
create trigger ocorrencia_seg_numero before insert on ocorrencia_seguranca for each row execute function numerar_por_obra();

create trigger diario_carimbo before insert or update on diario for each row execute function carimbar();
create trigger diario_complemento_carimbo before insert on diario_complemento for each row execute function carimbar();
create trigger inspecao_carimbo before insert on inspecao for each row execute function carimbar();
create trigger ensaio_carimbo before insert on ensaio for each row execute function carimbar();
create trigger nc_carimbo before insert or update on nao_conformidade for each row execute function carimbar();
create trigger ocorrencia_seg_carimbo before insert or update on ocorrencia_seguranca for each row execute function carimbar();
create trigger entrega_epi_carimbo before insert on entrega_epi for each row execute function carimbar();
create trigger foto_carimbo before insert on foto for each row execute function carimbar();

create trigger diario_auditoria after insert or update on diario for each row execute function auditar();
create trigger diario_complemento_auditoria after insert on diario_complemento for each row execute function auditar();
create trigger inspecao_auditoria after insert on inspecao for each row execute function auditar();
create trigger ensaio_auditoria after insert on ensaio for each row execute function auditar();
create trigger nc_auditoria after insert or update on nao_conformidade for each row execute function auditar();
create trigger ocorrencia_seg_auditoria after insert or update on ocorrencia_seguranca for each row execute function auditar();
create trigger entrega_epi_auditoria after insert on entrega_epi for each row execute function auditar();
create trigger foto_auditoria after insert on foto for each row execute function auditar();

create trigger diario_sem_exclusao before delete on diario for each row execute function proibir_exclusao();
create trigger diario_complemento_sem_exclusao before delete on diario_complemento for each row execute function proibir_exclusao();
create trigger diario_complemento_sem_alteracao before update on diario_complemento for each row execute function proibir_alteracao();
create trigger inspecao_sem_exclusao before delete on inspecao for each row execute function proibir_exclusao();
create trigger inspecao_sem_alteracao before update on inspecao for each row execute function proibir_alteracao();
create trigger ensaio_sem_exclusao before delete on ensaio for each row execute function proibir_exclusao();
create trigger ensaio_sem_alteracao before update on ensaio for each row execute function proibir_alteracao();
create trigger nc_sem_exclusao before delete on nao_conformidade for each row execute function proibir_exclusao();
create trigger ocorrencia_seg_sem_exclusao before delete on ocorrencia_seguranca for each row execute function proibir_exclusao();
create trigger entrega_epi_sem_exclusao before delete on entrega_epi for each row execute function proibir_exclusao();
create trigger entrega_epi_sem_alteracao before update on entrega_epi for each row execute function proibir_alteracao();
create trigger foto_sem_alteracao before update on foto for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Regras do diário
-- ---------------------------------------------------------------------------
create function proteger_diario() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_obra;
begin
  if tg_op = 'INSERT' then
    select situacao into s from obra where id = new.obra_id;
    if s not in ('em_execucao', 'paralisada', 'concluida') then
      raise exception 'O diário é aberto em obra em execução.' using errcode = 'P0001';
    end if;
    if new.data > hoje_local() then
      raise exception 'A data do diário não pode ser futura.' using errcode = 'P0001';
    end if;
    if new.situacao <> 'rascunho' then
      raise exception 'O diário nasce em elaboração.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.data <> old.data or new.numero <> old.numero then
    raise exception 'A obra, a data e o número do diário não mudam.' using errcode = 'P0001';
  end if;
  if old.situacao = 'assinado' then
    if new.situacao <> 'assinado' or new.clima_manha <> old.clima_manha or new.clima_tarde <> old.clima_tarde
       or new.condicao <> old.condicao or new.relato is distinct from old.relato
       or new.assinado_por is distinct from old.assinado_por or new.assinado_em is distinct from old.assinado_em then
      raise exception 'Diário assinado não se altera. Registre um complemento.' using errcode = 'P0001';
    end if;
    if old.visto_em is not null and (new.visto_em is distinct from old.visto_em or new.visto_por is distinct from old.visto_por
       or new.visto_observacao is distinct from old.visto_observacao) then
      raise exception 'O visto do fiscal já foi dado.' using errcode = 'P0001';
    end if;
    if new.visto_em is not null and old.visto_em is null then
      new.visto_por := ctx_usuario();
      if new.visto_por = old.assinado_por then
        raise exception 'O visto é de outra pessoa, não de quem assinou o diário.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
  if new.visto_em is not null then
    raise exception 'O visto é dado no diário assinado.' using errcode = 'P0001';
  end if;
  if new.situacao = 'assinado' then
    if coalesce(btrim(new.relato), '') = ''
       and not exists (select 1 from diario_servico where diario_id = new.id)
       and not exists (select 1 from diario_ocorrencia where diario_id = new.id) then
      raise exception 'Registre o relato, um serviço ou uma ocorrência antes de assinar.' using errcode = 'P0001';
    end if;
    new.assinado_por := ctx_usuario();
    new.assinado_em := now();
  end if;
  return new;
end $$;
create trigger diario_protegido before insert or update on diario for each row execute function proteger_diario();

create function exigir_diario_em_rascunho() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_diario;
begin
  select situacao into s from diario where id = coalesce(new.diario_id, old.diario_id);
  if s is distinct from 'rascunho' then
    raise exception 'Diário assinado não se altera. Registre um complemento.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger diario_efetivo_congelado before insert or update or delete on diario_efetivo for each row execute function exigir_diario_em_rascunho();
create trigger diario_equipamento_congelado before insert or update or delete on diario_equipamento for each row execute function exigir_diario_em_rascunho();
create trigger diario_servico_congelado before insert or update or delete on diario_servico for each row execute function exigir_diario_em_rascunho();
create trigger diario_ocorrencia_congelado before insert or update or delete on diario_ocorrencia for each row execute function exigir_diario_em_rascunho();

create function exigir_diario_assinado() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from diario where id = new.diario_id and situacao = 'assinado') then
    raise exception 'Complemento é registrado no diário assinado.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger diario_complemento_valida before insert on diario_complemento for each row execute function exigir_diario_assinado();

-- Serviço ligado a atividade da linha de base da mesma obra.
create function validar_diario_servico() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare ok boolean;
begin
  if new.atividade_id is not null then
    select true into ok from atividade a join cronograma c on c.id = a.cronograma_id join diario d on d.obra_id = c.obra_id
     where a.id = new.atividade_id and d.id = new.diario_id and c.situacao = 'linha_base';
    if ok is null then
      raise exception 'A atividade não é da linha de base desta obra.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger diario_servico_valida before insert or update on diario_servico for each row execute function validar_diario_servico();

-- Ao assinar: avanço das atividades e linha do tempo.
create function evento_diario() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  s record;
  anterior numeric;
begin
  if new.situacao = 'assinado' and old.situacao = 'rascunho' then
    for s in select x.atividade_id, max(x.avanco_pct) as pct from diario_servico x
               join atividade a on a.id = x.atividade_id join cronograma c on c.id = a.cronograma_id
              where x.diario_id = new.id and x.avanco_pct is not null and c.situacao = 'linha_base' and c.inicio <= new.data
              group by x.atividade_id loop
      select percentual into anterior from avanco where atividade_id = s.atividade_id and data <= new.data order by data desc, criado_em desc limit 1;
      if s.pct > coalesce(anterior, 0)
         and not exists (select 1 from avanco where atividade_id = s.atividade_id and data > new.data and percentual < s.pct) then
        insert into avanco (orgao_id, atividade_id, data, percentual, origem, justificativa)
        values (new.orgao_id, s.atividade_id, new.data, s.pct, 'diario', 'Diário nº ' || new.numero);
      end if;
    end loop;
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'diario', 'Diário nº ' || new.numero || ' de ' || to_char(new.data, 'DD/MM/YYYY') || ' assinado.', ctx_usuario());
  end if;
  return new;
end $$;
create trigger diario_evento after update on diario for each row execute function evento_diario();

-- Foto de diário só enquanto ele está em elaboração; exclusão também.
create function validar_foto() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare d diario%rowtype;
begin
  if coalesce(new.diario_id, old.diario_id) is not null then
    select * into d from diario where id = coalesce(new.diario_id, old.diario_id);
    if d.situacao <> 'rascunho' then
      raise exception 'Diário assinado não recebe nem perde fotos.' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' and d.obra_id <> new.obra_id then
      raise exception 'A foto não é desta obra.' using errcode = 'P0001';
    end if;
  elsif tg_op = 'DELETE' then
    raise exception 'Foto de evidência não se exclui.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger foto_valida before insert or delete on foto for each row execute function validar_foto();

-- ---------------------------------------------------------------------------
-- Regras da qualidade
-- ---------------------------------------------------------------------------
create function proteger_nc() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'aberta' then
      raise exception 'A não conformidade nasce aberta.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.numero <> old.numero or new.origem <> old.origem
     or new.titulo <> old.titulo or new.descricao <> old.descricao or new.gravidade <> old.gravidade
     or new.item_servico_id is distinct from old.item_servico_id or new.area <> old.area then
    raise exception 'Os dados de origem da não conformidade não mudam.' using errcode = 'P0001';
  end if;
  if old.situacao in ('encerrada', 'cancelada') then
    raise exception 'Não conformidade % não se altera.', case old.situacao when 'encerrada' then 'encerrada' else 'cancelada' end using errcode = 'P0001';
  end if;
  if new.situacao <> old.situacao then
    if not ((old.situacao = 'aberta' and new.situacao in ('corrigida', 'cancelada'))
         or (old.situacao = 'corrigida' and new.situacao in ('encerrada', 'aberta'))) then
      raise exception 'Mudança de situação não permitida.' using errcode = 'P0001';
    end if;
    if new.situacao = 'corrigida' then
      new.corrigida_por := ctx_usuario();
      new.corrigida_em := now();
    elsif new.situacao = 'encerrada' then
      new.encerrada_por := ctx_usuario();
      new.encerrada_em := now();
    elsif new.situacao = 'aberta' then
      -- Correção recusada na verificação: volta aberta, mantém o histórico na auditoria.
      new.corrigida_por := null;
      new.corrigida_em := null;
    end if;
  end if;
  return new;
end $$;
create trigger nc_protegida before insert or update on nao_conformidade for each row execute function proteger_nc();

create function evento_nc() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, new.area, 'Não conformidade nº ' || new.numero || ' aberta: ' || new.titulo
            || case when new.impeditiva then ' (impeditiva)' else '' end || '.', ctx_usuario());
  elsif new.situacao <> old.situacao and new.situacao in ('encerrada', 'cancelada') then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, new.area, 'Não conformidade nº ' || new.numero
            || case new.situacao when 'encerrada' then ' encerrada.' else ' cancelada.' end, ctx_usuario());
  end if;
  return new;
end $$;
create trigger nc_evento after insert or update on nao_conformidade for each row execute function evento_nc();

-- Inspeção: conta as respostas.
create function contar_inspecao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  select count(*) filter (where r ->> 'resposta' = 'conforme'), count(*) filter (where r ->> 'resposta' = 'nao_conforme')
    into new.conformes, new.nao_conformes
    from jsonb_array_elements(new.respostas) r;
  if exists (select 1 from jsonb_array_elements(new.respostas) r where coalesce(r ->> 'resposta', '') not in ('conforme', 'nao_conforme', 'nao_aplica')) then
    raise exception 'Responda todos os itens do checklist.' using errcode = 'P0001';
  end if;
  if new.data > hoje_local() then
    raise exception 'A data da inspeção não pode ser futura.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger inspecao_conta before insert on inspecao for each row execute function contar_inspecao();

-- Ensaio: aprovado conforme o critério; reprovado abre não conformidade grave.
create function avaliar_ensaio() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.aprovado := case new.criterio when 'minimo' then new.resultado >= new.especificado else new.resultado <= new.especificado end;
  return new;
end $$;
create trigger ensaio_avalia before insert on ensaio for each row execute function avaliar_ensaio();

create function nc_do_ensaio() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not new.aprovado then
    insert into nao_conformidade (orgao_id, obra_id, area, titulo, descricao, local, item_servico_id, gravidade, impeditiva,
                                  responsavel, prazo, origem, ensaio_id)
    values (new.orgao_id, new.obra_id, 'qualidade', 'Ensaio reprovado: ' || new.tipo,
            'Resultado ' || replace(trim_scale(new.resultado)::text, '.', ',') || ' ' || new.unidade || ', '
            || case new.criterio when 'minimo' then 'mínimo' else 'máximo' end || ' especificado '
            || replace(trim_scale(new.especificado)::text, '.', ',') || ' ' || new.unidade
            || coalesce('. Laudo ' || new.laudo, '') || '.',
            new.local, new.item_servico_id, 'grave', new.item_servico_id is not null,
            coalesce(nullif(btrim(new.laboratorio), ''), 'Contratada'), new.data_resultado + 15, 'ensaio', new.id);
  end if;
  return new;
end $$;
create trigger ensaio_nc after insert on ensaio for each row execute function nc_do_ensaio();

-- Medição: item com não conformidade impeditiva em aberto não é medido.
create or replace function validar_item_medido() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  m medicao%rowtype;
  i item_servico%rowtype;
  acumulado numeric;
  vigente numeric;
  nc int;
begin
  select * into m from medicao where id = coalesce(new.medicao_id, old.medicao_id);
  if m.situacao <> 'rascunho' then
    raise exception 'O boletim só muda com a medição em elaboração.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select * into i from item_servico where id = new.item_servico_id for update;
  if i.contrato_id is distinct from m.contrato_id then
    raise exception 'O item não pertence ao contrato da medição.' using errcode = 'P0001';
  end if;
  if new.quantidade < 0 and not m.ajuste then
    raise exception 'Quantidade negativa só em medição de ajuste.' using errcode = 'P0001';
  end if;
  if new.preco_unitario <> i.preco_unitario then
    raise exception 'O preço do item medido é o preço do contrato.' using errcode = 'P0001';
  end if;
  if new.quantidade > 0 then
    select numero into nc from nao_conformidade
     where item_servico_id = i.id and impeditiva and situacao in ('aberta', 'corrigida') order by numero limit 1;
    if nc is not null then
      raise exception 'Item %: não conformidade nº % impeditiva em aberto.', i.numero, nc using errcode = 'P0001';
    end if;
  end if;
  vigente := quantidade_vigente(i.id);
  select coalesce(sum(x.quantidade), 0) into acumulado
    from item_medido x join medicao y on y.id = x.medicao_id
   where x.item_servico_id = new.item_servico_id and y.situacao <> 'cancelada' and x.id <> new.id;
  acumulado := acumulado + new.quantidade;
  if acumulado > vigente then
    raise exception 'Item %: a quantidade acumulada (%) passa da contratada (%).', i.numero,
      replace(trim_scale(acumulado)::text, '.', ','), replace(trim_scale(vigente)::text, '.', ',') using errcode = 'P0001';
  end if;
  if acumulado < 0 then
    raise exception 'Item %: a quantidade acumulada ficaria negativa.', i.numero using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Regras da segurança
-- ---------------------------------------------------------------------------
create function proteger_ocorrencia_seguranca() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.data > hoje_local() then
      raise exception 'A data da ocorrência não pode ser futura.' using errcode = 'P0001';
    end if;
    if new.situacao <> 'aberta' then
      raise exception 'A ocorrência nasce aberta.' using errcode = 'P0001';
    end if;
    if new.tipo = 'acidente_com_afastamento' and new.dias_afastamento is null then
      raise exception 'Informe os dias de afastamento.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.situacao = 'encerrada' then
    raise exception 'Ocorrência encerrada não se altera.' using errcode = 'P0001';
  end if;
  if new.obra_id <> old.obra_id or new.numero <> old.numero or new.tipo <> old.tipo or new.data <> old.data
     or new.descricao <> old.descricao or new.paralisacao <> old.paralisacao then
    raise exception 'Os dados da ocorrência não mudam; registre o encerramento.' using errcode = 'P0001';
  end if;
  if new.situacao = 'encerrada' then
    new.encerrada_por := ctx_usuario();
    new.encerrada_em := now();
  end if;
  return new;
end $$;
create trigger ocorrencia_seg_protegida before insert or update on ocorrencia_seguranca for each row execute function proteger_ocorrencia_seguranca();

-- Ocorrência vai para o diário do dia: entra no diário em elaboração (criado se
-- não houver) ou vira complemento do diário já assinado.
create function ocorrencia_no_diario() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  d diario%rowtype;
  texto text;
  s situacao_obra;
begin
  texto := case new.tipo when 'acidente_com_afastamento' then 'Acidente com afastamento'
                         when 'acidente_sem_afastamento' then 'Acidente sem afastamento'
                         when 'quase_acidente' then 'Quase acidente' else 'Risco grave e iminente' end
           || ' (ocorrência de segurança nº ' || new.numero || '): ' || new.descricao;
  select * into d from diario where obra_id = new.obra_id and data = new.data;
  if not found then
    select situacao into s from obra where id = new.obra_id;
    if s not in ('em_execucao', 'paralisada', 'concluida') then return new; end if;
    insert into diario (orgao_id, obra_id, data) values (new.orgao_id, new.obra_id, new.data) returning * into d;
  end if;
  if d.situacao = 'rascunho' then
    insert into diario_ocorrencia (orgao_id, diario_id, tipo, motivo, horas, descricao, ocorrencia_seguranca_id)
    values (new.orgao_id, d.id, case when new.paralisacao then 'paralisacao' else 'ocorrencia' end,
            case when new.paralisacao then 'seguranca'::motivo_paralisacao end,
            case when new.paralisacao then new.horas_paralisadas end, texto, new.id);
  else
    insert into diario_complemento (orgao_id, diario_id, texto)
    values (new.orgao_id, d.id, texto || case when new.paralisacao then ' Frente paralisada por ' || replace(trim_scale(new.horas_paralisadas)::text, '.', ',') || ' h.' else '' end);
  end if;
  insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
  values (new.orgao_id, new.obra_id, 'seguranca', texto || '.', ctx_usuario());
  return new;
end $$;
create trigger ocorrencia_seg_diario after insert on ocorrencia_seguranca for each row execute function ocorrencia_no_diario();

create function validar_data_campo() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.data > hoje_local() then
    raise exception 'A data não pode ser futura.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger entrega_epi_data before insert on entrega_epi for each row execute function validar_data_campo();

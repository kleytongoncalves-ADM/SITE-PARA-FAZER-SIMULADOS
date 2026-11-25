-- Etapa 2: base de preços (SINAPI e composições próprias) e orçamento.
--
-- A base oficial (SINAPI, SICRO) é compartilhada por todos os órgãos: as linhas
-- têm orgao_id nulo e só são gravadas pela carga mensal. Composições próprias e
-- orçamentos pertencem a um órgão e seguem o isolamento por órgão.
-- Orçamento aprovado fica congelado: itens, preços e BDI não mudam mais.

create type fonte_preco as enum ('sinapi', 'sicro', 'propria', 'cotacao', 'demonstracao');
create type tipo_insumo as enum ('material', 'mao_de_obra', 'equipamento', 'servico', 'taxa');
create type situacao_carga as enum ('em_conferencia', 'liberada', 'recusada');
create type situacao_orcamento as enum ('rascunho', 'aprovado', 'substituido', 'cancelado');
create type modo_item as enum ('servico', 'material', 'cotacao');
create type tipo_bdi as enum ('obra', 'fornecimento');

-- Linhas da base oficial só entram pela carga mensal (app.carga_precos = 'sim').
create function pode_gravar_base(p_orgao uuid) returns boolean language sql stable set search_path = public, pg_temp as $$
  select case when p_orgao is null then coalesce(current_setting('app.carga_precos', true), '') = 'sim'
              else p_orgao = ctx_orgao() end
$$;

-- ---------------------------------------------------------------------------
-- Base de preços
-- ---------------------------------------------------------------------------
create table tabela_preco (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid references orgao(id),
  fonte fonte_preco not null,
  uf char(2) not null,
  mes date not null check (extract(day from mes) = 1),
  regime regime_sinapi not null,
  situacao situacao_carga not null default 'em_conferencia',
  arquivo text,
  conferencia jsonb not null default '{}',
  carregada_em timestamptz not null default now(),
  liberada_em timestamptz,
  unique nulls not distinct (orgao_id, fonte, uf, mes, regime)
);

create table insumo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid references orgao(id),
  fonte fonte_preco not null,
  codigo text not null,
  descricao text not null,
  unidade text not null,
  tipo tipo_insumo not null,
  grupo text,
  unique nulls not distinct (orgao_id, fonte, codigo)
);
create index insumo_busca on insumo using gin (to_tsvector('portuguese', descricao));

create table preco_insumo (
  tabela_id uuid not null references tabela_preco(id),
  insumo_id uuid not null references insumo(id),
  preco numeric(14,2) not null check (preco >= 0),
  origem text,
  primary key (tabela_id, insumo_id)
);
create index preco_insumo_por_insumo on preco_insumo (insumo_id);

create table composicao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid references orgao(id),
  fonte fonte_preco not null,
  codigo text not null,
  descricao text not null,
  unidade text not null,
  grupo text,
  justificativa text,
  origem_id uuid references composicao(id),
  aprovada boolean not null default true,
  aprovada_por uuid references usuario(id),
  aprovada_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique nulls not distinct (orgao_id, fonte, codigo),
  check (fonte <> 'propria' or (orgao_id is not null and coalesce(btrim(justificativa), '') <> ''))
);
create index composicao_busca on composicao using gin (to_tsvector('portuguese', descricao));

-- Estrutura da composição. Na base oficial a estrutura é do mês (mes); nas próprias, mes é nulo.
create table composicao_item (
  id bigint generated always as identity primary key,
  composicao_id uuid not null references composicao(id),
  mes date,
  insumo_id uuid references insumo(id),
  subcomposicao_id uuid references composicao(id),
  coeficiente numeric(18,7) not null check (coeficiente > 0),
  check ((insumo_id is null) <> (subcomposicao_id is null)),
  check (subcomposicao_id is distinct from composicao_id)
);
create index composicao_item_por_composicao on composicao_item (composicao_id, mes);

-- Custo publicado pela fonte oficial, usado só na conferência da carga.
create table custo_publicado (
  tabela_id uuid not null references tabela_preco(id),
  composicao_id uuid not null references composicao(id),
  custo numeric(14,2) not null,
  primary key (tabela_id, composicao_id)
);

-- O orgao_id da composição própria vale também para os itens dela.
create function orgao_da_composicao(p uuid) returns uuid language sql stable set search_path = public, pg_temp as
$$ select orgao_id from composicao where id = p $$;

alter table tabela_preco enable row level security; alter table tabela_preco force row level security;
create policy tabela_preco_leitura on tabela_preco for select using (orgao_id is null or orgao_id = ctx_orgao());
create policy tabela_preco_escrita on tabela_preco for all using (pode_gravar_base(orgao_id)) with check (pode_gravar_base(orgao_id));

alter table insumo enable row level security; alter table insumo force row level security;
create policy insumo_leitura on insumo for select using (orgao_id is null or orgao_id = ctx_orgao());
create policy insumo_escrita on insumo for all using (pode_gravar_base(orgao_id)) with check (pode_gravar_base(orgao_id));

alter table composicao enable row level security; alter table composicao force row level security;
create policy composicao_leitura on composicao for select using (orgao_id is null or orgao_id = ctx_orgao());
create policy composicao_escrita on composicao for all using (pode_gravar_base(orgao_id)) with check (pode_gravar_base(orgao_id));

alter table composicao_item enable row level security; alter table composicao_item force row level security;
create policy composicao_item_leitura on composicao_item for select
  using (orgao_da_composicao(composicao_id) is null or orgao_da_composicao(composicao_id) = ctx_orgao());
create policy composicao_item_escrita on composicao_item for all
  using (pode_gravar_base(orgao_da_composicao(composicao_id))) with check (pode_gravar_base(orgao_da_composicao(composicao_id)));

alter table preco_insumo enable row level security; alter table preco_insumo force row level security;
create policy preco_insumo_leitura on preco_insumo for select using (true);
create policy preco_insumo_escrita on preco_insumo for all
  using (coalesce(current_setting('app.carga_precos', true), '') = 'sim')
  with check (coalesce(current_setting('app.carga_precos', true), '') = 'sim');

alter table custo_publicado enable row level security; alter table custo_publicado force row level security;
create policy custo_publicado_leitura on custo_publicado for select using (true);
create policy custo_publicado_escrita on custo_publicado for all
  using (coalesce(current_setting('app.carga_precos', true), '') = 'sim')
  with check (coalesce(current_setting('app.carga_precos', true), '') = 'sim');

create trigger composicao_carimbo before insert or update on composicao for each row execute function carimbar();

-- Composição própria aprovada não muda: uma alteração vira nova composição.
create function proteger_composicao_propria() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare c composicao%rowtype;
begin
  if tg_table_name = 'composicao' then
    if tg_op = 'DELETE' then
      if old.fonte = 'propria' then raise exception 'Composições próprias não podem ser excluídas.' using errcode = 'P0001'; end if;
      return old;
    end if;
    if old.fonte = 'propria' and old.aprovada
       and (new.descricao, new.unidade, new.justificativa, new.codigo) is distinct from (old.descricao, old.unidade, old.justificativa, old.codigo) then
      raise exception 'Composição aprovada não pode ser alterada. Crie uma nova a partir dela.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  select * into c from composicao where id = coalesce(new.composicao_id, old.composicao_id);
  if c.fonte = 'propria' and c.aprovada then
    raise exception 'Composição aprovada não pode ser alterada. Crie uma nova a partir dela.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger composicao_protegida before update or delete on composicao for each row execute function proteger_composicao_propria();
create trigger composicao_item_protegido before insert or update or delete on composicao_item for each row execute function proteger_composicao_propria();

-- ---------------------------------------------------------------------------
-- Orçamento
-- ---------------------------------------------------------------------------
create table orcamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null,
  versao int not null default 1,
  versao_anterior_id uuid references orcamento(id),
  nome text not null,
  tabela_id uuid not null references tabela_preco(id),
  fonte fonte_preco not null,
  uf char(2) not null,
  mes date not null,
  regime regime_sinapi not null,
  arredondamento regra_arredondamento not null,
  situacao situacao_orcamento not null default 'rascunho',
  tipo_obra_bdi text not null default 'edificacoes'
    check (tipo_obra_bdi in ('edificacoes', 'rodovias', 'saneamento', 'portuarias', 'linhas', 'fornecimento')),
  bdi_obra jsonb not null,
  bdi_fornecimento jsonb not null,
  encargos_horista numeric(6,2),
  encargos_mensalista numeric(6,2),
  responsavel_tecnico text,
  registro_profissional text,
  art text,
  periodos int not null default 4 check (periodos between 1 and 60),
  unidade_periodo text not null default 'mes' check (unidade_periodo in ('semana', 'mes')),
  inicio date,
  aprovado_por uuid references usuario(id),
  aprovado_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero, versao)
);
create unique index orcamento_um_aprovado_por_obra on orcamento (obra_id) where situacao = 'aprovado';

create table orcamento_etapa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null references orcamento(id),
  ordem int not null check (ordem > 0),
  nome text not null check (btrim(nome) <> ''),
  unique (orcamento_id, ordem) deferrable initially deferred
);

create table orcamento_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null references orcamento(id),
  etapa_id uuid not null references orcamento_etapa(id),
  ordem int not null check (ordem > 0),
  modo modo_item not null,
  fonte fonte_preco not null,
  codigo text,
  descricao text not null,
  unidade text not null,
  quantidade numeric(16,4) not null check (quantidade > 0),
  custo_unitario numeric(14,2) check (custo_unitario >= 0),
  custo_material numeric(14,2),
  custo_mao_obra numeric(14,2),
  custo_equipamento numeric(14,2),
  tipo_bdi tipo_bdi not null default 'obra',
  memoria text,
  criterio_cotacao text check (criterio_cotacao in ('media', 'mediana', 'menor')),
  justificativa text,
  composicao_id uuid references composicao(id),
  insumo_id uuid references insumo(id),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (etapa_id, ordem) deferrable initially deferred
);
create index orcamento_item_por_orcamento on orcamento_item (orcamento_id);

-- Cópia congelada dos insumos do item, com os preços da data-base.
create table orcamento_item_insumo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  item_id uuid not null references orcamento_item(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  unidade text not null,
  tipo tipo_insumo not null,
  coeficiente numeric(18,7) not null check (coeficiente > 0),
  preco numeric(14,2) check (preco >= 0)
);
create index orcamento_item_insumo_por_item on orcamento_item_insumo (item_id);

create table cotacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  item_id uuid not null references orcamento_item(id) on delete cascade,
  fornecedor text not null check (btrim(fornecedor) <> ''),
  cnpj text,
  data date not null,
  valor numeric(14,2) not null check (valor > 0),
  validade date,
  anexo text
);

create table orcamento_cronograma (
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null references orcamento(id),
  etapa_id uuid not null references orcamento_etapa(id) on delete cascade,
  periodo int not null check (periodo > 0),
  percentual numeric(7,4) not null check (percentual between 0 and 100),
  primary key (etapa_id, periodo)
);

create table nota_orcamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null unique references orcamento(id),
  ano int not null,
  numero int not null,
  emitida_em timestamptz not null default now(),
  emitida_por uuid references usuario(id),
  resumo jsonb not null,
  unique (orgao_id, ano, numero)
);

-- Isolamento por órgão.
do $$
declare t text;
begin
  foreach t in array array['orcamento', 'orcamento_etapa', 'orcamento_item', 'orcamento_item_insumo', 'cotacao', 'orcamento_cronograma', 'nota_orcamento'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

create trigger orcamento_carimbo before insert or update on orcamento for each row execute function carimbar();
create trigger orcamento_item_carimbo before insert or update on orcamento_item for each row execute function carimbar();
create trigger orcamento_auditoria after insert or update on orcamento for each row execute function auditar();
create trigger orcamento_item_auditoria after insert or update on orcamento_item for each row execute function auditar();
create trigger orcamento_sem_exclusao before delete on orcamento for each row execute function proibir_exclusao();
create trigger nota_sem_exclusao before delete on nota_orcamento for each row execute function proibir_exclusao();
create trigger nota_sem_alteracao before update on nota_orcamento for each row execute function proibir_alteracao();

-- Orçamento aprovado é congelado. Só a situação muda (substituído ou cancelado).
create function proteger_orcamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.situacao = 'rascunho' then
    if new.situacao not in ('rascunho', 'aprovado', 'cancelado') then
      raise exception 'Mudança de situação do orçamento não permitida.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'situacao' - 'alterado_por' - 'alterado_em') is distinct from (to_jsonb(old) - 'situacao' - 'alterado_por' - 'alterado_em')
     or not (old.situacao = 'aprovado' and new.situacao in ('substituido', 'cancelado')) then
    raise exception 'Orçamento aprovado não pode ser alterado. Crie uma nova versão.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger orcamento_protegido before update on orcamento for each row execute function proteger_orcamento();

create function exigir_orcamento_em_rascunho() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  alvo uuid;
  s situacao_orcamento;
begin
  if tg_table_name in ('orcamento_item_insumo', 'cotacao') then
    select orcamento_id into alvo from orcamento_item where id = coalesce(new.item_id, old.item_id);
    if alvo is null then return coalesce(new, old); end if; -- item já excluído junto (cascata)
  else
    alvo := coalesce(new.orcamento_id, old.orcamento_id);
  end if;
  select situacao into s from orcamento where id = alvo;
  if s is distinct from 'rascunho' then
    raise exception 'Orçamento aprovado não pode ser alterado. Crie uma nova versão.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['orcamento_etapa', 'orcamento_item', 'orcamento_item_insumo', 'cotacao', 'orcamento_cronograma'] loop
    execute format('create trigger %I before insert or update or delete on %I for each row execute function exigir_orcamento_em_rascunho()', t || '_congelado', t);
  end loop;
end $$;

-- Etapas e itens precisam ser do mesmo orçamento.
create function validar_item_orcamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (select orcamento_id from orcamento_etapa where id = new.etapa_id) is distinct from new.orcamento_id then
    raise exception 'A etapa não pertence a este orçamento.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger orcamento_item_valida before insert or update on orcamento_item for each row execute function validar_item_orcamento();

-- Linha do tempo da obra.
create function evento_orcamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare rotulo_n text := lpad(new.numero::text, 3, '0') || ' v' || new.versao;
begin
  if tg_op = 'INSERT' then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'orcamento', 'Orçamento ' || rotulo_n || ' criado: ' || new.nome || '.', ctx_usuario());
  elsif new.situacao is distinct from old.situacao then
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, new.obra_id, 'orcamento',
            'Orçamento ' || rotulo_n || ' ' || case new.situacao when 'aprovado' then 'aprovado' when 'substituido' then 'substituído por nova versão'
              when 'cancelado' then 'cancelado' else 'alterado' end || '.', ctx_usuario());
  end if;
  return new;
end $$;
create trigger orcamento_evento after insert or update on orcamento for each row execute function evento_orcamento();

-- ---------------------------------------------------------------------------
-- Custo das composições
-- ---------------------------------------------------------------------------
-- Mês da estrutura usada: a do próprio mês ou a mais recente antes dele. Composição própria: nulo.
create function mes_da_estrutura(p_comp uuid, p_mes date) returns date language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select max(mes) from composicao_item where composicao_id = p_comp and mes <= p_mes),
    (select min(mes) from composicao_item where composicao_id = p_comp))
$$;

-- Insumos da composição com as auxiliares abertas: coeficiente final = produto dos coeficientes.
create function insumos_da_composicao(p_comp uuid, p_mes date)
returns table (insumo_id uuid, coeficiente numeric) language sql stable set search_path = public, pg_temp as $$
  with recursive arvore (composicao_id, coef, nivel) as (
    select p_comp, 1::numeric, 0
    union all
    select ci.subcomposicao_id, a.coef * ci.coeficiente, a.nivel + 1
      from arvore a
      join composicao_item ci on ci.composicao_id = a.composicao_id and ci.subcomposicao_id is not null
       and ci.mes is not distinct from mes_da_estrutura(a.composicao_id, p_mes)
     where a.nivel < 12
  )
  select ci.insumo_id, sum(a.coef * ci.coeficiente)
    from arvore a
    join composicao_item ci on ci.composicao_id = a.composicao_id and ci.insumo_id is not null
     and ci.mes is not distinct from mes_da_estrutura(a.composicao_id, p_mes)
   group by ci.insumo_id
$$;

-- Custo sem ajuste de casas, separado por tipo, na tabela de preços pedida.
create function custo_composicao(p_comp uuid, p_tabela uuid)
returns table (material numeric, mao_de_obra numeric, equipamento numeric, sem_preco int, insumos int)
language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(x.coeficiente * p.preco) filter (where i.tipo not in ('mao_de_obra', 'equipamento')), 0),
         coalesce(sum(x.coeficiente * p.preco) filter (where i.tipo = 'mao_de_obra'), 0),
         coalesce(sum(x.coeficiente * p.preco) filter (where i.tipo = 'equipamento'), 0),
         (count(*) filter (where p.preco is null))::int,
         count(*)::int
    from insumos_da_composicao(p_comp, (select mes from tabela_preco where id = p_tabela)) x
    join insumo i on i.id = x.insumo_id
    left join preco_insumo p on p.insumo_id = x.insumo_id and p.tabela_id = p_tabela
$$;

-- Busca sem acento e sem diferença de maiúsculas.
create function unaccent_simples(t text) returns text language sql immutable set search_path = public, pg_temp as $$
  select lower(translate(t, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'))
$$;

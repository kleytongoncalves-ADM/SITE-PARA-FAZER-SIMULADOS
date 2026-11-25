-- Etapa 5: aditivos e revisões de preço.
--
-- Aditivo altera quantidades da planilha (acréscimo ou supressão), inclui
-- itens novos e estende prazo de execução e vigência. Nasce em elaboração e,
-- assinado, fica congelado. Os limites do art. 125 da Lei 14.133/2021 são
-- conferidos na assinatura: acréscimos até 25% do valor inicial atualizado
-- (50% em reforma) e supressões até 25%, cada um somado sem compensação.
--
-- A revisão de preço (reajuste por índice ou reequilíbrio econômico-financeiro)
-- é registrada por apostilamento e aplica um percentual sobre os preços das
-- medições cujo período começa a partir do seu início.

create type situacao_aditivo as enum ('rascunho', 'assinado', 'cancelado');
create type tipo_revisao as enum ('reajuste', 'reequilibrio');

create table aditivo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  numero int not null check (numero > 0),
  objeto text not null check (btrim(objeto) <> ''),
  justificativa text not null check (btrim(justificativa) <> ''),
  fundamento text,
  prazo_dias int not null default 0 check (prazo_dias between 0 and 3650),
  nova_vigencia date,
  planilha_id uuid references planilha_contratual(id),
  situacao situacao_aditivo not null default 'rascunho',
  data_assinatura date,
  valor_acrescimo numeric(16,2),
  valor_supressao numeric(16,2),
  assinado_por uuid references usuario(id),
  assinado_em timestamptz,
  cancelado_motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (contrato_id, numero),
  check (situacao <> 'assinado' or (data_assinatura is not null and valor_acrescimo is not null and valor_supressao is not null)),
  check (situacao <> 'cancelado' or coalesce(btrim(cancelado_motivo), '') <> '')
);
create index aditivo_por_contrato on aditivo (contrato_id, numero);

alter table item_servico add column aditivo_id uuid references aditivo(id);
alter table item_servico drop constraint item_servico_quantidade_check;
alter table item_servico add constraint item_servico_quantidade_check check (quantidade > 0 or (aditivo_id is not null and quantidade = 0));

-- Variação de quantidade de cada item no aditivo (positiva acresce, negativa suprime).
create table aditivo_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  aditivo_id uuid not null references aditivo(id),
  item_servico_id uuid not null references item_servico(id),
  quantidade numeric(16,4) not null check (quantidade <> 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  valor numeric(16,2) not null,
  unique (aditivo_id, item_servico_id),
  check (sign(valor) = sign(quantidade) or valor = 0)
);
create index aditivo_item_por_item on aditivo_item (item_servico_id);

create table revisao_preco (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  numero int not null check (numero > 0),
  tipo tipo_revisao not null,
  indice text,
  indice_base numeric(14,6),
  indice_atual numeric(14,6),
  percentual numeric(9,4) not null check (percentual > -100 and percentual <> 0),
  inicio date not null,
  justificativa text,
  documento text,
  valor_saldo numeric(16,2) not null,
  valor_impacto numeric(16,2) not null,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (contrato_id, numero),
  check (tipo <> 'reajuste' or (coalesce(btrim(indice), '') <> '' and indice_base > 0 and indice_atual > 0)),
  check (tipo <> 'reequilibrio' or (coalesce(btrim(justificativa), '') <> '' and coalesce(btrim(documento), '') <> ''))
);
create index revisao_por_contrato on revisao_preco (contrato_id, inicio);

-- Reajuste gravado na aprovação da medição.
alter table medicao add column reajuste_pct numeric(12,6) not null default 0;
alter table medicao add column valor_reajuste numeric(16,2) not null default 0;

-- ---------------------------------------------------------------------------
-- Isolamento por órgão, carimbo e auditoria
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['aditivo', 'aditivo_item', 'revisao_preco'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

create trigger aditivo_carimbo before insert or update on aditivo for each row execute function carimbar();
create trigger revisao_carimbo before insert on revisao_preco for each row execute function carimbar();
create trigger aditivo_auditoria after insert or update on aditivo for each row execute function auditar();
create trigger aditivo_item_auditoria after insert or update on aditivo_item for each row execute function auditar();
create trigger revisao_auditoria after insert on revisao_preco for each row execute function auditar();
create trigger aditivo_sem_exclusao before delete on aditivo for each row execute function proibir_exclusao();
create trigger revisao_sem_exclusao before delete on revisao_preco for each row execute function proibir_exclusao();
create trigger revisao_sem_alteracao before update on revisao_preco for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Valores vigentes
-- ---------------------------------------------------------------------------
-- Quantidade do item com os aditivos assinados.
create function quantidade_vigente(item uuid) returns numeric language sql stable set search_path = public, pg_temp as $$
  select i.quantidade + coalesce((select sum(ai.quantidade) from aditivo_item ai join aditivo a on a.id = ai.aditivo_id
                                   where ai.item_servico_id = i.id and a.situacao = 'assinado'), 0)
    from item_servico i where i.id = item
$$;

-- Prazo de execução com os aditivos assinados.
create function prazo_vigente(k uuid) returns int language sql stable set search_path = public, pg_temp as $$
  select c.prazo_execucao_dias + coalesce((select sum(a.prazo_dias) from aditivo a where a.contrato_id = c.id and a.situacao = 'assinado'), 0)::int
    from contrato c where c.id = k
$$;

-- Fim da vigência com os aditivos assinados.
create function vigencia_vigente(k uuid) returns date language sql stable set search_path = public, pg_temp as $$
  select greatest(c.vigencia_fim, (select max(a.nova_vigencia) from aditivo a where a.contrato_id = c.id and a.situacao = 'assinado'))
    from contrato c where c.id = k
$$;

-- Fator acumulado das revisões de preço em vigor numa data (1 = sem revisão).
create function fator_revisao(k uuid, em date, so_reajuste boolean default false) returns numeric language sql stable set search_path = public, pg_temp as $$
  select coalesce(round(exp(sum(ln(1 + percentual / 100))), 12), 1)
    from revisao_preco where contrato_id = k and inicio <= em and (not so_reajuste or tipo = 'reajuste')
$$;

-- ---------------------------------------------------------------------------
-- Planilha congelada, salvo pelo aditivo em elaboração
-- ---------------------------------------------------------------------------
create or replace function exigir_contrato_em_rascunho() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  s situacao_contrato;
  ad uuid;
  sa situacao_aditivo;
begin
  if tg_table_name = 'planilha_contratual' then
    if new.origem = 'aditivo' then return new; end if;
  end if;
  if tg_table_name = 'item_servico' then
    if tg_op = 'UPDATE' and new.aditivo_id is distinct from old.aditivo_id then
      raise exception 'O item não muda de aditivo.' using errcode = 'P0001';
    end if;
    ad := coalesce(new.aditivo_id, old.aditivo_id);
    if ad is not null then
      select situacao into sa from aditivo where id = ad;
      if sa is distinct from 'rascunho' then
        raise exception 'Aditivo assinado ou cancelado não pode ser alterado.' using errcode = 'P0001';
      end if;
      return coalesce(new, old);
    end if;
  end if;
  select situacao into s from contrato where id = coalesce(new.contrato_id, old.contrato_id);
  if s is distinct from 'rascunho' then
    raise exception 'Contrato assinado não pode ser alterado. A mudança é feita por aditivo ou apostilamento.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------------
-- Itens do aditivo
-- ---------------------------------------------------------------------------
create function validar_aditivo_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  a aditivo%rowtype;
  i item_servico%rowtype;
  medido numeric;
begin
  select * into a from aditivo where id = coalesce(new.aditivo_id, old.aditivo_id);
  if a.situacao <> 'rascunho' then
    raise exception 'Aditivo assinado ou cancelado não pode ser alterado.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select * into i from item_servico where id = new.item_servico_id;
  if i.contrato_id is distinct from a.contrato_id then
    raise exception 'O item não pertence ao contrato do aditivo.' using errcode = 'P0001';
  end if;
  if i.aditivo_id is not null and i.aditivo_id <> a.id then
    raise exception 'Item %: incluído por aditivo ainda não assinado.', i.numero using errcode = 'P0001';
  end if;
  if i.aditivo_id = a.id and new.quantidade < 0 then
    raise exception 'Item %: item novo só tem acréscimo.', i.numero using errcode = 'P0001';
  end if;
  if new.preco_unitario <> i.preco_unitario then
    raise exception 'Item %: o aditivo usa o preço do contrato.', i.numero using errcode = 'P0001';
  end if;
  if new.quantidade < 0 then
    select coalesce(sum(x.quantidade), 0) into medido from item_medido x join medicao y on y.id = x.medicao_id
     where x.item_servico_id = i.id and y.situacao <> 'cancelada';
    if quantidade_vigente(i.id) + new.quantidade < medido then
      raise exception 'Item %: a supressão deixa a quantidade abaixo do já medido (%).', i.numero,
        replace(trim_scale(medido)::text, '.', ',') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger aditivo_item_valida before insert or update or delete on aditivo_item for each row execute function validar_aditivo_item();

-- ---------------------------------------------------------------------------
-- Fluxo do aditivo e limites legais
-- ---------------------------------------------------------------------------
create function proteger_aditivo() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  k contrato%rowtype;
  base numeric;
  limite_acr numeric;
  acr numeric;
  sup numeric;
  acr_total numeric;
  sup_total numeric;
  vig date;
  item record;
begin
  select * into k from contrato where id = new.contrato_id;
  if tg_op = 'INSERT' then
    if new.situacao <> 'rascunho' then
      raise exception 'O aditivo começa em elaboração.' using errcode = 'P0001';
    end if;
    if k.situacao <> 'vigente' then
      raise exception 'Só contrato vigente recebe aditivo.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.situacao <> 'rascunho' then
    raise exception 'Aditivo assinado ou cancelado não pode ser alterado.' using errcode = 'P0001';
  end if;
  if new.contrato_id is distinct from old.contrato_id or new.numero is distinct from old.numero then
    raise exception 'Contrato e número do aditivo não mudam.' using errcode = 'P0001';
  end if;
  if new.situacao = 'rascunho' then return new; end if;
  if new.situacao = 'cancelado' then return new; end if;

  -- Assinatura
  if k.situacao <> 'vigente' then
    raise exception 'Só contrato vigente recebe aditivo.' using errcode = 'P0001';
  end if;
  vig := vigencia_vigente(k.id);
  if new.data_assinatura is null then
    raise exception 'Informe a data de assinatura do aditivo.' using errcode = 'P0001';
  end if;
  if new.data_assinatura < k.data_assinatura or new.data_assinatura > vig then
    raise exception 'O aditivo é assinado dentro da vigência do contrato (até %).', to_char(vig, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if new.nova_vigencia is not null and new.nova_vigencia <= vig then
    raise exception 'A nova vigência deve ser posterior à atual (%).', to_char(vig, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if exists (select 1 from item_servico where aditivo_id = new.id and not exists (select 1 from aditivo_item where item_servico_id = item_servico.id and aditivo_id = new.id)) then
    raise exception 'Há item novo sem quantidade no aditivo.' using errcode = 'P0001';
  end if;
  select coalesce(sum(valor) filter (where valor > 0), 0), coalesce(-sum(valor) filter (where valor < 0), 0)
    into acr, sup from aditivo_item where aditivo_id = new.id;
  if acr = 0 and sup = 0 and new.prazo_dias = 0 and new.nova_vigencia is null then
    raise exception 'O aditivo não altera valor, prazo nem vigência.' using errcode = 'P0001';
  end if;

  -- Limites: sobre o valor inicial atualizado pelos reajustes, sem compensação.
  base := round(k.valor_inicial * fator_revisao(k.id, new.data_assinatura, true), 2);
  limite_acr := round(base * case when k.natureza = 'reforma' then 0.50 else 0.25 end, 2);
  select coalesce(sum(valor_acrescimo), 0), coalesce(sum(valor_supressao), 0) into acr_total, sup_total
    from aditivo where contrato_id = k.id and situacao = 'assinado';
  if acr_total + acr > limite_acr then
    raise exception 'Os acréscimos somam R$ % e passam do limite de % do valor inicial atualizado (R$ %).',
      moeda_br(acr_total + acr), case when k.natureza = 'reforma' then '50%' else '25%' end, moeda_br(limite_acr) using errcode = 'P0001';
  end if;
  if sup_total + sup > round(base * 0.25, 2) then
    raise exception 'As supressões somam R$ % e passam do limite de 25%% do valor inicial atualizado (R$ %).',
      moeda_br(sup_total + sup), moeda_br(round(base * 0.25, 2)) using errcode = 'P0001';
  end if;

  -- Supressão não fica abaixo do já medido.
  for item in
    select i.numero, quantidade_vigente(i.id) + ai.quantidade as nova,
           (select coalesce(sum(x.quantidade), 0) from item_medido x join medicao y on y.id = x.medicao_id
             where x.item_servico_id = i.id and y.situacao <> 'cancelada') as medido
      from aditivo_item ai join item_servico i on i.id = ai.item_servico_id
     where ai.aditivo_id = new.id and ai.quantidade < 0
  loop
    if item.nova < item.medido then
      raise exception 'Item %: a supressão deixa a quantidade abaixo do já medido (%).', item.numero,
        replace(trim_scale(item.medido)::text, '.', ',') using errcode = 'P0001';
    end if;
  end loop;

  new.valor_acrescimo := acr;
  new.valor_supressao := sup;
  new.assinado_por := coalesce(new.assinado_por, ctx_usuario());
  new.assinado_em := coalesce(new.assinado_em, now());
  return new;
end $$;
create trigger aditivo_protegido before insert or update on aditivo for each row execute function proteger_aditivo();

create function evento_aditivo() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare k contrato%rowtype;
begin
  if new.situacao = 'assinado' and old.situacao = 'rascunho' then
    select * into k from contrato where id = new.contrato_id;
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, k.obra_id, 'contrato',
            lpad(new.numero::text, 2, '0') || 'º termo aditivo do contrato ' || k.numero || ' assinado'
            || case when new.valor_acrescimo - new.valor_supressao <> 0
                    then ': R$ ' || moeda_br(new.valor_acrescimo - new.valor_supressao) else '' end
            || case when new.prazo_dias > 0 then case when new.valor_acrescimo - new.valor_supressao <> 0 then ', ' else ': ' end
                    || '+' || new.prazo_dias || ' dias de prazo' else '' end || '.',
            ctx_usuario());
  end if;
  return new;
end $$;
create trigger aditivo_evento after update on aditivo for each row execute function evento_aditivo();

-- ---------------------------------------------------------------------------
-- Revisão de preço
-- ---------------------------------------------------------------------------
create function validar_revisao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  k contrato%rowtype;
  ultimo date;
  aniversario date;
begin
  select * into k from contrato where id = new.contrato_id for update;
  if k.situacao <> 'vigente' then
    raise exception 'Só contrato vigente recebe revisão de preço.' using errcode = 'P0001';
  end if;
  if new.inicio < k.data_assinatura then
    raise exception 'O início da revisão é anterior à assinatura do contrato.' using errcode = 'P0001';
  end if;
  if new.tipo = 'reajuste' then
    if new.percentual <> round((new.indice_atual / new.indice_base - 1) * 100, 4) then
      raise exception 'O percentual do reajuste não confere com os índices.' using errcode = 'P0001';
    end if;
    select max(inicio) into ultimo from revisao_preco where contrato_id = k.id and tipo = 'reajuste';
    aniversario := (coalesce(ultimo, k.data_base, k.data_assinatura) + interval '1 year')::date;
    if new.inicio < aniversario then
      raise exception 'O reajuste só vale após 12 meses da % (a partir de %).',
        case when ultimo is null then 'data-base do orçamento' else 'último reajuste' end, to_char(aniversario, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger revisao_valida before insert on revisao_preco for each row execute function validar_revisao();

create function evento_revisao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare k contrato%rowtype;
begin
  select * into k from contrato where id = new.contrato_id;
  insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
  values (new.orgao_id, k.obra_id, 'contrato',
          case new.tipo when 'reajuste' then 'Reajuste' else 'Reequilíbrio' end || ' de '
          || replace(trim_scale(new.percentual)::text, '.', ',') || '% no contrato ' || k.numero
          || ', a partir de ' || to_char(new.inicio, 'DD/MM/YYYY') || '.', ctx_usuario());
  return new;
end $$;
create trigger revisao_evento after insert on revisao_preco for each row execute function evento_revisao();

-- ---------------------------------------------------------------------------
-- Medição sobre a quantidade vigente
-- ---------------------------------------------------------------------------
create or replace function validar_item_medido() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  m medicao%rowtype;
  i item_servico%rowtype;
  acumulado numeric;
  vigente numeric;
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

-- Valor do item com os aditivos assinados, a preço do contrato.
create function total_vigente(item uuid) returns numeric language sql stable set search_path = public, pg_temp as $$
  select case when q = i.quantidade then i.total else round(q * i.preco_unitario, 2) end
    from item_servico i, lateral (select quantidade_vigente(i.id) as q) v where i.id = item
$$;

-- Item em vigor: da planilha inicial ou de aditivo assinado.
create function item_vigente(item uuid) returns boolean language sql stable set search_path = public, pg_temp as $$
  select i.aditivo_id is null or exists (select 1 from aditivo a where a.id = i.aditivo_id and a.situacao = 'assinado')
    from item_servico i where i.id = item
$$;

-- Etapa 4: medição e pagamento.
--
-- O boletim de medição lança quantidades sobre os itens da planilha contratual,
-- com o preço do contrato e a memória de cálculo. Fluxo: o engenheiro elabora,
-- o fiscal atesta, o gestor aprova e o financeiro registra o pagamento.
-- Medição aprovada fica congelada; a correção é feita por medição de ajuste.
-- Os valores do boletim (bruto, glosas, retenções e líquido) são gravados na
-- aprovação, como cópia do documento aprovado.

create type situacao_medicao as enum ('rascunho', 'atestada', 'aprovada', 'cancelada');
create type tipo_retencao as enum ('iss', 'inss', 'ir', 'caucao', 'outra');

create table medicao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  contrato_id uuid not null references contrato(id),
  numero int not null check (numero > 0),
  ajuste boolean not null default false,
  periodo_inicio date not null,
  periodo_fim date not null,
  observacao text,
  situacao situacao_medicao not null default 'rascunho',
  valor_bruto numeric(16,2),
  valor_glosa numeric(16,2),
  valor_retencao numeric(16,2),
  valor_liquido numeric(16,2),
  atestada_por uuid references usuario(id),
  atestada_em timestamptz,
  aprovada_por uuid references usuario(id),
  aprovada_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (contrato_id, numero),
  check (periodo_fim >= periodo_inicio),
  check (not ajuste or coalesce(btrim(observacao), '') <> ''),
  check (situacao <> 'aprovada' or (valor_bruto is not null and valor_glosa is not null and valor_retencao is not null and valor_liquido is not null))
);
create index medicao_por_contrato on medicao (contrato_id, numero);

create table item_medido (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  item_servico_id uuid not null references item_servico(id),
  quantidade numeric(16,4) not null check (quantidade <> 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  valor numeric(16,2) not null,
  memoria text not null check (btrim(memoria) <> ''),
  unique (medicao_id, item_servico_id)
);
create index item_medido_por_item on item_medido (item_servico_id);

create table glosa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  item_servico_id uuid references item_servico(id),
  motivo text not null check (btrim(motivo) <> ''),
  valor numeric(16,2) not null check (valor > 0),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);

create table retencao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  tipo tipo_retencao not null,
  descricao text,
  base numeric(16,2) not null check (base > 0),
  aliquota numeric(7,4) not null check (aliquota > 0 and aliquota <= 100),
  valor numeric(16,2) not null check (valor > 0),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (tipo <> 'outra' or coalesce(btrim(descricao), '') <> '')
);

create table nota_fiscal (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  numero text not null check (btrim(numero) <> ''),
  data date not null,
  valor numeric(16,2) not null check (valor > 0),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (medicao_id, numero)
);

create table pagamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  data date not null,
  valor numeric(16,2) not null check (valor > 0),
  empenho text,
  liquidacao text,
  ordem_bancaria text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index pagamento_por_medicao on pagamento (medicao_id);

-- Cada passo do fluxo: quem, quando e a observação.
create table medicao_tramite (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  medicao_id uuid not null references medicao(id),
  acao text not null check (acao in ('elaborada', 'atestada', 'devolvida', 'aprovada', 'cancelada')),
  observacao text,
  usuario_id uuid references usuario(id),
  em timestamptz not null default now()
);
create index tramite_por_medicao on medicao_tramite (medicao_id, em);

-- ---------------------------------------------------------------------------
-- Isolamento por órgão, carimbo e auditoria
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['medicao', 'item_medido', 'glosa', 'retencao', 'nota_fiscal', 'pagamento', 'medicao_tramite'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

create trigger medicao_carimbo before insert or update on medicao for each row execute function carimbar();
create trigger glosa_carimbo before insert on glosa for each row execute function carimbar();
create trigger retencao_carimbo before insert on retencao for each row execute function carimbar();
create trigger nota_fiscal_carimbo before insert on nota_fiscal for each row execute function carimbar();
create trigger pagamento_carimbo before insert on pagamento for each row execute function carimbar();
create trigger medicao_auditoria after insert or update on medicao for each row execute function auditar();
create trigger item_medido_auditoria after insert or update on item_medido for each row execute function auditar();
create trigger glosa_auditoria after insert on glosa for each row execute function auditar();
create trigger retencao_auditoria after insert on retencao for each row execute function auditar();
create trigger nota_fiscal_auditoria after insert on nota_fiscal for each row execute function auditar();
create trigger pagamento_auditoria after insert on pagamento for each row execute function auditar();

create trigger medicao_sem_exclusao before delete on medicao for each row execute function proibir_exclusao();
create trigger nota_fiscal_sem_exclusao before delete on nota_fiscal for each row execute function proibir_exclusao();
create trigger pagamento_sem_exclusao before delete on pagamento for each row execute function proibir_exclusao();
create trigger pagamento_sem_alteracao before update on pagamento for each row execute function proibir_alteracao();
create trigger tramite_sem_exclusao before delete on medicao_tramite for each row execute function proibir_exclusao();
create trigger tramite_sem_alteracao before update on medicao_tramite for each row execute function proibir_alteracao();

-- Valor em reais no formato brasileiro, para mensagens (1.234,56).
create function moeda_br(v numeric) returns text language sql immutable set search_path = public, pg_temp as
$$ select translate(to_char(v, 'FM999G999G999G990D00'), ',.', '.,') $$;

-- ---------------------------------------------------------------------------
-- Fluxo da medição
-- ---------------------------------------------------------------------------
-- Rascunho → atestada → aprovada. Atestada pode voltar a rascunho (devolvida).
-- Rascunho ou atestada pode ser cancelada. Aprovada e cancelada não mudam mais.
create function proteger_medicao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'rascunho' then
      raise exception 'A medição começa em elaboração.' using errcode = 'P0001';
    end if;
    if (select situacao from contrato where id = new.contrato_id) <> 'vigente' then
      raise exception 'Só contrato vigente recebe medição.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.situacao in ('aprovada', 'cancelada') then
    raise exception 'Medição aprovada ou cancelada não pode ser alterada. A correção é feita por medição de ajuste.' using errcode = 'P0001';
  end if;
  if new.contrato_id is distinct from old.contrato_id or new.numero is distinct from old.numero or new.ajuste is distinct from old.ajuste then
    raise exception 'Contrato, número e tipo da medição não mudam.' using errcode = 'P0001';
  end if;
  if new.situacao is distinct from old.situacao and not (
       (old.situacao = 'rascunho' and new.situacao in ('atestada', 'cancelada'))
    or (old.situacao = 'atestada' and new.situacao in ('rascunho', 'aprovada', 'cancelada'))) then
    raise exception 'Mudança de situação da medição não permitida.' using errcode = 'P0001';
  end if;
  if old.situacao = 'atestada' and new.situacao = 'atestada'
     and (new.periodo_inicio, new.periodo_fim, new.observacao) is distinct from (old.periodo_inicio, old.periodo_fim, old.observacao) then
    raise exception 'Medição atestada não muda. Devolva para elaboração.' using errcode = 'P0001';
  end if;
  if new.situacao = 'atestada' and old.situacao = 'rascunho' and not exists (select 1 from item_medido where medicao_id = new.id) then
    raise exception 'O boletim está vazio.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger medicao_protegida before insert or update on medicao for each row execute function proteger_medicao();

-- Itens só mudam com a medição em elaboração. A quantidade acumulada de cada
-- item (medições não canceladas) fica entre zero e a quantidade contratada.
create function validar_item_medido() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  m medicao%rowtype;
  i item_servico%rowtype;
  acumulado numeric;
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
  select coalesce(sum(x.quantidade), 0) into acumulado
    from item_medido x join medicao y on y.id = x.medicao_id
   where x.item_servico_id = new.item_servico_id and y.situacao <> 'cancelada' and x.id <> new.id;
  acumulado := acumulado + new.quantidade;
  if acumulado > i.quantidade then
    raise exception 'Item %: a quantidade acumulada (%) passa da contratada (%).', i.numero,
      replace(trim_scale(acumulado)::text, '.', ','), replace(trim_scale(i.quantidade)::text, '.', ',') using errcode = 'P0001';
  end if;
  if acumulado < 0 then
    raise exception 'Item %: a quantidade acumulada ficaria negativa.', i.numero using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger item_medido_valida before insert or update or delete on item_medido for each row execute function validar_item_medido();

-- Glosas e retenções mudam até a aprovação (o fiscal glosa ao atestar).
create function exigir_medicao_aberta() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (select situacao from medicao where id = coalesce(new.medicao_id, old.medicao_id)) not in ('rascunho', 'atestada') then
    raise exception 'Medição aprovada ou cancelada não pode ser alterada.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger glosa_aberta before insert or update or delete on glosa for each row execute function exigir_medicao_aberta();
create trigger retencao_aberta before insert or update or delete on retencao for each row execute function exigir_medicao_aberta();

-- Nota fiscal e pagamento só em medição aprovada. O total pago não passa do líquido.
create function validar_pagamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  m medicao%rowtype;
  pago numeric;
begin
  select * into m from medicao where id = new.medicao_id for update;
  if m.situacao <> 'aprovada' then
    raise exception 'Só medição aprovada recebe nota fiscal e pagamento.' using errcode = 'P0001';
  end if;
  if tg_table_name = 'pagamento' then
    select coalesce(sum(valor), 0) into pago from pagamento where medicao_id = new.medicao_id;
    if pago + new.valor > m.valor_liquido then
      raise exception 'O pagamento passa do valor líquido a pagar (saldo de R$ %).',
        moeda_br(m.valor_liquido - pago) using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger pagamento_valida before insert on pagamento for each row execute function validar_pagamento();
create trigger nota_fiscal_valida before insert on nota_fiscal for each row execute function validar_pagamento();

create function evento_medicao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  k contrato%rowtype;
begin
  if tg_op = 'UPDATE' and new.situacao is distinct from old.situacao and new.situacao in ('aprovada', 'cancelada') then
    select * into k from contrato where id = new.contrato_id;
    insert into obra_evento (orgao_id, obra_id, tipo, resumo, usuario_id)
    values (new.orgao_id, k.obra_id, 'medicao',
            'Medição ' || lpad(new.numero::text, 2, '0') || case when new.ajuste then ' (ajuste)' else '' end || ' do contrato ' || k.numero || ' '
            || case new.situacao when 'aprovada' then 'aprovada: R$ ' || moeda_br(new.valor_bruto) else 'cancelada' end || '.',
            ctx_usuario());
  end if;
  return new;
end $$;
create trigger medicao_evento after update on medicao for each row execute function evento_medicao();

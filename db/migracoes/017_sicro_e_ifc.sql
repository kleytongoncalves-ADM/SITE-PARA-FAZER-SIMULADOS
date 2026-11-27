-- SICRO e leitura de IFC.
--
-- SICRO: o DNIT publica preços com 4 casas (custo horário de equipamento, mão de obra e
-- materiais). Arredondar para 2 casas antes de multiplicar pelo coeficiente desvia o custo
-- da composição; os preços passam a ser guardados com 4 casas, inclusive na cópia congelada
-- do orçamento. O valor final do item continua com 2 casas.
alter table preco_insumo alter column preco type numeric(16,4);
alter table orcamento_item_insumo alter column preco type numeric(16,4);

-- ---------------------------------------------------------------------------
-- Leitura de IFC
-- ---------------------------------------------------------------------------
-- O arquivo é lido no navegador; o sistema guarda só o resultado: os quantitativos por
-- classe, tipo e material, e o que foi lançado de cada um no orçamento.
create table ifc_leitura (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null references orcamento(id),
  arquivo text not null check (btrim(arquivo) <> ''),
  tamanho bigint not null check (tamanho >= 0),
  schema_ifc text,
  projeto text,
  aplicativo text,
  elementos int not null default 0,
  avisos jsonb not null default '[]',
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index ifc_leitura_por_orcamento on ifc_leitura (orcamento_id, criado_em desc);

create table ifc_quantitativo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  leitura_id uuid not null references ifc_leitura(id) on delete cascade,
  ordem int not null,
  classe text not null,
  rotulo text not null,
  tipo text not null,
  material text,
  pavimentos text[] not null default '{}',
  elementos int not null check (elementos > 0),
  comprimento numeric(16,3) check (comprimento >= 0),
  area numeric(16,3) check (area >= 0),
  volume numeric(16,4) check (volume >= 0),
  peso numeric(16,3) check (peso >= 0),
  calculadas text[] not null default '{}',
  unique (leitura_id, ordem)
);

create table ifc_lancamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  quantitativo_id uuid not null references ifc_quantitativo(id) on delete cascade,
  item_id uuid not null references orcamento_item(id) on delete cascade,
  medida text not null check (medida in ('comprimento', 'area', 'volume', 'peso', 'elementos')),
  multiplicador numeric(12,4) not null default 1 check (multiplicador > 0),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index ifc_lancamento_por_quantitativo on ifc_lancamento (quantitativo_id);
create index ifc_lancamento_por_item on ifc_lancamento (item_id);

do $$
declare t text;
begin
  foreach t in array array['ifc_leitura', 'ifc_quantitativo', 'ifc_lancamento'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())',
      t || '_por_orgao', t);
  end loop;
end $$;

-- Os quantitativos lidos não mudam: só se lê de novo.
create trigger ifc_quantitativo_sem_alteracao before update on ifc_quantitativo for each row execute function proibir_alteracao();

-- Medidas de execução por item do orçamento, para desenhar a obra na vista 3D.
--
-- O orçamento guarda quantidade e unidade, mas não a forma. Aqui a equipe informa
-- onde o item é executado (local) e a altura ou o comprimento do elemento.
-- Não altera quantidades, preços nem totais; vale também para orçamento aprovado.

create table orcamento_item_medida (
  item_id uuid primary key references orcamento_item(id) on delete cascade,
  orgao_id uuid not null references orgao(id),
  orcamento_id uuid not null references orcamento(id),
  local text not null check (length(trim(local)) > 0),
  altura numeric(12,3) check (altura > 0),
  comprimento numeric(12,3) check (comprimento > 0),
  atualizado_em timestamptz not null default now()
);
create index orcamento_item_medida_orcamento on orcamento_item_medida (orcamento_id);

alter table orcamento_item_medida enable row level security;
alter table orcamento_item_medida force row level security;
create policy orcamento_item_medida_por_orgao on orcamento_item_medida
  using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao());

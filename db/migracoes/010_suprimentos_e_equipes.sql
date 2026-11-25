-- Etapa 7: suprimentos, equipes e recursos.
--
-- Suprimentos: catálogo de materiais do órgão (a lista de compras nasce do
-- orçamento aprovado), requisição com aprovação, cotação por fornecedor,
-- pedido, recebimento com conferência e recusa, e estoque por obra feito só
-- de movimentos. O estoque não fica negativo; a saída aponta o item de
-- serviço e vira custo realizado pelo custo médio.
--
-- Equipes: pessoas (equipe própria ou terceirizada), ASO e treinamentos com
-- validade, alocação por obra (bloqueada com habilitação vencida),
-- apontamento de horas por item, equipamentos com manutenção e documentos
-- das empresas.

create type tipo_movimento as enum ('entrada', 'saida', 'perda', 'ajuste_entrada', 'ajuste_saida', 'transferencia_saida', 'transferencia_entrada');
create type situacao_requisicao as enum ('rascunho', 'enviada', 'aprovada', 'recusada', 'cancelada');
create type situacao_pedido as enum ('emitido', 'parcial', 'recebido', 'cancelado');

-- ---------------------------------------------------------------------------
-- Materiais
-- ---------------------------------------------------------------------------
create table material (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  codigo text,
  descricao text not null check (btrim(descricao) <> ''),
  unidade text not null check (btrim(unidade) <> ''),
  grupo text,
  perda_prevista numeric(5,2) not null default 5 check (perda_prevista between 0 and 100),
  ativo boolean not null default true,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz
);
create unique index material_codigo on material (orgao_id, codigo) where codigo is not null;
create unique index material_descricao on material (orgao_id, lower(descricao), lower(unidade)) where codigo is null;

-- Quantidade prevista do material no orçamento aprovado da obra.
create function previsto_material(p_obra uuid, p_material uuid) returns numeric language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(oi.quantidade * x.coeficiente), 0)
    from material m
    join orcamento o on o.obra_id = p_obra and o.situacao = 'aprovado'
    join orcamento_item oi on oi.orcamento_id = o.id
    join orcamento_item_insumo x on x.item_id = oi.id and x.tipo = 'material' and x.codigo = m.codigo
   where m.id = p_material
$$;

-- ---------------------------------------------------------------------------
-- Requisição
-- ---------------------------------------------------------------------------
create table requisicao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  data date not null default hoje_local(),
  necessidade date not null,
  observacao text,
  situacao situacao_requisicao not null default 'rascunho',
  enviada_em timestamptz,
  decidida_por uuid references usuario(id),
  decidida_em timestamptz,
  motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero),
  check (situacao not in ('recusada', 'cancelada') or coalesce(btrim(motivo), '') <> '')
);
create index requisicao_por_obra on requisicao (obra_id, situacao);

create table requisicao_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  requisicao_id uuid not null references requisicao(id),
  material_id uuid not null references material(id),
  quantidade numeric(16,4) not null check (quantidade > 0),
  item_servico_id uuid references item_servico(id),
  justificativa text,
  unique (requisicao_id, material_id)
);
create index requisicao_item_por_material on requisicao_item (material_id);

-- ---------------------------------------------------------------------------
-- Cotação, pedido e recebimento
-- ---------------------------------------------------------------------------
create table cotacao_compra (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  requisicao_id uuid not null references requisicao(id),
  empresa_id uuid not null references empresa(id),
  data date not null default hoje_local(),
  validade date,
  prazo_entrega int check (prazo_entrega between 0 and 365),
  condicao_pagamento text,
  frete numeric(14,2) not null default 0 check (frete >= 0),
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (requisicao_id, empresa_id),
  check (validade is null or validade >= data)
);

create table cotacao_compra_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  cotacao_id uuid not null references cotacao_compra(id),
  requisicao_item_id uuid not null references requisicao_item(id),
  preco_unitario numeric(14,4) not null check (preco_unitario > 0),
  unique (cotacao_id, requisicao_item_id)
);

create table pedido (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  numero int not null check (numero > 0),
  requisicao_id uuid not null references requisicao(id),
  cotacao_id uuid not null references cotacao_compra(id),
  empresa_id uuid not null references empresa(id),
  data date not null default hoje_local(),
  prazo_entrega date not null,
  condicao_pagamento text,
  frete numeric(14,2) not null default 0 check (frete >= 0),
  justificativa text,
  situacao situacao_pedido not null default 'emitido',
  cancelado_motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero),
  check (prazo_entrega >= data),
  check (situacao <> 'cancelado' or coalesce(btrim(cancelado_motivo), '') <> '')
);
create index pedido_por_obra on pedido (obra_id, situacao);

create table pedido_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  pedido_id uuid not null references pedido(id),
  requisicao_item_id uuid not null references requisicao_item(id),
  material_id uuid not null references material(id),
  quantidade numeric(16,4) not null check (quantidade > 0),
  preco_unitario numeric(14,4) not null check (preco_unitario > 0),
  unique (pedido_id, requisicao_item_id)
);

create table recebimento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  pedido_id uuid not null references pedido(id),
  data date not null,
  nota_fiscal text not null check (btrim(nota_fiscal) <> ''),
  no_prazo boolean not null default true,
  nota_qualidade int not null check (nota_qualidade between 1 and 5),
  nota_atendimento int not null check (nota_atendimento between 1 and 5),
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index recebimento_por_pedido on recebimento (pedido_id);

create table recebimento_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  recebimento_id uuid not null references recebimento(id),
  pedido_item_id uuid not null references pedido_item(id),
  quantidade numeric(16,4) not null default 0 check (quantidade >= 0),
  recusada numeric(16,4) not null default 0 check (recusada >= 0),
  motivo_recusa text,
  unique (recebimento_id, pedido_item_id),
  check (quantidade + recusada > 0),
  check (recusada = 0 or coalesce(btrim(motivo_recusa), '') <> '')
);

-- ---------------------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------------------
create table movimento_estoque (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  material_id uuid not null references material(id),
  data date not null,
  tipo tipo_movimento not null,
  quantidade numeric(16,4) not null check (quantidade > 0),
  custo_unitario numeric(14,4) not null default 0 check (custo_unitario >= 0),
  item_servico_id uuid references item_servico(id),
  recebimento_item_id uuid references recebimento_item(id),
  obra_destino_id uuid references obra(id),
  par_id uuid references movimento_estoque(id),
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (tipo <> 'saida' or item_servico_id is not null),
  check (tipo <> 'transferencia_saida' or (obra_destino_id is not null and obra_destino_id <> obra_id)),
  check (tipo not in ('perda', 'ajuste_entrada', 'ajuste_saida', 'transferencia_saida') or coalesce(btrim(observacao), '') <> '')
);
create index movimento_por_obra on movimento_estoque (obra_id, material_id, data);
create index movimento_por_item on movimento_estoque (item_servico_id) where item_servico_id is not null;

create function sinal_movimento(t tipo_movimento) returns int language sql immutable as $$
  select case when t in ('entrada', 'ajuste_entrada', 'transferencia_entrada') then 1 else -1 end
$$;

create table estoque_minimo (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  material_id uuid not null references material(id),
  quantidade numeric(16,4) not null check (quantidade >= 0),
  unique (obra_id, material_id)
);

-- ---------------------------------------------------------------------------
-- Equipes e recursos
-- ---------------------------------------------------------------------------
create table pessoa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  nome text not null check (btrim(nome) <> ''),
  cpf text not null check (cpf ~ '^\d{11}$'),
  funcao text not null check (btrim(funcao) <> ''),
  empresa_id uuid references empresa(id),
  custo_hora numeric(10,2) check (custo_hora >= 0),
  ativa boolean not null default true,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  constraint pessoa_cpf_unico unique (orgao_id, cpf)
);

create table habilitacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  pessoa_id uuid not null references pessoa(id),
  tipo text not null check (tipo in ('aso', 'treinamento')),
  descricao text not null check (btrim(descricao) <> ''),
  data date not null,
  validade date not null,
  carga_horaria int check (carga_horaria between 1 and 1000),
  obrigatorio boolean not null default true,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (validade >= data)
);
create index habilitacao_por_pessoa on habilitacao (pessoa_id, tipo, descricao, validade desc);

-- Pendência de habilitação da pessoa numa data: texto do primeiro problema ou null.
create function pendencia_habilitacao(p_pessoa uuid, p_data date) returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select 'sem ASO válido' where not exists (
       select 1 from habilitacao h where h.pessoa_id = p_pessoa and h.tipo = 'aso' and h.data <= p_data and h.validade >= p_data)),
    (select t.descricao || ' vencido'
       from (select distinct on (h.descricao) h.descricao, h.validade from habilitacao h
              where h.pessoa_id = p_pessoa and h.tipo = 'treinamento' and h.obrigatorio and h.data <= p_data
              order by h.descricao, h.validade desc) t
      where t.validade < p_data order by t.descricao limit 1))
$$;

create table alocacao_pessoa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  pessoa_id uuid not null references pessoa(id),
  funcao text,
  inicio date not null,
  fim date,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  check (fim is null or fim >= inicio)
);
create index alocacao_pessoa_por_obra on alocacao_pessoa (obra_id, inicio);
create index alocacao_pessoa_por_pessoa on alocacao_pessoa (pessoa_id);

create table apontamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  pessoa_id uuid not null references pessoa(id),
  data date not null,
  item_servico_id uuid references item_servico(id),
  horas_normais numeric(4,1) not null default 0 check (horas_normais between 0 and 24),
  horas_extras numeric(4,1) not null default 0 check (horas_extras between 0 and 24),
  custo_hora numeric(10,2),
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (horas_normais + horas_extras > 0)
);
create index apontamento_por_obra on apontamento (obra_id, data);
create index apontamento_por_item on apontamento (item_servico_id) where item_servico_id is not null;

create table equipamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  descricao text not null check (btrim(descricao) <> ''),
  identificacao text,
  propriedade text not null default 'proprio' check (propriedade in ('proprio', 'locado')),
  empresa_id uuid references empresa(id),
  custo_hora numeric(10,2) check (custo_hora >= 0),
  ativo boolean not null default true,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  check (propriedade = 'proprio' or empresa_id is not null)
);

create table manutencao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  equipamento_id uuid not null references equipamento(id),
  data date not null,
  tipo text not null check (tipo in ('preventiva', 'corretiva', 'revisao')),
  descricao text not null check (btrim(descricao) <> ''),
  proxima_revisao date,
  custo numeric(14,2) check (custo >= 0),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (proxima_revisao is null or proxima_revisao > data)
);
create index manutencao_por_equipamento on manutencao (equipamento_id, data desc);

-- Equipamento disponível numa data: a revisão da última manutenção não venceu.
create function equipamento_disponivel(p_eq uuid, p_data date) returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce((select m.proxima_revisao is null or m.proxima_revisao >= p_data
                     from manutencao m where m.equipamento_id = p_eq and m.data <= p_data
                    order by m.data desc, m.criado_em desc limit 1), true)
$$;

create table alocacao_equipamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  equipamento_id uuid not null references equipamento(id),
  inicio date not null,
  fim date,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  check (fim is null or fim >= inicio)
);
create index alocacao_equipamento_por_obra on alocacao_equipamento (obra_id, inicio);

create table apontamento_equipamento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  equipamento_id uuid not null references equipamento(id),
  data date not null,
  item_servico_id uuid references item_servico(id),
  horas numeric(4,1) not null check (horas > 0 and horas <= 24),
  custo_hora numeric(10,2),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index apontamento_eq_por_obra on apontamento_equipamento (obra_id, data);

create table documento_empresa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  empresa_id uuid not null references empresa(id),
  tipo text not null check (tipo in ('cnd_federal', 'fgts', 'trabalhista', 'estadual', 'municipal', 'seguro', 'alvara', 'outro')),
  numero text,
  emissao date,
  validade date not null,
  observacao text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  check (emissao is null or validade >= emissao)
);
create index documento_empresa_por_empresa on documento_empresa (empresa_id, tipo, validade desc);

-- ---------------------------------------------------------------------------
-- Isolamento por órgão, carimbo, auditoria e imutabilidade
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['material', 'requisicao', 'requisicao_item', 'cotacao_compra', 'cotacao_compra_item', 'pedido', 'pedido_item',
                           'recebimento', 'recebimento_item', 'movimento_estoque', 'estoque_minimo', 'pessoa', 'habilitacao',
                           'alocacao_pessoa', 'apontamento', 'equipamento', 'manutencao', 'alocacao_equipamento',
                           'apontamento_equipamento', 'documento_empresa'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())', t || '_por_orgao', t);
  end loop;
  foreach t in array array['material', 'requisicao', 'pedido', 'pessoa', 'equipamento', 'alocacao_pessoa', 'alocacao_equipamento'] loop
    execute format('create trigger %I before insert or update on %I for each row execute function carimbar()', t || '_carimbo', t);
    execute format('create trigger %I after insert or update on %I for each row execute function auditar()', t || '_auditoria', t);
  end loop;
  foreach t in array array['cotacao_compra', 'recebimento', 'movimento_estoque', 'habilitacao', 'apontamento', 'manutencao',
                           'apontamento_equipamento', 'documento_empresa'] loop
    execute format('create trigger %I before insert on %I for each row execute function carimbar()', t || '_carimbo', t);
    execute format('create trigger %I after insert on %I for each row execute function auditar()', t || '_auditoria', t);
    execute format('create trigger %I before update on %I for each row execute function proibir_alteracao()', t || '_sem_alteracao', t);
  end loop;
  foreach t in array array['material', 'requisicao', 'cotacao_compra', 'cotacao_compra_item', 'pedido', 'pedido_item', 'recebimento',
                           'recebimento_item', 'movimento_estoque', 'pessoa', 'habilitacao', 'alocacao_pessoa', 'equipamento',
                           'manutencao', 'alocacao_equipamento', 'documento_empresa'] loop
    execute format('create trigger %I before delete on %I for each row execute function proibir_exclusao()', t || '_sem_exclusao', t);
  end loop;
end $$;

create trigger requisicao_numero before insert on requisicao for each row execute function numerar_por_obra();
create trigger pedido_numero before insert on pedido for each row execute function numerar_por_obra();
create trigger cotacao_item_sem_alteracao before update on cotacao_compra_item for each row execute function proibir_alteracao();
create trigger pedido_item_sem_alteracao before update on pedido_item for each row execute function proibir_alteracao();
create trigger recebimento_item_sem_alteracao before update on recebimento_item for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Regras da requisição
-- ---------------------------------------------------------------------------
create function proteger_requisicao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'rascunho' then
      raise exception 'A requisição nasce em elaboração.' using errcode = 'P0001';
    end if;
    if new.necessidade < new.data then
      raise exception 'A data de necessidade não pode ser anterior à requisição.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.numero <> old.numero or new.data <> old.data then
    raise exception 'A obra, o número e a data da requisição não mudam.' using errcode = 'P0001';
  end if;
  if old.situacao in ('recusada', 'cancelada') then
    raise exception 'Requisição % não se altera.', old.situacao using errcode = 'P0001';
  end if;
  if old.situacao <> 'rascunho' and (new.necessidade <> old.necessidade or new.observacao is distinct from old.observacao) and new.situacao = old.situacao then
    raise exception 'A requisição enviada não se altera.' using errcode = 'P0001';
  end if;
  if new.situacao <> old.situacao then
    if not ((old.situacao = 'rascunho' and new.situacao in ('enviada', 'cancelada'))
         or (old.situacao = 'enviada' and new.situacao in ('aprovada', 'recusada', 'cancelada'))
         or (old.situacao = 'aprovada' and new.situacao = 'cancelada')) then
      raise exception 'Mudança de situação não permitida.' using errcode = 'P0001';
    end if;
    if new.situacao = 'enviada' then
      if not exists (select 1 from requisicao_item where requisicao_id = new.id) then
        raise exception 'Inclua ao menos um material.' using errcode = 'P0001';
      end if;
      new.enviada_em := now();
    elsif new.situacao in ('aprovada', 'recusada') then
      new.decidida_por := ctx_usuario();
      new.decidida_em := now();
      if new.decidida_por = old.criado_por then
        raise exception 'A requisição é aprovada por outra pessoa, não por quem a fez.' using errcode = 'P0001';
      end if;
    elsif new.situacao = 'cancelada' and old.situacao = 'aprovada'
          and exists (select 1 from pedido where requisicao_id = new.id and situacao <> 'cancelado') then
      raise exception 'Cancele antes os pedidos desta requisição.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger requisicao_protegida before insert or update on requisicao for each row execute function proteger_requisicao();

-- Itens só na requisição em elaboração; acima do previsto, justificativa.
create function validar_requisicao_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  r requisicao%rowtype;
  previsto numeric;
  pedido_antes numeric;
  ok boolean;
begin
  select * into r from requisicao where id = coalesce(new.requisicao_id, old.requisicao_id);
  if r.situacao <> 'rascunho' then
    raise exception 'A requisição enviada não se altera.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.item_servico_id is not null then
    select true into ok from item_servico i join contrato k on k.id = i.contrato_id where i.id = new.item_servico_id and k.obra_id = r.obra_id;
    if ok is null then
      raise exception 'O item de serviço não é desta obra.' using errcode = 'P0001';
    end if;
  end if;
  previsto := previsto_material(r.obra_id, new.material_id);
  select coalesce(sum(i.quantidade), 0) into pedido_antes
    from requisicao_item i join requisicao q on q.id = i.requisicao_id
   where q.obra_id = r.obra_id and i.material_id = new.material_id and q.situacao not in ('recusada', 'cancelada') and i.id <> new.id;
  if pedido_antes + new.quantidade > previsto and coalesce(btrim(new.justificativa), '') = '' then
    raise exception 'Quantidade acima do previsto no orçamento: informe a justificativa.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger requisicao_item_valida before insert or update or delete on requisicao_item for each row execute function validar_requisicao_item();

create function validar_cotacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_requisicao;
begin
  select situacao into s from requisicao where id = new.requisicao_id;
  if s <> 'aprovada' then
    raise exception 'A cotação é feita na requisição aprovada.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from empresa where id = new.empresa_id and ativa) then
    raise exception 'Fornecedor inativo.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cotacao_valida before insert on cotacao_compra for each row execute function validar_cotacao();

create function validar_cotacao_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare ok boolean;
begin
  select true into ok from cotacao_compra c join requisicao_item i on i.requisicao_id = c.requisicao_id
   where c.id = new.cotacao_id and i.id = new.requisicao_item_id;
  if ok is null then
    raise exception 'O item não é da requisição cotada.' using errcode = 'P0001';
  end if;
  if exists (select 1 from pedido p where p.cotacao_id = new.cotacao_id and p.situacao <> 'cancelado') then
    raise exception 'Cotação com pedido emitido não se altera.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cotacao_item_valida before insert on cotacao_compra_item for each row execute function validar_cotacao_item();

-- ---------------------------------------------------------------------------
-- Regras do pedido
-- ---------------------------------------------------------------------------
create function proteger_pedido() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare c cotacao_compra%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into c from cotacao_compra where id = new.cotacao_id;
    if c.requisicao_id <> new.requisicao_id or c.empresa_id <> new.empresa_id then
      raise exception 'O pedido segue a cotação do fornecedor.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from requisicao where id = new.requisicao_id and situacao = 'aprovada' and obra_id = new.obra_id) then
      raise exception 'O pedido é emitido a partir de requisição aprovada.' using errcode = 'P0001';
    end if;
    if new.situacao <> 'emitido' then
      raise exception 'O pedido nasce emitido.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.numero <> old.numero or new.cotacao_id <> old.cotacao_id or new.empresa_id <> old.empresa_id
     or new.data <> old.data or new.prazo_entrega <> old.prazo_entrega or new.frete <> old.frete then
    raise exception 'Os dados do pedido não mudam.' using errcode = 'P0001';
  end if;
  if old.situacao in ('recebido', 'cancelado') and new.situacao <> old.situacao then
    raise exception 'Pedido % não muda de situação.', old.situacao using errcode = 'P0001';
  end if;
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado'
     and exists (select 1 from recebimento where pedido_id = new.id) then
    raise exception 'Pedido com recebimento não se cancela.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger pedido_protegido before insert or update on pedido for each row execute function proteger_pedido();

create function validar_pedido_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  p pedido%rowtype;
  ri requisicao_item%rowtype;
  cotado numeric;
begin
  select * into p from pedido where id = new.pedido_id;
  select * into ri from requisicao_item where id = new.requisicao_item_id;
  if ri.requisicao_id <> p.requisicao_id or ri.material_id <> new.material_id then
    raise exception 'O item não é da requisição do pedido.' using errcode = 'P0001';
  end if;
  select preco_unitario into cotado from cotacao_compra_item where cotacao_id = p.cotacao_id and requisicao_item_id = ri.id;
  if cotado is null or cotado <> new.preco_unitario then
    raise exception 'O preço do pedido é o preço cotado.' using errcode = 'P0001';
  end if;
  if new.quantidade <> ri.quantidade then
    raise exception 'A quantidade do pedido é a quantidade requisitada.' using errcode = 'P0001';
  end if;
  if exists (select 1 from pedido_item x join pedido y on y.id = x.pedido_id
              where x.requisicao_item_id = ri.id and y.situacao <> 'cancelado' and x.id <> new.id) then
    raise exception 'Este material já está em outro pedido.' using errcode = 'P0001';
  end if;
  if exists (select 1 from recebimento where pedido_id = p.id) then
    raise exception 'Pedido com recebimento não se altera.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger pedido_item_valida before insert on pedido_item for each row execute function validar_pedido_item();

-- Recebimento: no prazo calculado; itens até o pedido; entrada no estoque.
create function validar_recebimento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare p pedido%rowtype;
begin
  select * into p from pedido where id = new.pedido_id;
  if p.situacao not in ('emitido', 'parcial') then
    raise exception 'Pedido % não recebe material.', p.situacao using errcode = 'P0001';
  end if;
  if new.data > hoje_local() then
    raise exception 'A data do recebimento não pode ser futura.' using errcode = 'P0001';
  end if;
  if new.data < p.data then
    raise exception 'O recebimento não pode ser anterior ao pedido.' using errcode = 'P0001';
  end if;
  new.no_prazo := new.data <= p.prazo_entrega;
  return new;
end $$;
create trigger recebimento_valida before insert on recebimento for each row execute function validar_recebimento();

create function receber_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  r recebimento%rowtype;
  pi pedido_item%rowtype;
  total numeric;
begin
  select * into r from recebimento where id = new.recebimento_id;
  select * into pi from pedido_item where id = new.pedido_item_id for update;
  if pi.pedido_id <> r.pedido_id then
    raise exception 'O item não é do pedido recebido.' using errcode = 'P0001';
  end if;
  select coalesce(sum(x.quantidade + x.recusada), 0) into total from recebimento_item x where x.pedido_item_id = pi.id and x.id <> new.id;
  if total + new.quantidade + new.recusada > pi.quantidade then
    raise exception 'Quantidade acima do saldo a receber do pedido.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger recebimento_item_recebe before insert on recebimento_item for each row execute function receber_item();

-- Depois de cada item recebido: entrada no estoque e situação do pedido.
create function situar_pedido() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  pid uuid;
  falta boolean;
  r recebimento%rowtype;
  pi pedido_item%rowtype;
  p pedido%rowtype;
begin
  select * into r from recebimento where id = new.recebimento_id;
  select * into pi from pedido_item where id = new.pedido_item_id;
  select * into p from pedido where id = pi.pedido_id;
  pid := p.id;
  if new.quantidade > 0 then
    insert into movimento_estoque (orgao_id, obra_id, material_id, data, tipo, quantidade, custo_unitario, recebimento_item_id, observacao)
    values (new.orgao_id, p.obra_id, pi.material_id, r.data, 'entrada', new.quantidade, pi.preco_unitario, new.id,
            'Pedido nº ' || p.numero || ', NF ' || r.nota_fiscal);
  end if;
  select exists (select 1 from pedido_item i where i.pedido_id = pid
                  and i.quantidade > coalesce((select sum(x.quantidade + x.recusada) from recebimento_item x where x.pedido_item_id = i.id), 0))
    into falta;
  update pedido set situacao = case when falta then 'parcial'::situacao_pedido else 'recebido'::situacao_pedido end
   where id = pid and situacao in ('emitido', 'parcial');
  return new;
end $$;
create trigger recebimento_item_situa after insert on recebimento_item for each row execute function situar_pedido();

-- ---------------------------------------------------------------------------
-- Regras do estoque
-- ---------------------------------------------------------------------------
create function validar_movimento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  saldo numeric;
  valor numeric;
  ok boolean;
begin
  if new.data > hoje_local() then
    raise exception 'A data do movimento não pode ser futura.' using errcode = 'P0001';
  end if;
  if new.tipo = 'entrada' and new.recebimento_item_id is null then
    raise exception 'Entrada de material é feita pelo recebimento do pedido.' using errcode = 'P0001';
  end if;
  if new.tipo = 'transferencia_entrada' and new.par_id is null then
    raise exception 'Entrada por transferência nasce da saída da outra obra.' using errcode = 'P0001';
  end if;
  if new.item_servico_id is not null then
    select true into ok from item_servico i join contrato k on k.id = i.contrato_id where i.id = new.item_servico_id and k.obra_id = new.obra_id;
    if ok is null then
      raise exception 'O item de serviço não é desta obra.' using errcode = 'P0001';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.obra_id::text || new.material_id::text));
  select coalesce(sum(sinal_movimento(tipo) * quantidade), 0), coalesce(sum(sinal_movimento(tipo) * quantidade * custo_unitario), 0)
    into saldo, valor from movimento_estoque where obra_id = new.obra_id and material_id = new.material_id;
  if sinal_movimento(new.tipo) < 0 then
    if new.quantidade > saldo then
      raise exception 'Estoque insuficiente: saldo de % na obra.', replace(trim_scale(saldo)::text, '.', ',') using errcode = 'P0001';
    end if;
    -- Saída pelo custo médio do estoque.
    new.custo_unitario := case when saldo > 0 then round(greatest(valor, 0) / saldo, 4) else 0 end;
  elsif new.tipo = 'ajuste_entrada' and new.custo_unitario = 0 and saldo > 0 then
    new.custo_unitario := round(greatest(valor, 0) / saldo, 4);
  end if;
  return new;
end $$;
create trigger movimento_valida before insert on movimento_estoque for each row execute function validar_movimento();

-- Transferência: a saída gera a entrada na obra de destino pelo mesmo custo.
create function transferir_estoque() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.tipo = 'transferencia_saida' then
    insert into movimento_estoque (orgao_id, obra_id, material_id, data, tipo, quantidade, custo_unitario, par_id, observacao)
    values (new.orgao_id, new.obra_destino_id, new.material_id, new.data, 'transferencia_entrada', new.quantidade, new.custo_unitario, new.id,
            new.observacao);
  end if;
  return new;
end $$;
create trigger movimento_transfere after insert on movimento_estoque for each row execute function transferir_estoque();

-- ---------------------------------------------------------------------------
-- Regras de equipes
-- ---------------------------------------------------------------------------
create function validar_alocacao_pessoa() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  pend text;
  nome_pessoa text;
begin
  if tg_op = 'UPDATE' then
    if new.obra_id <> old.obra_id or new.pessoa_id <> old.pessoa_id or new.inicio <> old.inicio then
      raise exception 'Só o fim da alocação muda.' using errcode = 'P0001';
    end if;
    if old.fim is not null and new.fim is distinct from old.fim then
      raise exception 'Alocação encerrada não se altera.' using errcode = 'P0001';
    end if;
    if new.fim is not null and exists (select 1 from apontamento a where a.pessoa_id = new.pessoa_id and a.obra_id = new.obra_id and a.data > new.fim) then
      raise exception 'Há horas apontadas depois desta data.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  select nome into nome_pessoa from pessoa where id = new.pessoa_id and ativa;
  if nome_pessoa is null then
    raise exception 'Pessoa inativa.' using errcode = 'P0001';
  end if;
  pend := pendencia_habilitacao(new.pessoa_id, new.inicio);
  if pend is not null then
    raise exception '% não pode ser alocado: %.', nome_pessoa, pend using errcode = 'P0001';
  end if;
  if exists (select 1 from alocacao_pessoa x where x.pessoa_id = new.pessoa_id and x.obra_id = new.obra_id and x.id <> new.id
              and x.inicio <= coalesce(new.fim, 'infinity'::date) and coalesce(x.fim, 'infinity'::date) >= new.inicio) then
    raise exception '% já está alocado nesta obra no período.', nome_pessoa using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger alocacao_pessoa_valida before insert or update on alocacao_pessoa for each row execute function validar_alocacao_pessoa();

create function validar_apontamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  pend text;
  total numeric;
  nome_pessoa text;
  ok boolean;
begin
  if new.data > hoje_local() then
    raise exception 'A data do apontamento não pode ser futura.' using errcode = 'P0001';
  end if;
  select nome, custo_hora into nome_pessoa, new.custo_hora from pessoa where id = new.pessoa_id;
  if not exists (select 1 from alocacao_pessoa x where x.pessoa_id = new.pessoa_id and x.obra_id = new.obra_id
                  and x.inicio <= new.data and coalesce(x.fim, 'infinity'::date) >= new.data) then
    raise exception '% não está alocado nesta obra em %.', nome_pessoa, to_char(new.data, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  pend := pendencia_habilitacao(new.pessoa_id, new.data);
  if pend is not null then
    raise exception '%: %.', nome_pessoa, pend using errcode = 'P0001';
  end if;
  if new.item_servico_id is not null then
    select true into ok from item_servico i join contrato k on k.id = i.contrato_id where i.id = new.item_servico_id and k.obra_id = new.obra_id;
    if ok is null then
      raise exception 'O item de serviço não é desta obra.' using errcode = 'P0001';
    end if;
  end if;
  select coalesce(sum(horas_normais + horas_extras), 0) into total from apontamento where pessoa_id = new.pessoa_id and data = new.data;
  if total + new.horas_normais + new.horas_extras > 24 then
    raise exception '%: mais de 24 horas no dia.', nome_pessoa using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger apontamento_valida before insert on apontamento for each row execute function validar_apontamento();
create trigger apontamento_sem_exclusao before delete on apontamento for each row execute function proibir_exclusao();

create function validar_alocacao_equipamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare nome_eq text;
begin
  if tg_op = 'UPDATE' then
    if new.obra_id <> old.obra_id or new.equipamento_id <> old.equipamento_id or new.inicio <> old.inicio then
      raise exception 'Só o fim da alocação muda.' using errcode = 'P0001';
    end if;
    if old.fim is not null and new.fim is distinct from old.fim then
      raise exception 'Alocação encerrada não se altera.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  select descricao into nome_eq from equipamento where id = new.equipamento_id and ativo;
  if nome_eq is null then
    raise exception 'Equipamento inativo.' using errcode = 'P0001';
  end if;
  if not equipamento_disponivel(new.equipamento_id, new.inicio) then
    raise exception '% está com a manutenção vencida.', nome_eq using errcode = 'P0001';
  end if;
  if exists (select 1 from alocacao_equipamento x where x.equipamento_id = new.equipamento_id and x.id <> new.id
              and x.inicio <= coalesce(new.fim, 'infinity'::date) and coalesce(x.fim, 'infinity'::date) >= new.inicio) then
    raise exception '% já está alocado no período.', nome_eq using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger alocacao_equipamento_valida before insert or update on alocacao_equipamento for each row execute function validar_alocacao_equipamento();

create function validar_apontamento_equipamento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  nome_eq text;
  total numeric;
  ok boolean;
begin
  if new.data > hoje_local() then
    raise exception 'A data do apontamento não pode ser futura.' using errcode = 'P0001';
  end if;
  select descricao, custo_hora into nome_eq, new.custo_hora from equipamento where id = new.equipamento_id;
  if not exists (select 1 from alocacao_equipamento x where x.equipamento_id = new.equipamento_id and x.obra_id = new.obra_id
                  and x.inicio <= new.data and coalesce(x.fim, 'infinity'::date) >= new.data) then
    raise exception '% não está alocado nesta obra em %.', nome_eq, to_char(new.data, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if not equipamento_disponivel(new.equipamento_id, new.data) then
    raise exception '% está com a manutenção vencida.', nome_eq using errcode = 'P0001';
  end if;
  if new.item_servico_id is not null then
    select true into ok from item_servico i join contrato k on k.id = i.contrato_id where i.id = new.item_servico_id and k.obra_id = new.obra_id;
    if ok is null then
      raise exception 'O item de serviço não é desta obra.' using errcode = 'P0001';
    end if;
  end if;
  select coalesce(sum(horas), 0) into total from apontamento_equipamento where equipamento_id = new.equipamento_id and data = new.data;
  if total + new.horas > 24 then
    raise exception '%: mais de 24 horas no dia.', nome_eq using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger apontamento_eq_valida before insert on apontamento_equipamento for each row execute function validar_apontamento_equipamento();
create trigger apontamento_eq_sem_exclusao before delete on apontamento_equipamento for each row execute function proibir_exclusao();

create function validar_data_passada() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.data > hoje_local() then
    raise exception 'A data não pode ser futura.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger habilitacao_data before insert on habilitacao for each row execute function validar_data_passada();
create trigger manutencao_data before insert on manutencao for each row execute function validar_data_passada();

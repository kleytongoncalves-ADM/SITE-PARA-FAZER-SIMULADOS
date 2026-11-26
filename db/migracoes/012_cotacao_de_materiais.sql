-- Orçamento CiviObras: cotação de materiais com fornecedores e apuração de preços.
--
-- A solicitação nasce de um orçamento e copia os materiais escolhidos (código,
-- descrição, unidade, quantidade e preço de referência). Cada fornecedor convidado
-- responde por um link próprio, sem conta. As propostas são versões imutáveis e só
-- entram dentro do prazo. A apuração homologada guarda a memória de cálculo.
-- Nenhuma tabela existente muda de estrutura.

create type situacao_solicitacao as enum ('rascunho', 'aberta', 'encerrada', 'apurada', 'cancelada');
create type criterio_apuracao as enum ('item', 'global', 'custo_beneficio');
create type situacao_convite as enum ('convidado', 'abriu', 'respondeu', 'declinou');
create type origem_proposta as enum ('fornecedor', 'equipe');

create table solicitacao_cotacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  orcamento_id uuid not null references orcamento(id),
  numero int check (numero > 0),
  titulo text not null check (btrim(titulo) <> ''),
  prazo timestamptz not null,
  situacao situacao_solicitacao not null default 'rascunho',
  local_entrega text,
  frete_incluso boolean not null default true,
  validade_minima int check (validade_minima between 1 and 365),
  observacao text,
  criterio criterio_apuracao not null default 'item',
  pesos jsonb not null default '{"preco":100,"prazo":0,"pagamento":0,"garantia":0,"historico":0}',
  sigilo boolean not null default true,
  -- Referência de preços do orçamento, gravada no envio.
  fonte text not null,
  uf text not null,
  mes date not null,
  regime text not null,
  arredondamento text not null check (arredondamento in ('arredondar', 'truncar')),
  justificativa_minimo text,
  enviada_em timestamptz,
  enviada_por uuid references usuario(id),
  encerrada_em timestamptz,
  cancelada_motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  unique (obra_id, numero),
  check (situacao <> 'cancelada' or coalesce(btrim(cancelada_motivo), '') <> '')
);
create index solicitacao_por_orcamento on solicitacao_cotacao (orcamento_id);
create index solicitacao_por_situacao on solicitacao_cotacao (orgao_id, situacao, prazo);

create table solicitacao_material (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id) on delete cascade,
  ordem int not null,
  fonte text not null,
  codigo text not null,
  descricao text not null,
  unidade text not null,
  quantidade numeric(16,4) not null check (quantidade > 0),
  preco_referencia numeric(14,2) check (preco_referencia >= 0),
  sem_sinapi boolean not null default false,
  unique (solicitacao_id, ordem)
);
create index solicitacao_material_por_codigo on solicitacao_material (orgao_id, codigo);

create table convite_cotacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id) on delete cascade,
  empresa_id uuid not null references empresa(id),
  contato text,
  email text,
  telefone text,
  motivo text,
  situacao situacao_convite not null default 'convidado',
  serie int not null default 1 check (serie > 0),
  enviado_em timestamptz,
  aberto_em timestamptz,
  declinou_em timestamptz,
  declinou_motivo text,
  rascunho jsonb,
  rascunho_em timestamptz,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (solicitacao_id, empresa_id)
);

-- Endereço de acesso do fornecedor. Guarda só o resumo do link, nunca o link.
-- Não tem isolamento por órgão: é por ela que a página externa descobre o órgão.
create table cotacao_link (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  orgao_id uuid not null references orgao(id),
  convite_id uuid not null references convite_cotacao(id) on delete cascade,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
create index cotacao_link_por_convite on cotacao_link (convite_id);

create table proposta (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  convite_id uuid not null references convite_cotacao(id),
  versao int not null check (versao > 0),
  origem origem_proposta not null default 'fornecedor',
  responsavel_nome text not null check (btrim(responsavel_nome) <> ''),
  responsavel_cargo text,
  responsavel_telefone text,
  prazo_entrega int check (prazo_entrega between 0 and 365),
  validade_dias int check (validade_dias between 1 and 365),
  pagamento_dias int check (pagamento_dias between 0 and 365),
  condicao_pagamento text,
  frete numeric(14,2) not null default 0 check (frete >= 0),
  garantia_meses int check (garantia_meses between 0 and 240),
  observacao text,
  documento text,
  resumo text not null check (resumo ~ '^[0-9a-f]{64}$'),
  rede text,
  lancada_por uuid references usuario(id),
  enviada_em timestamptz not null default now(),
  unique (convite_id, versao),
  check (origem = 'fornecedor' or lancada_por is not null)
);

create table proposta_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  proposta_id uuid not null references proposta(id),
  material_id uuid not null references solicitacao_material(id),
  preco_unitario numeric(14,4) check (preco_unitario > 0),
  marca text,
  modelo text,
  observacao text,
  indisponivel boolean not null default false,
  unique (proposta_id, material_id),
  check (indisponivel or (preco_unitario is not null and coalesce(btrim(marca), '') <> '')),
  check (not indisponivel or preco_unitario is null)
);
create index proposta_item_por_material on proposta_item (material_id);

-- Decisão do responsável sobre um item de um fornecedor: o produto não atende à
-- especificação ou o preço foi desconsiderado. Sempre com justificativa.
create table avaliacao_item (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id),
  convite_id uuid not null references convite_cotacao(id),
  material_id uuid not null references solicitacao_material(id),
  tipo text not null check (tipo in ('nao_atende', 'desconsiderado')),
  justificativa text not null check (length(btrim(justificativa)) >= 10),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (convite_id, material_id)
);

create table apuracao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id),
  numero int not null check (numero > 0),
  criterio criterio_apuracao not null,
  pesos jsonb not null,
  resultado jsonb not null,
  total_referencia numeric(16,2),
  total_resultado numeric(16,2),
  economia numeric(16,2),
  vencedor_convite_id uuid references convite_cotacao(id),
  escolhido_convite_id uuid references convite_cotacao(id),
  justificativa text,
  codigo text not null check (codigo ~ '^[0-9a-f]{64}$'),
  homologada_por uuid references usuario(id),
  homologada_em timestamptz not null default now(),
  unique (solicitacao_id, numero)
);

create table evento_cotacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id) on delete cascade,
  convite_id uuid references convite_cotacao(id) on delete cascade,
  tipo text not null,
  resumo text not null,
  detalhe jsonb,
  rede text,
  usuario_id uuid references usuario(id),
  em timestamptz not null default now()
);
create index evento_cotacao_por_solicitacao on evento_cotacao (solicitacao_id, em);

create table marca (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  nome text not null check (btrim(nome) <> ''),
  criado_em timestamptz not null default now()
);
create unique index marca_nome_unico on marca (orgao_id, lower(nome));

-- ---------------------------------------------------------------------------
-- Proteção por órgão, carimbo e auditoria
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['solicitacao_cotacao', 'solicitacao_material', 'convite_cotacao', 'proposta', 'proposta_item',
                           'avaliacao_item', 'apuracao', 'evento_cotacao', 'marca'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())', t || '_por_orgao', t);
  end loop;
end $$;

alter table cotacao_link enable row level security;
alter table cotacao_link force row level security;
create policy cotacao_link_so_o_sistema on cotacao_link
  using (current_user not in ('anon', 'authenticated')) with check (current_user not in ('anon', 'authenticated'));

create trigger solicitacao_carimbo before insert or update on solicitacao_cotacao for each row execute function carimbar();
create trigger solicitacao_auditoria after insert or update on solicitacao_cotacao for each row execute function auditar();
create trigger solicitacao_numero before insert on solicitacao_cotacao for each row execute function numerar_por_obra();
create trigger convite_carimbo before insert on convite_cotacao for each row execute function carimbar();
create trigger avaliacao_carimbo before insert on avaliacao_item for each row execute function carimbar();

create trigger proposta_sem_alteracao before update on proposta for each row execute function proibir_alteracao();
create trigger proposta_sem_exclusao before delete on proposta for each row execute function proibir_exclusao();
create trigger proposta_item_sem_alteracao before update on proposta_item for each row execute function proibir_alteracao();
create trigger proposta_item_sem_exclusao before delete on proposta_item for each row execute function proibir_exclusao();
create trigger apuracao_sem_alteracao before update on apuracao for each row execute function proibir_alteracao();
create trigger apuracao_sem_exclusao before delete on apuracao for each row execute function proibir_exclusao();
create trigger evento_cotacao_sem_alteracao before update on evento_cotacao for each row execute function proibir_alteracao();
create trigger avaliacao_sem_alteracao before update on avaliacao_item for each row execute function proibir_alteracao();

-- ---------------------------------------------------------------------------
-- Regras da solicitação
-- ---------------------------------------------------------------------------
create function proteger_solicitacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  fixos text[] := array['situacao', 'prazo', 'encerrada_em', 'cancelada_motivo', 'enviada_em', 'enviada_por', 'justificativa_minimo',
                        'fonte', 'uf', 'mes', 'regime', 'arredondamento', 'alterado_por', 'alterado_em'];
  a jsonb; d jsonb; k text;
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'rascunho' then
      raise exception 'A solicitação nasce em elaboração.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.situacao <> 'rascunho' then
      raise exception 'Solicitação enviada não pode ser excluída. Cancele com justificativa.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.situacao = 'cancelada' then
    raise exception 'Solicitação cancelada não pode ser alterada.' using errcode = 'P0001';
  end if;
  if old.situacao <> 'rascunho' then
    a := to_jsonb(old); d := to_jsonb(new);
    foreach k in array fixos loop a := a - k; d := d - k; end loop;
    if a is distinct from d then
      raise exception 'Depois do envio, os dados da solicitação não mudam.' using errcode = 'P0001';
    end if;
    if (old.fonte, old.uf, old.mes, old.regime, old.arredondamento) is distinct from (new.fonte, new.uf, new.mes, new.regime, new.arredondamento) then
      raise exception 'A referência de preços da solicitação não muda depois do envio.' using errcode = 'P0001';
    end if;
  end if;
  if new.situacao is distinct from old.situacao then
    if not ((old.situacao = 'rascunho' and new.situacao in ('aberta'))
         or (old.situacao = 'aberta' and new.situacao in ('encerrada', 'cancelada'))
         or (old.situacao = 'encerrada' and new.situacao in ('apurada', 'aberta', 'cancelada'))
         or (old.situacao = 'apurada' and new.situacao = 'aberta')) then
      raise exception 'Mudança de situação não permitida.' using errcode = 'P0001';
    end if;
    if new.situacao = 'aberta' and new.prazo <= now() then
      raise exception 'O prazo de resposta precisa estar no futuro.' using errcode = 'P0001';
    end if;
    if old.situacao = 'rascunho' then
      if not exists (select 1 from solicitacao_material where solicitacao_id = new.id) then
        raise exception 'Escolha ao menos um material.' using errcode = 'P0001';
      end if;
      if (select count(*) from convite_cotacao where solicitacao_id = new.id) < 3 and coalesce(btrim(new.justificativa_minimo), '') = '' then
        raise exception 'Convide ao menos três fornecedores ou justifique o número menor.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from convite_cotacao where solicitacao_id = new.id) then
        raise exception 'Convide ao menos um fornecedor.' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger solicitacao_protecao before insert or update or delete on solicitacao_cotacao for each row execute function proteger_solicitacao();

create function proteger_material_solicitacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_solicitacao;
begin
  select situacao into s from solicitacao_cotacao where id = coalesce(new.solicitacao_id, old.solicitacao_id);
  -- Exclusão em cascata da solicitação em elaboração: a solicitação já não existe.
  if tg_op = 'DELETE' and s is null then return old; end if;
  if s <> 'rascunho' then
    raise exception 'Os materiais da solicitação não mudam depois do envio.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger solicitacao_material_protecao before insert or update or delete on solicitacao_material
  for each row execute function proteger_material_solicitacao();

create function proteger_convite() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_solicitacao;
begin
  select situacao into s from solicitacao_cotacao where id = coalesce(new.solicitacao_id, old.solicitacao_id);
  if tg_op = 'DELETE' then
    if s is not null and s <> 'rascunho' then
      raise exception 'Convite enviado não pode ser excluído.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if s not in ('rascunho', 'aberta') then
      raise exception 'Só é possível convidar com a solicitação em elaboração ou aberta.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (new.solicitacao_id, new.empresa_id) is distinct from (old.solicitacao_id, old.empresa_id) then
    raise exception 'O fornecedor do convite não muda.' using errcode = 'P0001';
  end if;
  if s in ('encerrada', 'apurada', 'cancelada') and (new.rascunho is distinct from old.rascunho or new.situacao is distinct from old.situacao) then
    raise exception 'O prazo desta cotação terminou.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger convite_protecao before insert or update or delete on convite_cotacao for each row execute function proteger_convite();

-- Proposta só entra com a solicitação aberta e dentro do prazo. Vale para o
-- fornecedor e para a equipe.
create function proteger_proposta() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s record;
begin
  select sc.situacao, sc.prazo into s from convite_cotacao cv join solicitacao_cotacao sc on sc.id = cv.solicitacao_id where cv.id = new.convite_id;
  if s.situacao <> 'aberta' or s.prazo < now() then
    raise exception 'O prazo desta cotação terminou.' using errcode = 'P0001';
  end if;
  if new.versao <> (select coalesce(max(versao), 0) + 1 from proposta where convite_id = new.convite_id) then
    raise exception 'Versão de proposta fora de ordem.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger proposta_protecao before insert on proposta for each row execute function proteger_proposta();

create function proteger_item_proposta() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s record;
begin
  select sc.id, sc.situacao, sc.prazo into s
    from proposta p join convite_cotacao cv on cv.id = p.convite_id join solicitacao_cotacao sc on sc.id = cv.solicitacao_id
   where p.id = new.proposta_id;
  if s.situacao <> 'aberta' or s.prazo < now() then
    raise exception 'O prazo desta cotação terminou.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from solicitacao_material where id = new.material_id and solicitacao_id = s.id) then
    raise exception 'Material fora desta solicitação.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger proposta_item_protecao before insert on proposta_item for each row execute function proteger_item_proposta();

create function proteger_avaliacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s situacao_solicitacao;
begin
  select situacao into s from solicitacao_cotacao where id = coalesce(new.solicitacao_id, old.solicitacao_id);
  if s <> 'encerrada' then
    raise exception 'A avaliação dos itens é feita com a solicitação encerrada e antes da homologação.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from convite_cotacao cv join solicitacao_material m on m.solicitacao_id = cv.solicitacao_id
     where cv.id = new.convite_id and m.id = new.material_id and cv.solicitacao_id = new.solicitacao_id) then
    raise exception 'Item fora desta solicitação.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger avaliacao_protecao before insert or delete on avaliacao_item for each row execute function proteger_avaliacao();

create function proteger_apuracao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (select situacao from solicitacao_cotacao where id = new.solicitacao_id) <> 'encerrada' then
    raise exception 'Só uma solicitação encerrada pode ser homologada.' using errcode = 'P0001';
  end if;
  new.numero := (select coalesce(max(numero), 0) + 1 from apuracao where solicitacao_id = new.solicitacao_id);
  new.homologada_por := coalesce(new.homologada_por, ctx_usuario());
  return new;
end $$;
create trigger apuracao_protecao before insert on apuracao for each row execute function proteger_apuracao();

create function proteger_evento_cotacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Só some junto com a solicitação em elaboração, que é a única que pode ser excluída.
  if exists (select 1 from solicitacao_cotacao where id = old.solicitacao_id) then
    raise exception 'O histórico da cotação não pode ser excluído.' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger evento_cotacao_sem_exclusao before delete on evento_cotacao for each row execute function proteger_evento_cotacao();

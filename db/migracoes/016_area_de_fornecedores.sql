-- Área de fornecedores e convites de cotação por e-mail ou link compartilhado.
--
-- O fornecedor cria a conta da empresa (uma por CNPJ em toda a plataforma), entra
-- com e-mail e senha e encontra as cotações que recebeu de qualquer órgão. A
-- cotação, os itens, as propostas, a comparação e a apuração continuam como estão:
-- esta migração só acrescenta. A conta, o acesso, a sessão, a caixa de mensagens e
-- a experiência declarada não pertencem a um órgão, então ficam visíveis só para o
-- papel do sistema, como o cadastro do dono da plataforma.

create table conta_fornecedor (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique check (cnpj ~ '^\d{14}$'),
  razao_social text not null check (btrim(razao_social) <> ''),
  nome_fantasia text,
  telefone text,
  cidade text,
  uf text check (uf ~ '^[A-Z]{2}$'),
  whatsapp text,
  avisos_email boolean not null default true,
  avisos_whatsapp boolean not null default false,
  whatsapp_autorizado_em timestamptz,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  alterado_em timestamptz
);

-- Um acesso por empresa (e-mail e senha), com as mesmas proteções do login do sistema.
create table acesso_fornecedor (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null unique references conta_fornecedor(id),
  nome text not null check (btrim(nome) <> ''),
  email text not null,
  senha_hash text not null,
  ativo boolean not null default true,
  tentativas_falhas int not null default 0,
  bloqueado_ate timestamptz,
  criado_em timestamptz not null default now()
);
create unique index acesso_fornecedor_email_unico on acesso_fornecedor (lower(email));

create table sessao_fornecedor (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  acesso_id uuid not null references acesso_fornecedor(id),
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null
);

-- Ligação do convite com a conta que o abriu. É por ela que a área do fornecedor
-- descobre o órgão de cada convite, do mesmo jeito que o link da cotação.
create table convite_da_conta (
  convite_id uuid primary key references convite_cotacao(id) on delete cascade,
  conta_id uuid not null references conta_fornecedor(id),
  orgao_id uuid not null references orgao(id),
  vinculado_em timestamptz not null default now()
);
create index convite_da_conta_por_conta on convite_da_conta (conta_id);

-- Link compartilhado da cotação: um por solicitação, pode ser trocado. Guarda só o resumo.
create table cotacao_link_aberto (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid not null references solicitacao_cotacao(id) on delete cascade,
  serie int not null check (serie > 0),
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  unique (solicitacao_id, serie)
);

-- Caixa de mensagens do fornecedor.
create table mensagem_fornecedor (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta_fornecedor(id),
  orgao_id uuid references orgao(id),
  convite_id uuid references convite_cotacao(id) on delete cascade,
  tipo text not null check (tipo in ('nova', 'prorrogacao', 'reabertura', 'cancelamento', 'lembrete', 'aviso')),
  titulo text not null,
  texto text not null,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index mensagem_fornecedor_por_conta on mensagem_fornecedor (conta_id, criado_em desc);

-- Experiência informada pela própria empresa. Aparece sempre como "Declarado".
create table experiencia_fornecedor (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta_fornecedor(id),
  cliente text not null check (btrim(cliente) <> ''),
  cidade text,
  uf text check (uf ~ '^[A-Z]{2}$'),
  servico text not null check (btrim(servico) <> ''),
  ano int check (ano between 1950 and 2100),
  quantidade text,
  criado_em timestamptz not null default now()
);
create index experiencia_por_conta on experiencia_fornecedor (conta_id);

do $$
declare t text;
begin
  foreach t in array array['conta_fornecedor', 'acesso_fornecedor', 'sessao_fornecedor', 'convite_da_conta', 'cotacao_link_aberto',
                           'mensagem_fornecedor', 'experiencia_fornecedor'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (current_user not in (''anon'', ''authenticated'')) with check (current_user not in (''anon'', ''authenticated''))',
      t || '_so_o_sistema', t);
  end loop;
end $$;

-- O fornecedor do órgão passa a saber qual conta é dele. O cadastro do órgão não muda.
alter table empresa add column conta_fornecedor_id uuid references conta_fornecedor(id);

-- No convite: de onde veio e como está o e-mail.
alter table convite_cotacao
  add column origem text not null default 'manual' check (origem in ('manual', 'email', 'link')),
  add column email_situacao text check (email_situacao in ('pendente', 'enviado', 'falhou', 'sem_servico')),
  add column email_enviado_em timestamptz,
  add column email_erro text,
  add column lembrete_em timestamptz;

-- Com o link compartilhado ativo, a solicitação pode ser enviada antes de ter três
-- convidados: os fornecedores chegam pelo link. Com menos de três propostas, a
-- homologação continua exigindo justificativa. O resto da regra é o mesmo da 012.
create or replace function proteger_solicitacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  fixos text[] := array['situacao', 'prazo', 'encerrada_em', 'cancelada_motivo', 'enviada_em', 'enviada_por', 'justificativa_minimo',
                        'fonte', 'uf', 'mes', 'regime', 'arredondamento', 'alterado_por', 'alterado_em'];
  a jsonb; d jsonb; k text;
  com_link boolean;
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
      com_link := exists (select 1 from cotacao_link_aberto where solicitacao_id = new.id and revogado_em is null);
      if not com_link then
        if (select count(*) from convite_cotacao where solicitacao_id = new.id) < 3 and coalesce(btrim(new.justificativa_minimo), '') = '' then
          raise exception 'Convide ao menos três fornecedores ou justifique o número menor.' using errcode = 'P0001';
        end if;
        if not exists (select 1 from convite_cotacao where solicitacao_id = new.id) then
          raise exception 'Convide ao menos um fornecedor.' using errcode = 'P0001';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

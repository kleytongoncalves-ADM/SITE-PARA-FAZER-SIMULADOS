-- Comunicação com fornecedores: vários usuários por empresa fornecedora,
-- recuperação de senha, chat interno entre contratante e fornecedor cadastrado,
-- configuração opcional de envio automático por órgão e histórico de comunicação.
-- Só acrescenta: cotação, convites, propostas e apuração seguem como estão.

-- ---------------------------------------------------------------------------
-- Usuários da empresa fornecedora
-- ---------------------------------------------------------------------------
-- O primeiro acesso (quem cadastrou a empresa) vira o administrador dela.
alter table acesso_fornecedor drop constraint acesso_fornecedor_conta_id_key;
alter table acesso_fornecedor
  add column papel text not null default 'administrador' check (papel in ('administrador', 'cotacoes', 'consulta')),
  add column cargo text,
  add column criado_por uuid references acesso_fornecedor(id);
create index acesso_fornecedor_por_conta on acesso_fornecedor (conta_id);

-- "Esqueci minha senha": guarda só o resumo do código, vale uma hora e uma vez.
create table redefinicao_senha_fornecedor (
  token_hash text primary key,
  acesso_id uuid not null references acesso_fornecedor(id) on delete cascade,
  expira_em timestamptz not null,
  usada_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Configuração de envio automático do órgão (opcional)
-- ---------------------------------------------------------------------------
create table config_comunicacao (
  orgao_id uuid primary key references orgao(id),
  email_automatico boolean not null default false,
  email_corporativo text,
  email_nome text,
  email_validado_em timestamptz,
  email_codigo_hash text,
  email_codigo_expira timestamptz,
  whatsapp_automatico boolean not null default false,
  whatsapp_numero_id text,
  whatsapp_token_cifrado text,
  whatsapp_modelo text,
  alterado_por uuid references usuario(id),
  alterado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chat interno
-- ---------------------------------------------------------------------------
create table conversa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  conta_id uuid not null references conta_fornecedor(id),
  empresa_id uuid references empresa(id),
  solicitacao_id uuid references solicitacao_cotacao(id) on delete set null,
  criada_por uuid references usuario(id),
  criada_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  lida_contratante_em timestamptz,
  lida_fornecedor_em timestamptz
);
-- Uma conversa por fornecedor e cotação; e uma conversa geral (sem cotação) por fornecedor.
create unique index conversa_unica on conversa (orgao_id, conta_id, coalesce(solicitacao_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index conversa_por_orgao on conversa (orgao_id, ultima_em desc);

create table mensagem_conversa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  conversa_id uuid not null references conversa(id) on delete cascade,
  autor text not null check (autor in ('contratante', 'fornecedor')),
  usuario_id uuid references usuario(id),
  acesso_id uuid references acesso_fornecedor(id),
  autor_nome text not null,
  texto text not null check (btrim(texto) <> '' and length(texto) <= 4000),
  criada_em timestamptz not null default now(),
  check ((autor = 'contratante' and usuario_id is not null) or (autor = 'fornecedor' and acesso_id is not null))
);
create index mensagem_conversa_por_conversa on mensagem_conversa (conversa_id, criada_em);

-- Ligação da conversa com a conta: é por ela que o fornecedor encontra as conversas de cada órgão.
create table conversa_da_conta (
  conversa_id uuid primary key references conversa(id) on delete cascade,
  conta_id uuid not null references conta_fornecedor(id),
  orgao_id uuid not null references orgao(id)
);
create index conversa_da_conta_por_conta on conversa_da_conta (conta_id);

-- ---------------------------------------------------------------------------
-- Histórico de comunicação
-- ---------------------------------------------------------------------------
create table registro_comunicacao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  solicitacao_id uuid references solicitacao_cotacao(id) on delete set null,
  convite_id uuid references convite_cotacao(id) on delete set null,
  empresa_id uuid references empresa(id),
  canal text not null check (canal in ('email', 'whatsapp')),
  modo text not null check (modo in ('manual', 'automatico')),
  destino text,
  assunto text,
  situacao text not null check (situacao in ('aberto', 'enviado', 'falhou', 'sem_servico')),
  erro text,
  usuario_id uuid references usuario(id),
  criado_em timestamptz not null default now()
);
create index registro_comunicacao_por_orgao on registro_comunicacao (orgao_id, criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['config_comunicacao', 'conversa', 'mensagem_conversa', 'registro_comunicacao'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())', t || '_por_orgao', t);
  end loop;
  foreach t in array array['redefinicao_senha_fornecedor', 'conversa_da_conta'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (current_user not in (''anon'', ''authenticated'')) with check (current_user not in (''anon'', ''authenticated''))',
      t || '_so_o_sistema', t);
  end loop;
end $$;

-- Administração da plataforma: o dono do CiviObras cadastra as empresas e os
-- funcionários de cada uma, numa área própria (/plataforma), com login próprio.
-- O dono não pertence a nenhuma empresa e por isso fica numa tabela separada.

create table dono_plataforma (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  ativo boolean not null default true,
  tentativas_falhas int not null default 0,
  bloqueado_ate timestamptz,
  criado_em timestamptz not null default now()
);
create unique index dono_plataforma_email_unico on dono_plataforma (lower(email));

create table sessao_plataforma (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  dono_id uuid not null references dono_plataforma(id),
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create trigger dono_sem_exclusao before delete on dono_plataforma for each row execute function proibir_exclusao();

-- Mesma proteção das demais tabelas sem isolamento por órgão (ver 002).
do $$
declare t text;
begin
  foreach t in array array['dono_plataforma', 'sessao_plataforma'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (current_user not in (''anon'', ''authenticated'')) with check (current_user not in (''anon'', ''authenticated''))',
      t || '_so_o_sistema', t);
  end loop;
end $$;

-- Empresas privadas também podem ser cadastradas, e uma empresa pode ser desativada
-- (os funcionários dela deixam de entrar, sem apagar nada).
alter table orgao drop constraint orgao_esfera_check;
alter table orgao add constraint orgao_esfera_check
  check (esfera in ('municipal', 'estadual', 'federal', 'empresa_publica', 'empresa_privada'));
alter table orgao alter column cnpj drop not null;
alter table orgao add column ativo boolean not null default true;

-- A auditoria passa a registrar também quando a alteração veio do dono da plataforma.
alter table auditoria add column operador_id uuid references dono_plataforma(id);

create function ctx_operador() returns uuid language sql stable set search_path = public, pg_temp as
$$ select nullif(current_setting('app.operador_id', true), '')::uuid $$;

create or replace function auditar() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  antes jsonb;
  depois jsonb := to_jsonb(new);
  chave text;
  ignorados text[] := array['alterado_em', 'alterado_por', 'criado_em', 'criado_por', 'tentativas_falhas', 'bloqueado_ate'];
  sigilosos text[] := array['senha_hash'];
begin
  if tg_op = 'INSERT' then
    insert into auditoria (orgao_id, tabela, registro_id, acao, usuario_id, operador_id)
    values (new.orgao_id, tg_table_name, new.id, 'criou', ctx_usuario(), ctx_operador());
    return new;
  end if;
  antes := to_jsonb(old);
  for chave in select jsonb_object_keys(depois) loop
    if chave = any(ignorados) then continue; end if;
    if antes -> chave is distinct from depois -> chave then
      insert into auditoria (orgao_id, tabela, registro_id, acao, campo, valor_anterior, valor_novo, usuario_id, operador_id)
      values (
        new.orgao_id, tg_table_name, new.id, 'alterou', chave,
        case when chave = any(sigilosos) then '(protegido)' else antes ->> chave end,
        case when chave = any(sigilosos) then '(protegido)' else depois ->> chave end,
        ctx_usuario(), ctx_operador()
      );
    end if;
  end loop;
  return new;
end $$;

revoke all on function ctx_operador() from public;

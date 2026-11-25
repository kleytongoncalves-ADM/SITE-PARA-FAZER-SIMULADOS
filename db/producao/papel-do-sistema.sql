-- Papel de banco usado pela aplicação em produção.
--
-- Por que existe: o isolamento entre órgãos é feito pelo próprio banco (proteção
-- por linha). Papéis administrativos, como o "postgres" dos serviços gerenciados,
-- ignoram essa proteção. A aplicação precisa entrar com um papel comum, e ela se
-- recusa a iniciar em produção se o papel puder ignorar a proteção.
--
-- Como usar: rode este arquivo uma vez, como administrador do banco, depois das
-- migrações. Ele NÃO define senha. A senha é definida por quem administra o banco:
--   alter role civiobra_app password 'escolha-uma-senha-longa';
-- Rode de novo depois de cada migração que criar tabelas.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'civiobra_app') then
    create role civiobra_app login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;

grant usage on schema public to civiobra_app;
grant select, insert, update, delete on all tables in schema public to civiobra_app;
revoke insert, update, delete on migracao from civiobra_app;
grant usage, select on all sequences in schema public to civiobra_app;
grant execute on all functions in schema public to civiobra_app;

alter default privileges in schema public grant select, insert, update, delete on tables to civiobra_app;
alter default privileges in schema public grant usage, select on sequences to civiobra_app;
alter default privileges in schema public grant execute on functions to civiobra_app;

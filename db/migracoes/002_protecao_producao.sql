-- Orçamento CiviObras: proteção do banco para uso em produção.
--
-- Serviços de banco gerenciado costumam publicar as tabelas do esquema "public"
-- por uma API própria, usando os papéis "anon" e "authenticated". O sistema não
-- usa essa API: todo acesso passa pelo servidor da aplicação. Esta migração fecha
-- essa porta e liga a proteção por linha nas tabelas que ainda não tinham.
-- É segura em qualquer PostgreSQL: onde esses papéis não existem, só a segunda
-- parte tem efeito.

-- 1. Tabelas sem isolamento por órgão (cadastro do órgão, usuários, sessões e o
--    controle de migrações): só o papel do sistema enxerga.
do $$
declare t text;
begin
  foreach t in array array['orgao', 'usuario', 'sessao', 'migracao'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (current_user not in (''anon'', ''authenticated'')) with check (current_user not in (''anon'', ''authenticated''))',
      t || '_so_o_sistema', t);
  end loop;
end $$;

-- 2. Os papéis da API pública não recebem nenhum privilégio, agora nem depois.
do $$
declare p text;
begin
  foreach p in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = p) then
      execute format('revoke all on all tables in schema public from %I', p);
      execute format('revoke all on all sequences in schema public from %I', p);
      execute format('revoke all on all functions in schema public from %I', p);
      execute format('alter default privileges in schema public revoke all on tables from %I', p);
      execute format('alter default privileges in schema public revoke all on sequences from %I', p);
      execute format('alter default privileges in schema public revoke all on functions from %I', p);
    end if;
  end loop;
end $$;

-- 3. Funções não ficam executáveis por qualquer papel: só por quem recebe a permissão.
revoke all on all functions in schema public from public;
alter default privileges in schema public revoke all on functions from public;

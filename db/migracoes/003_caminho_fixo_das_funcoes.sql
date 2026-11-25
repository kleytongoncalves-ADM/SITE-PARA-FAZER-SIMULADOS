-- Fixa o esquema em que as funções do sistema procuram tabelas e tipos.
-- Sem isso, quem controlasse o search_path da sessão poderia fazer uma função
-- usar um objeto com o mesmo nome em outro esquema.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end $$;

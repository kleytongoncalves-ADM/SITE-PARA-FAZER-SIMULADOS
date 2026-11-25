-- Etapa 8: documentos da obra.
--
-- Projetos, ART/RRT, licenças, laudos e termos, cada um com versões. A versão
-- enviada não muda nem sai: uma revisão é uma nova versão, e o arquivo guarda
-- o resumo SHA-256 para conferência. Documento substituído fica "superado",
-- ligado ao que o substituiu. As exigências da obra (ART de execução, alvará,
-- licença ambiental, ordem de serviço...) são atendidas por um documento ou
-- dispensadas com justificativa.

create table documento (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  contrato_id uuid references contrato(id),
  categoria text not null check (categoria in ('projeto', 'art_rrt', 'licenca', 'laudo', 'termo', 'outro')),
  tipo text not null check (btrim(tipo) <> ''),
  titulo text not null check (btrim(titulo) <> ''),
  numero text,
  emissor text,
  emissao date,
  validade date,
  exigencia text check (exigencia in ('art_projeto', 'art_execucao', 'art_fiscalizacao', 'alvara', 'licenca_ambiental', 'ordem_servico')),
  conselho text check (conselho in ('CREA', 'CAU', 'CFT')),
  profissional text,
  registro text,
  atividade text,
  baixada_em date,
  superado_por uuid references documento(id),
  superado_em timestamptz,
  superado_motivo text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  alterado_por uuid references usuario(id),
  alterado_em timestamptz,
  check (categoria <> 'art_rrt' or (coalesce(btrim(numero), '') <> '' and conselho is not null and coalesce(btrim(profissional), '') <> '')),
  check (validade is null or emissao is null or validade >= emissao),
  check (baixada_em is null or categoria = 'art_rrt'),
  check (superado_por is null or (superado_por <> id and superado_em is not null and coalesce(btrim(superado_motivo), '') <> ''))
);
create index documento_por_obra on documento (obra_id, categoria);
create index documento_validade on documento (validade) where superado_por is null and validade is not null;

create table documento_versao (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  documento_id uuid not null references documento(id),
  numero int not null check (numero > 0),
  nome_arquivo text not null check (btrim(nome_arquivo) <> ''),
  mime text not null,
  tamanho int not null check (tamanho between 1 and 4194304),
  sha256 text not null,
  conteudo bytea not null,
  mudanca text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (documento_id, numero),
  check (octet_length(conteudo) = tamanho)
);

create table documento_dispensa (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  exigencia text not null check (exigencia in ('art_projeto', 'art_execucao', 'art_fiscalizacao', 'alvara', 'licenca_ambiental', 'ordem_servico')),
  justificativa text not null check (btrim(justificativa) <> ''),
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now(),
  unique (obra_id, exigencia)
);

do $$
declare t text;
begin
  foreach t in array array['documento', 'documento_versao', 'documento_dispensa'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao())', t || '_por_orgao', t);
  end loop;
end $$;

create trigger documento_carimbo before insert or update on documento for each row execute function carimbar();
create trigger documento_auditoria after insert or update on documento for each row execute function auditar();
create trigger documento_sem_exclusao before delete on documento for each row execute function proibir_exclusao();
create trigger documento_versao_carimbo before insert on documento_versao for each row execute function carimbar();
create trigger documento_versao_auditoria after insert on documento_versao for each row execute function auditar();
create trigger documento_versao_sem_alteracao before update on documento_versao for each row execute function proibir_alteracao();
create trigger documento_versao_sem_exclusao before delete on documento_versao for each row execute function proibir_exclusao();
create trigger documento_dispensa_carimbo before insert on documento_dispensa for each row execute function carimbar();
create trigger documento_dispensa_auditoria after insert on documento_dispensa for each row execute function auditar();
create trigger documento_dispensa_sem_alteracao before update on documento_dispensa for each row execute function proibir_alteracao();
create trigger documento_dispensa_sem_exclusao before delete on documento_dispensa for each row execute function proibir_exclusao();

-- Documento superado não muda; a substituição aponta para documento da mesma obra e categoria, ainda vigente.
create function proteger_documento() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare s documento%rowtype;
begin
  if new.contrato_id is not null and not exists (select 1 from contrato where id = new.contrato_id and obra_id = new.obra_id) then
    raise exception 'O contrato não é desta obra.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.superado_por is not null then
      raise exception 'O documento nasce vigente.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.categoria <> old.categoria then
    raise exception 'A obra e a categoria do documento não mudam.' using errcode = 'P0001';
  end if;
  if old.superado_por is not null then
    raise exception 'Documento superado não se altera.' using errcode = 'P0001';
  end if;
  if old.baixada_em is not null and new.baixada_em is distinct from old.baixada_em then
    raise exception 'A baixa da ART/RRT não se desfaz.' using errcode = 'P0001';
  end if;
  if new.superado_por is not null then
    select * into s from documento where id = new.superado_por;
    if s.id is null or s.obra_id <> new.obra_id or s.categoria <> new.categoria then
      raise exception 'O substituto é um documento da mesma obra e categoria.' using errcode = 'P0001';
    end if;
    if s.superado_por is not null then
      raise exception 'O substituto também está superado.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger documento_protegido before insert or update on documento for each row execute function proteger_documento();

-- Versão numerada pelo banco, com o resumo do arquivo; documento superado não recebe versão.
create function numerar_versao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform 1 from documento where id = new.documento_id and superado_por is null for update;
  if not found then
    raise exception 'Documento superado não recebe nova versão.' using errcode = 'P0001';
  end if;
  new.numero := coalesce((select max(numero) from documento_versao where documento_id = new.documento_id), 0) + 1;
  new.tamanho := octet_length(new.conteudo);
  new.sha256 := encode(sha256(new.conteudo), 'hex');
  return new;
end $$;
create trigger documento_versao_numero before insert on documento_versao for each row execute function numerar_versao();

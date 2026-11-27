-- Fotos e arquivos de documentos passam a ficar no armazenamento de arquivos
-- (Supabase Storage, bucket privado). O banco guarda só o caminho do arquivo.
--
-- Os registros antigos continuam com o conteúdo no banco até o script
-- `npm run mover-arquivos` copiar, conferir e liberar cada um. Enquanto isso o
-- sistema lê de onde o arquivo estiver: armazenamento ou banco.

-- ---------------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------------
alter table foto
  add column arquivo text check (arquivo is null or btrim(arquivo) <> ''),
  add column arquivo_miniatura text check (arquivo_miniatura is null or btrim(arquivo_miniatura) <> ''),
  alter column conteudo drop not null,
  alter column miniatura drop not null;

alter table foto
  add constraint foto_conteudo_guardado check (conteudo is not null or arquivo is not null),
  add constraint foto_miniatura_guardada check (miniatura is not null or arquivo_miniatura is not null),
  add constraint foto_arquivos_juntos check ((arquivo is null) = (arquivo_miniatura is null));

-- A foto continua imutável. A única mudança aceita é a mudança de lugar do
-- arquivo: primeiro o caminho é gravado (cópia feita), depois o conteúdo do
-- banco é liberado. O caminho, uma vez gravado, não muda.
create function foto_so_muda_de_lugar() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - array['conteudo', 'miniatura', 'arquivo', 'arquivo_miniatura'])
     is distinct from (to_jsonb(old) - array['conteudo', 'miniatura', 'arquivo', 'arquivo_miniatura']) then
    raise exception 'Registros de foto são históricos e não podem ser alterados.' using errcode = 'P0001';
  end if;
  if old.arquivo is not null and (new.arquivo is distinct from old.arquivo or new.arquivo_miniatura is distinct from old.arquivo_miniatura) then
    raise exception 'O caminho da foto no armazenamento não muda.' using errcode = 'P0001';
  end if;
  if (new.conteudo is not null and new.conteudo is distinct from old.conteudo)
     or (new.miniatura is not null and new.miniatura is distinct from old.miniatura) then
    raise exception 'O conteúdo da foto não muda.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace trigger foto_sem_alteracao before update on foto for each row execute function foto_so_muda_de_lugar();

-- ---------------------------------------------------------------------------
-- Versões de documentos
-- ---------------------------------------------------------------------------
alter table documento_versao
  add column arquivo text check (arquivo is null or btrim(arquivo) <> ''),
  alter column conteudo drop not null;

alter table documento_versao
  add constraint documento_versao_conteudo_guardado check (conteudo is not null or arquivo is not null),
  add constraint documento_versao_sha256 check (sha256 ~ '^[0-9a-f]{64}$');

-- Com o arquivo no armazenamento, tamanho e resumo (SHA-256) vêm do sistema,
-- que os calcula sobre os bytes enviados. Com o conteúdo no banco, o banco
-- continua calculando.
create or replace function numerar_versao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform 1 from documento where id = new.documento_id and superado_por is null for update;
  if not found then
    raise exception 'Documento superado não recebe nova versão.' using errcode = 'P0001';
  end if;
  new.numero := coalesce((select max(numero) from documento_versao where documento_id = new.documento_id), 0) + 1;
  if new.conteudo is not null then
    new.tamanho := octet_length(new.conteudo);
    new.sha256 := encode(sha256(new.conteudo), 'hex');
  end if;
  return new;
end $$;

create function versao_so_muda_de_lugar() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - array['conteudo', 'arquivo']) is distinct from (to_jsonb(old) - array['conteudo', 'arquivo']) then
    raise exception 'Registros de documento_versao são históricos e não podem ser alterados.' using errcode = 'P0001';
  end if;
  if old.arquivo is not null and new.arquivo is distinct from old.arquivo then
    raise exception 'O caminho do arquivo no armazenamento não muda.' using errcode = 'P0001';
  end if;
  if new.conteudo is not null and new.conteudo is distinct from old.conteudo then
    raise exception 'O conteúdo da versão não muda.' using errcode = 'P0001';
  end if;
  if new.conteudo is null and new.arquivo is null then
    raise exception 'A versão precisa do arquivo.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace trigger documento_versao_sem_alteracao before update on documento_versao for each row execute function versao_so_muda_de_lugar();

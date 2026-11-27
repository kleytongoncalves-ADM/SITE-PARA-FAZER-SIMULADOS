-- Diário sem internet.
--
-- O diário pode ser preenchido no canteiro sem conexão. Cada lançamento feito
-- no aparelho recebe uma chave própria, gerada lá. Ao voltar a conexão, o
-- aparelho envia o lançamento com essa chave. Envio repetido (conexão que cai
-- no meio, dois toques no botão, duas abas) encontra a chave já registrada e
-- não lança de novo.
--
-- O lançamento só é aceito do mesmo usuário que estava logado no aparelho. A
-- assinatura continua sendo a do login, com data e hora do servidor no
-- momento do envio; a hora em que o lançamento foi feito no aparelho fica
-- registrada aqui, ao lado.
--
-- O mapa das obras usa as colunas latitude e longitude que a obra já tem.

create table diario_envio (
  id uuid primary key,
  orgao_id uuid not null references orgao(id),
  obra_id uuid not null references obra(id),
  data date not null,
  diario_id uuid not null references diario(id),
  usuario_id uuid not null references usuario(id),
  registrado_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  linhas int not null default 0 check (linhas >= 0),
  assinou boolean not null default false,
  como_complemento boolean not null default false
);
create index diario_envio_por_diario on diario_envio (diario_id);

alter table diario_envio enable row level security;
alter table diario_envio force row level security;
create policy diario_envio_por_orgao on diario_envio using (orgao_id = ctx_orgao()) with check (orgao_id = ctx_orgao());

create trigger diario_envio_sem_exclusao before delete on diario_envio for each row execute function proibir_exclusao();
create trigger diario_envio_sem_alteracao before update on diario_envio for each row execute function proibir_alteracao();

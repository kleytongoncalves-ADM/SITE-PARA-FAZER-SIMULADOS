-- Modelo 3D leve do projeto IFC, para a vista 3D do orçamento.
-- A geometria fica no armazenamento de arquivos, em partes; aqui só o número de partes e o tamanho.
alter table ifc_leitura
  add column modelo_partes int not null default 0 check (modelo_partes between 0 and 8),
  add column modelo_bytes bigint not null default 0 check (modelo_bytes >= 0);

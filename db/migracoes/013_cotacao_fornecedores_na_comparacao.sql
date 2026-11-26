-- Cotação de materiais: escolha dos fornecedores que entram na comparação.
--
-- Com mais de três propostas, a equipe pode marcar quais entram no mapa
-- comparativo, na média, na mediana e na apuração. A proposta desmarcada
-- continua guardada e aparece nos documentos como fora da comparação.

alter table convite_cotacao add column na_comparacao boolean not null default true;

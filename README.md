# Orçamento CiviObra

Sistema web de gestão de obras civis para prefeituras, órgãos e empresas públicas.

Este repositório contém a **etapa 1 de 8, a Fundação**: banco de dados, login, perfis de acesso, auditoria, navegação e cadastro de obras. Os demais módulos aparecem no menu com a etapa em que serão entregues.

## O que já funciona

- **Login** com senha protegida, sessão de 8 horas e bloqueio após 5 tentativas erradas.
- **8 perfis de acesso** (direção, gestor de contrato, engenheiro, fiscal, administrativo, financeiro, campo e contratada), mais o administrador do sistema.
- **Obras:** cadastro, edição, busca, filtro por situação e equipe vinculada.
- **Situação da obra** em sequência fixa. Cada mudança exige o documento que a justifica. Para entrar em execução, a obra precisa de ordem de serviço, ART e fiscal.
- **Linha do tempo** da obra, montada sozinha.
- **Auditoria:** quem alterou, quando e o valor anterior de cada campo.
- **Isolamento por órgão** feito no próprio banco. Um órgão não lê nem altera dados de outro.
- **Histórico imutável:** obras, usuários e registros de histórico não são excluídos.

## Como rodar

Requisitos: Node.js 22 e PostgreSQL 16.

```bash
cp .env.example .env        # ajuste a conexão com o banco
npm install
npm run migrar              # cria as tabelas
npm run semear              # opcional: carrega os dados de exemplo
npm run dev                 # http://localhost:3000
```

Os dados de exemplo criam a Prefeitura de Vila Exemplo (fictícia), um usuário por perfil e quatro obras. Os logins e a senha de demonstração estão descritos em `scripts/semear.ts`. Não use os dados de exemplo em produção.

## Testes

```bash
npm test
```

Os testes usam um banco separado (`DATABASE_URL_TESTE`), recriado a cada execução.

## Organização

| Pasta | Conteúdo |
|---|---|
| `db/migracoes` | Estrutura do banco e regras de integridade, em SQL |
| `src/servicos` | Regras de negócio, separadas das telas e cobertas por testes |
| `src/app` | Telas e ações |
| `src/componentes` | Componentes de interface |
| `scripts` | Migração e dados de exemplo |
| `tests` | Testes automatizados |

## Publicação

O sistema é publicado no Netlify (`netlify.toml`) com um banco PostgreSQL gerenciado.

1. **Estrutura do banco.** Aplique os arquivos de `db/migracoes`, em ordem, como administrador do banco.
2. **Papel do sistema.** Rode `db/producao/papel-do-sistema.sql`. Ele cria o papel `civiobra_app`, sem senha e sem poder de ignorar a proteção por órgão. Defina a senha com `alter role civiobra_app password '...'`.
3. **Variáveis no Netlify.**
   - `DATABASE_URL`: a conexão do papel `civiobra_app` (no pooler em modo transação, porta 6543, o usuário é `civiobra_app.<id do projeto>`).
   - `CODIGO_INSTALACAO`: um texto longo, pedido uma única vez na tela de primeiro acesso.
4. **Primeiro acesso.** Com o banco vazio, o site abre em `/primeiro-acesso`, onde se cadastra o órgão e o primeiro administrador. Depois disso a tela deixa de existir.

Em produção o sistema se recusa a funcionar se o papel do banco for administrativo (`superuser` ou `bypassrls`), porque isso desligaria o isolamento entre órgãos. A conexão com banco remoto é sempre cifrada e com o certificado conferido.

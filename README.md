# APROVA.AI — Plataforma inteligente de preparação para concursos

> "Você não precisa apenas saber se acertou. Precisa entender por que errou."

Protótipo funcional de uma plataforma de estudos para concursos públicos, construído a partir do
**Edital nº 1 do Concurso Público 1/2026 — CRA/RJ** (banca IADES) como fonte de verdade: cargos,
disciplinas, pesos e conteúdo programático vêm diretamente dos Anexos I, II, III e IV do edital.

## O diferencial: Professor de Erros

Ao errar uma questão, a plataforma não mostra apenas o gabarito. Ela explica o conceito, o
raciocínio, por que cada alternativa errada falha, a pegadinha da banca, a regra para memorizar e
oferece uma questão semelhante para testar se o aprendizado foi consolidado
(`ERRO → DIAGNÓSTICO → EXPLICAÇÃO → EXEMPLO → QUESTÃO SEMELHANTE → NOVA TENTATIVA`).

## Funcionalidades

- **Onboarding** guiado (concurso → cargo → data da prova → tempo disponível).
- **Dashboard** com métricas, gráficos de evolução, radar por disciplina e recomendação adaptativa.
- **Gerador de simulados**: completo, por disciplina/assunto, apenas erros, revisão inteligente,
  fáceis/difíceis, inéditas, estilo banca ou personalizado — com modo prova (cronômetro, navegação,
  marcação de questões) ou modo estudo (correção imediata).
- **Entenda seu erro**: explicação didática completa, classificação do motivo do erro e "explique de
  outra forma" (mais simples, analogia, passo a passo etc.).
- **Banco de erros** com filtros (hoje, semana, recorrentes, precisa revisar, já aprendi).
- **Revisão inteligente** e modos rápidos ("Eu tenho 15/30/60/90 minutos").
- **Domínio por assunto** (Crítico → Excelente) calculado a partir do histórico real de respostas.
- **Plano de estudos** gerado a partir de horas/dias disponíveis, priorizando pontos fracos.
- **Meu Professor**: chat de apoio baseado no histórico do usuário.
- **Perfil e gamificação** (XP, nível, sequência, conquistas) e tema claro/escuro.

## Stack

Vite + React + TypeScript, Tailwind CSS v4, Zustand (com persistência local), React Router e Recharts.

Todos os dados de desempenho são **mockados** (com um histórico de estudo simulado gerado no
onboarding) para demonstrar a experiência completa. A arquitetura (`src/lib/types.ts`,
`src/lib/store.ts`) já está desenhada para ser trocada por uma API/banco de dados real sem alterar as
telas.

## Rodando localmente

```bash
npm install
npm run dev
```

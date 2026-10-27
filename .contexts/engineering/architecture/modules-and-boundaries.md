---
title: Módulos e fronteiras
updated: 2026-10-10
source: PROJETO.md §14
---

# Módulos e fronteiras

## Estrutura de `src/`

```
src/app/              Next.js: (auth), (learning) com as cinco abas, read/[episodeId], api/
src/ui/               componentes React, icons.tsx, styles/ (tokens e classes do protótipo)
src/operations/       registro de operações (ADR 0023): borda comum à família e ao modo pessoal
src/web/              worker e cliente do modo pessoal no navegador (PGlite, operações)
src/modules/<m>/      domain/ · application/ (casos de uso e ports) · infrastructure/ · index.ts
src/infrastructure/   config/ database/ storage/ tmdb/ ai/ kokoro/ logger/ container.ts
src/shared/           app.ts (APP_NAME), errors, levels, clock, ids
src/seed/             seed de demonstração (idempotente)
src/worker/           processo separado que consome a job_queue (pnpm worker)
tests/                e2e (Playwright), bundle
fixtures/             SRT fictícios EN e PT
```

## Módulos

| Módulo            | Responsabilidade                                                              |
| ----------------- | ----------------------------------------------------------------------------- |
| `identity`        | Contas, senha, sessão, preferências                                           |
| `catalog`         | Obras, temporadas, episódios, `MetadataProvider`, sincronização com o TMDB    |
| `subtitles`       | Parser SRT, validação, hash, deduplicação, importação, falas                  |
| `alignment`       | Alinhamento entre duas legendas de idiomas diferentes por tempo (puro)        |
| `highlights`      | Marcações, agrupamento em expressões, contagem anônima, leitura do episódio   |
| `learning`        | Itens de aprendizado, explicações, `LlmProvider`, geração de cards            |
| `flashcards`      | Cards do usuário, agendamento de revisão, histórico                           |
| `ai-credentials`  | Chave Gemini por usuário: cifra, teste, máscara, remoção                      |
| `audio`           | `TtsProvider`, cache de áudio por hash                                        |
| `gamification`    | XP por eventos, missões, conquistas e perfil calculado das lições e revisões  |
| `settings`        | Configurações do servidor guardadas no banco, alteradas só pelo administrador |
| `recommendations` | Retrato do aluno, vetores das obras, ranqueamento e sugestões personalizadas  |
| `ai-usage`        | Medição de tokens e valor por chamada de IA, preços por modelo, limites       |
| `packages`        | Formato `.deixa.zip`: exportar e importar obras, legendas, cards e áudio      |
| `jobs`            | Fila `job_queue`: enfileirar, reivindicar com `SKIP LOCKED`, tentativas       |
| `scripts`         | Roteiro `.txt` conferido contra a legenda; falas completadas na leitura       |
| `conversations`   | Tutor: conversa, encerramento, revisão em job, cards escolhidos e termos      |
| `personal-series` | Série pessoal: temporada por nível, episódios por tema, trilha e lição        |

Os módulos `levels`, `spaced-repetition` e `conversations` do PROJETO.md nascem quando suas fases
chegarem; até lá, nível mora em `shared/levels` e o agendamento de revisão em `flashcards/domain`.

## Regras de dependência

- `domain` importa só `shared/` e outros arquivos do próprio `domain`.
- `application` importa `domain`, `shared` e ports; nunca `infrastructure`, Drizzle, `fetch` ou Next.
- `infrastructure` de um módulo implementa os ports do módulo.
- Um módulo só importa outro pelo `index.ts`.
- `src/infrastructure/container.ts` é o único lugar que monta casos de uso com implementações concretas.
- `src/app` importa o container e tipos públicos dos módulos; nunca adapters (`tmdb`, `kokoro`, `ai`,
  `database`) nem `modules/**/infrastructure`.
- `src/operations` não importa `next`, `next-intl/server`, `node:*` nem adapters; recebe tudo pelo
  `OperationContext`. Server action é invólucro de uma linha sobre `runOperation`.
- `src/ui` não importa `src/infrastructure/**` nem `modules/**/infrastructure/**`. Componente cliente chama
  server action.

O ESLint (`no-restricted-imports`) barra as duas últimas.

## Borda fina

Page, action e handler fazem quatro coisas: resolvem a sessão, validam a entrada com Zod, chamam o caso de uso
e traduzem o resultado. Regra de negócio fora disso é defeito.

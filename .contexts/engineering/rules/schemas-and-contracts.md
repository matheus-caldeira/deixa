---
title: Schemas e contratos
updated: 2026-10-10
source: PROJETO.md §4 (Validação: Zod)
---

# Schemas e contratos

## Regra

Zod em toda fronteira; tipo por `z.infer`.

## Fronteiras

| Fronteira              | Onde fica o schema                                   |
| ---------------------- | ---------------------------------------------------- |
| Variáveis de ambiente  | `src/infrastructure/config/env.ts`                   |
| Server action          | No próprio arquivo de actions                        |
| Resposta do TMDB       | `src/infrastructure/tmdb/schemas.ts`                 |
| Saída da LLM           | `modules/learning/application/ports` (contrato)      |
| Rascunho de cards      | `modules/learning/domain`                            |

## Erros

`AppError` com `code` estável (`SUBTITLE_INVALID`, `SUBTITLE_VERSION_CONFLICT`, `EPISODE_NOT_FOUND`,
`INVALID_CREDENTIALS`…). A borda converte em `{ ok: false, code, message }` com mensagem em português.

## Nunca na resposta

`password_hash`, `encrypted_api_key`, tokens, caminho absoluto de arquivo, id de outro usuário.

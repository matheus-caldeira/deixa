---
title: Vitest
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: vitest
version: "4.1"
docs: https://vitest.dev
---

# Vitest

## Papel

Testes unitários, de integração e de bundle.

## Configurações

| Arquivo                         | Inclui                         | Comando                 |
| ------------------------------- | ------------------------------ | ----------------------- |
| `vitest.config.mts`             | `src/**/*.unit.test.ts`        | `pnpm test`             |
| `vitest.integration.config.mts` | `src/**/*.integration.test.ts` | `pnpm test:integration` |
| `vitest.bundle.config.mts`      | `tests/bundle/*.test.ts`       | `pnpm test:bundle`      |

Todas com `fileParallelism: false` e um worker.

## Convenções

- Fakes em memória dos ports; `FixedClock`; ids sequenciais.
- `describe.skipIf(!process.env.TMDB_READ_ACCESS_TOKEN)` no teste do TMDB real.

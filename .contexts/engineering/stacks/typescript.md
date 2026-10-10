---
title: TypeScript
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: typescript
version: "5.9"
docs: https://www.typescriptlang.org/docs
---

# TypeScript

## Papel

Linguagem de todo o código, em modo estrito.

## Configuração

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `moduleResolution: bundler`, alias `@/*` → `src/*`.

## Convenções

- Uniões de literais para estados; sem `enum`.
- Tipos de fronteira por `z.infer`; tipos de linha por inferência do Drizzle, convertidos no repositório.
- Sem `any`, sem asserções duplas, sem diretivas de supressão.
- `pnpm typecheck` roda `next typegen` e `tsc --noEmit`.

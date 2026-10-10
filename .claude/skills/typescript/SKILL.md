---
name: typescript
description: "TypeScript estrito: strict, noUncheckedIndexedAccess, tipos derivados de Zod e Drizzle. Use ao tipar domínio, ports e contratos."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# TypeScript

Padrões do projeto:

- `strict`, `noUncheckedIndexedAccess` e `noImplicitOverride` ligados.
- Tipos de fronteira por `z.infer`; tipos de linha por `$inferSelect` do Drizzle, convertidos para tipos de domínio no repositório.
- Uniões de strings literais para estados (`EpisodeStatus`, `CefrLevel`); sem `enum`.
- Alias `@/*` aponta para `src/*`.
- `pnpm typecheck` = `next typegen && tsc --noEmit`.

Proibido:

- `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`.
- Tipo paralelo ao schema Zod para o mesmo dado.

Profundidade: @.contexts/engineering/stacks/typescript.md

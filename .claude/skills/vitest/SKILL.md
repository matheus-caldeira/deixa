---
name: vitest
description: "Vitest: unitários de domínio e casos de uso com fakes, integração separada, sem paralelismo. Use ao escrever ou rodar testes."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Vitest

Padrões do projeto:

- `pnpm test` roda `src/**/*.unit.test.ts`, sem banco nem rede.
- `pnpm test:integration` roda `*.integration.test.ts` (Postgres do compose e TMDB real, este pulado sem token).
- `pnpm test:bundle` roda depois do build e procura o token do TMDB em `.next/static`.
- `fileParallelism: false` e um worker.
- Fakes em memória dos ports em `modules/<m>/application/testing/` ou ao lado do teste.

Proibido:

- Teste unitário com banco, rede, Gemini, TMDB ou Kokoro reais.
- Jest: fora da stack.

Profundidade: @.contexts/engineering/stacks/vitest.md

---
title: "ADR 0012: Estratégia de testes"
updated: 2026-10-10
source: PROJETO.md §4 (Testes)
status: aceita
---

# ADR 0012: Estratégia de testes

## Contexto

O valor está em regras determinísticas (parser, alinhamento, agrupamento, agendamento) e em garantias de
isolamento e deduplicação.

## Decisão

- Unitários (Vitest) para domínio e casos de uso, com fakes em memória dos ports.
- Integração separada: repositórios no Postgres do compose e uma busca no TMDB real, pulada sem token.
- Teste de bundle depois do build: o token do TMDB não está em `.next/static`.
- Um fluxo Playwright com providers fake.
- Sem paralelismo, por memória.

## Consequências

- `pnpm test` roda sem Docker nem rede.
- Cada port tem duas implementações para manter.

## Alternativas descartadas

- Testcontainers: mais isolamento, mais peso; o compose já está de pé no desenvolvimento.
- Mutation testing: reavaliar quando o domínio crescer.

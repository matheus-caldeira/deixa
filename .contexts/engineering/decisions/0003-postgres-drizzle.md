---
title: "ADR 0003: PostgreSQL com Drizzle"
updated: 2026-10-10
source: PROJETO.md §4 e §8
status: aceita
---

# ADR 0003: PostgreSQL com Drizzle

## Contexto

Catálogo, falas, alinhamentos, cards e progresso são dados relacionais com consultas estruturadas.

## Decisão

PostgreSQL via `docker compose`, Drizzle ORM e migrações geradas pelo drizzle-kit. Unicidade e deduplicação
garantidas por constraints. Arquivos ficam no disco; o banco guarda caminho relativo e hash.

## Consequências

- SQL resolve tudo que o MVP precisa.
- Testes de integração usam o mesmo Postgres, em outro banco.

## Alternativas descartadas

- Embeddings, pgvector e RAG: fora do escopo.
- Prisma: fora da stack.
- SQLite: mais simples, mas o alvo de produção é Postgres.

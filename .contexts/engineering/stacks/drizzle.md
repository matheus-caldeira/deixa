---
title: Drizzle ORM
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: drizzle-orm
version: "0.45"
docs: https://orm.drizzle.team
---

# Drizzle ORM

## Papel

Acesso ao PostgreSQL e migrações.

## Como usamos

- Driver `postgres` (postgres.js).
- Schema em `src/infrastructure/database/schema/`; migrações em `src/infrastructure/database/migrations/`.
- `pnpm db:generate` gera; `pnpm db:migrate` aplica (cria o banco se faltar).
- Repositórios por módulo, devolvendo tipos de domínio.
- `jsonb` para estruturas pequenas (etapas do job, ids de falas PT do alinhamento, rascunho de cards, retrato de
  demonstração).
- Transação para importação e para salvar cards.

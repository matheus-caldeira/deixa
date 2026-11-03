---
title: PGlite
updated: 2026-10-27
source: .superpowers/planning/WEB-OFFLINE-PLAN.md (etapas 0 e 1)
package: "@electric-sql/pglite"
version: "0.5"
docs: https://pglite.dev/docs/
---

# PGlite

## Papel

PostgreSQL em WASM para o modo pessoal no navegador e para rodar a integração sem servidor de banco.

## Como usamos

- `openPgliteDatabase(dataDir?)` em `src/infrastructure/database/pglite-client.ts` devolve o mesmo
  `DatabaseHandle` do driver `postgres`; os repositórios não mudam.
- O tipo `Database` é `PgDatabase<PgQueryResultHKT, typeof schema>`, comum aos dois drivers. Código que lê o
  resultado de `db.execute` cru não é portável (o formato muda por driver): use o query builder.
- Migrações embutidas em `embedded-migrations.json`, geradas pelo `pnpm db:generate` (ou
  `tsx scripts/embed-migrations.ts`) e aplicadas por `applyMigrations`, que serve aos dois drivers e grava na
  mesma tabela `drizzle.__drizzle_migrations` do migrador do Drizzle. Um teste unitário falha se o JSON ficar
  para trás da pasta.
- `pnpm test:integration:pglite` roda a integração inteira num PGlite em memória (`TEST_DATABASE_DRIVER=pglite`).

## Memória

Abrir um PGlite em Node leva o processo de cerca de 140 MB para 1,2 GB de memória residente (medido em
27/10/2026, versão 0.5.12). Por isso o modo família continua no Postgres externo (ADR 0017) e o PGlite nunca
abre no processo do servidor.

## Navegador

- `src/web/runtime.worker.ts`: worker dedicado que abre o PGlite em `idb://deixa`, aplica as migrações e
  atende operações por mensagem (`src/web/protocol.ts`). `src/web/runtime-client.ts` é o lado da tela.
- Uma aba por vez: a trava `deixa-database` (Web Locks) decide quem abre o banco.
- Medido no Chrome em 27/10/2026: abrir em cerca de 190 ms, 62 MB de memória, 29 MB de espaço com o app em
  cache. Safari e iPhone em `.superpowers/planning/TESTES-MANUAIS.md`.

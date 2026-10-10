---
title: PostgreSQL
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: postgres
version: "17"
docs: https://www.postgresql.org/docs/17/
---

# PostgreSQL

## Papel

Banco único: catálogo, falas, alinhamentos, aprendizado e progresso.

## Como sobe

`docker compose up -d` (serviço `postgres`, imagem `postgres:17-alpine`, porta 1442 no host, volume nomeado).

## Bancos

| Banco        | Uso                  |
| ------------ | -------------------- |
| `deixa`      | Desenvolvimento      |
| `deixa_test` | Testes de integração |
| `deixa_e2e`  | Playwright           |

Os dois últimos são criados e migrados pelos scripts de teste.

## Fora do escopo

Embeddings, pgvector, RAG, Row Level Security (reavaliar na fase 06).

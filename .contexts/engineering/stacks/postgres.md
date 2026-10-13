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

- Desenvolvimento: `docker compose up -d` (serviço `postgres`, imagem `postgres:17-alpine`, porta 1442 no host,
  volume nomeado).
- Instalação local do app: Postgres embutido (ADR 0017), binários oficiais 17.6 baixados na primeira abertura
  para `<config>/postgres/binaries/`, dados em `<config>/postgres/data/`, processo filho em 127.0.0.1 numa porta
  livre entre 1443 e 1499. Código em `src/infrastructure/embedded-postgres/`.
- Banco remoto (nuvem ou rede da casa): o endereço informado no assistente.

## Bancos

| Banco        | Uso                  |
| ------------ | -------------------- |
| `deixa`      | Desenvolvimento      |
| `deixa_test` | Testes de integração |
| `deixa_e2e`  | Playwright           |

Os dois últimos são criados e migrados pelos scripts de teste.

## Fora do escopo

Embeddings, pgvector, RAG, Row Level Security (reavaliar na fase 06).

---
title: pnpm
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: pnpm
version: "12.10"
docs: https://pnpm.io
---

# pnpm

## Papel

Gerenciador de pacotes e executor de scripts.

## Scripts

| Script             | Faz                                                           |
| ------------------ | ------------------------------------------------------------- |
| `setup:env`        | Cria ou completa o `.env` sem imprimir valores                |
| `infra:up` / `down`| Sobe e derruba Postgres e Kokoro                              |
| `db:generate`      | Gera migração a partir do schema                              |
| `db:migrate`       | Aplica migrações                                              |
| `db:seed`          | Perfis, obras e episódios de demonstração (idempotente)       |
| `dev`              | Next em desenvolvimento, porta 1300                           |
| `build` / `start`  | Build e execução de produção                                  |
| `typecheck`, `lint`, `lint:comments`, `format` | Qualidade                         |
| `test`, `test:integration`, `test:bundle`, `test:e2e` | Testes                     |

## Regras

Sem instalação global. Dependência nova precisa de motivo.

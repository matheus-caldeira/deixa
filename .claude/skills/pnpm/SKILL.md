---
name: pnpm
description: "pnpm: scripts do projeto, instalação e allowBuilds. Use ao adicionar dependência ou script."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# pnpm

Padrões do projeto:

- Único gerenciador; versão fixada em `packageManager`.
- Scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `lint:comments`, `format`, `test`, `test:integration`, `test:bundle`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `infra:up`, `infra:down`, `setup:env`.
- Dependência nova só quando a plataforma não resolve; registrar o motivo no commit.

Proibido:

- `npm install` ou `yarn` no repositório.
- Instalação global ou de sistema sem confirmação do usuário.

Profundidade: @.contexts/engineering/stacks/pnpm.md

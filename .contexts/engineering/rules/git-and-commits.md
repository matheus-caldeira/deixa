---
title: Git e commits
updated: 2026-10-10
source: instruções do autor
---

# Git e commits

## Regra

Conventional Commits, um por tarefa do plano, identidade do `~/.gitconfig`, nada de push sem pedido.

## Formato

```
tipo(escopo): descrição em minúsculas, sem ponto final

Corpo opcional explicando o porquê.
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Escopos: módulos (`identity`, `catalog`, `subtitles`, `alignment`, `highlights`, `learning`, `flashcards`,
`gamification`, `ai-credentials`, `audio`, `music`) ou áreas (`ui`, `infra`, `shared`, `contexts`, `harness`, `docs`).

## Antes de cada commit

1. `pnpm typecheck && pnpm lint && pnpm test`.
2. `git status`: nenhum `.env*` além do `.env.example`; nada de `data/`.

## Nunca

- `git config user.*`.
- `.env`, `.env.tmdb` ou qualquer segredo no histórico.
- `--no-verify`, force push, reescrita de histórico compartilhado.

O hook `guard-conventional-commit` do Claude Code recusa mensagem fora do padrão; o `guard-secrets` recusa
escrita em `.env*` e conteúdo com formato de chave.

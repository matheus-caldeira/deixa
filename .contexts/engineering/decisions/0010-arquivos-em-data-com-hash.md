---
title: "ADR 0010: Arquivos em data/, caminho relativo e SHA-256"
updated: 2026-10-10
source: PROJETO.md §5
status: aceita
---

# ADR 0010: Arquivos em data/, caminho relativo e SHA-256

## Contexto

Legendas e áudios são arquivos; o banco não deve guardar binário grande nem caminho preso a uma máquina.

## Decisão

Port `FileStorage` com implementação local em `DATA_DIR` (padrão `data/`, fora do git). O banco guarda o caminho
relativo e o SHA-256. A estrutura segue o PROJETO.md: `catalog/series/{id}/seasons/{n}/episodes/{id}/…`,
`catalog/movies/{id}/…`, `audio/{voiceId}/{hash}.wav`, `temp/`.

## Consequências

- Deduplicação por hash antes de gravar.
- Trocar para storage de objetos é trocar o adapter.

## Alternativas descartadas

- `bytea` no Postgres: backups e consultas pesados.

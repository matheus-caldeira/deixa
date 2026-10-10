---
title: Zod
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: zod
version: "4.6"
docs: https://zod.dev
---

# Zod

## Papel

Validação em toda fronteira e fonte dos tipos.

## Como usamos

- `env.ts`: schema das variáveis, com string vazia tratada como ausente.
- Actions: `schema.safeParse(input)`; falha vira `{ ok: false }` com mensagem em português.
- TMDB: schemas tolerantes (campos opcionais e nulos) seguidos de mapeamento puro.
- LLM: schema estrito para a saída em lote, com limites de tamanho.

---
title: "ADR 0011: Código sem comentários"
updated: 2026-10-10
source: preferência do autor
status: aceita
---

# ADR 0011: Código sem comentários

## Contexto

Comentário envelhece e esconde nome ruim.

## Decisão

Nenhum comentário em código ou config. O porquê vai para ADR, documento de stack, `docs/DECISIONS.md` ou corpo
do commit. `pnpm lint:comments` verifica.

## Consequências

- Nomes mais longos e mais funções pequenas.
- Sem diretivas em comentário (`eslint-disable`, `@ts-ignore`): corrige-se a causa.

## Alternativas descartadas

- Permitir só JSDoc: vira exceção que cresce.

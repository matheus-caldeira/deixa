---
title: "ADR 0005: Catálogo compartilhado, aprendizado individual"
updated: 2026-10-10
source: PROJETO.md §1, §7 e §8
status: aceita
---

# ADR 0005: Catálogo compartilhado, aprendizado individual

## Contexto

Um episódio importado deve servir a todos; marcações, cards, revisões e progresso são de cada pessoa.

## Decisão

Duas famílias de tabelas. As individuais são sempre acessadas com o `userId` da sessão, filtrado no repositório.
`learning_items` tem `visibility` (`global` ou `private`) e `owner_user_id`. `highlight_stats` guarda só
contagem. Filme usa a temporada 0 com um único episódio, para que todo o fluxo de legenda trate uma coisa só.

## Consequências

- Reprocessar um episódio não toca dado individual.
- Todo repositório individual tem teste de isolamento.

## Alternativas descartadas

- Row Level Security no banco: proteção forte, mas exige papéis e contexto de sessão por transação; reavaliar
  antes de abrir para terceiros (fase 06).
- Legenda ligada direto à obra para filmes: dois caminhos de código para o mesmo fluxo.

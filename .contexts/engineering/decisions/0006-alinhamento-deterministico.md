---
title: "ADR 0006: Alinhamento EN ↔ PT determinístico"
updated: 2026-10-10
source: PROJETO.md §6
status: aceita
---

# ADR 0006: Alinhamento EN ↔ PT determinístico

## Contexto

Com a legenda PT enviada junto, a tradução de cada fala já existe. Falta ligar os blocos das duas legendas, que
raramente têm a mesma quantidade nem os mesmos tempos.

## Decisão

Alinhar por sobreposição de tempo, em função pura: estimar o deslocamento fixo pela mediana das diferenças de
início, somar a sobreposição de cada fala EN com as falas PT e aceitar a partir de 0,6. Tratar 1:1, 1:N e N:1.
Sem par, `UNALIGNED`. Nenhuma LLM.

## Consequências

- Barato, reprodutível e testável com casos fixos.
- Legendas com tempos muito diferentes (cortes distintos) alinham mal; a taxa aparece no processamento e a
  tradução dessas falas cai para a IA, com etiqueta.

## Alternativas descartadas

- Alinhar por similaridade de texto com LLM ou embeddings: custo e variação sem necessidade.

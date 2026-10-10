---
title: "ADR 0002: Módulos verticais e fronteiras"
updated: 2026-10-10
source: PROJETO.md §14
status: aceita
---

# ADR 0002: Módulos verticais e fronteiras

## Contexto

Sem fronteiras, regra de negócio vaza para componentes e para handlers, e trocar um serviço externo vira
reescrita.

## Decisão

`src/modules/<módulo>/{domain,application,infrastructure}` com `index.ts` como única porta. Casos de uso
dependem de ports. Adapters de serviços externos ficam em `src/infrastructure/`. O container
(`src/infrastructure/container.ts`) é o único ponto de montagem. Componentes React não importam repositório,
cliente Gemini, TMDB nem Kokoro; o ESLint barra.

## Consequências

- Cada serviço externo tem um fake, e tudo roda sem credencial.
- Mais arquivos por funcionalidade.

## Alternativas descartadas

- Organização por tipo técnico (`services/`, `repositories/`): espalha o domínio.
- dependency-cruiser: adiado; `no-restricted-imports` cobre as duas fronteiras que mais importam agora.

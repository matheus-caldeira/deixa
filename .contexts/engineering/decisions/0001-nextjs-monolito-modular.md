---
title: "ADR 0001: Next.js único, monólito modular"
updated: 2026-10-10
source: PROJETO.md §4
status: aceita
---

# ADR 0001: Next.js único, monólito modular

## Contexto

O produto começa para uso em casa, com custo operacional baixo. Precisa de interface web responsiva, API e
processamento de legendas.

## Decisão

Uma aplicação Next.js (App Router) em TypeScript serve interface e API. A separação é por camadas (domínio,
aplicação, infraestrutura) dentro de módulos verticais. O processamento pesado sai para um worker Node.js na
mesma base de código quando houver LLM e áudio em lote (fase 03).

## Consequências

- Um deploy, um banco, um repositório.
- Regras de negócio testáveis sem framework.
- Enquanto não há worker, a importação roda dentro da requisição; isso é aceitável porque parser e alinhamento
  levam milissegundos.

## Alternativas descartadas

- Front e back separados desde o início: custo sem benefício nesta fase.
- Microsserviços: prematuro.

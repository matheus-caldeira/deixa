---
title: "ADR 0008: LlmProvider e chave Gemini por usuário"
updated: 2026-10-10
source: PROJETO.md §7 e §10
status: aceita
---

# ADR 0008: LlmProvider e chave Gemini por usuário

## Contexto

Cards personalizados usam a chave do Google AI de quem estuda. O app precisa funcionar sem chave, e os testes
não podem chamar LLM.

## Decisão

Port `LlmProvider` com `GeminiLlmProvider` (HTTP direto, resposta em JSON validada por Zod) e `FakeLlmProvider`
determinístico. A chave fica cifrada com AES-256-GCM; a mestra em `AI_CREDENTIALS_MASTER_KEY`. O cliente só vê a
versão mascarada. A geração de cards faz uma chamada em lote.

## Consequências

- Sem chave, tudo funciona com explicações simuladas, identificadas como tal.
- Mastra entra na fase 03 chamando os mesmos casos de uso; o port não muda.

## Alternativas descartadas

- Chave única do administrador para tudo: custo concentrado e sem isolamento.
- SDK do provedor nos módulos: acopla o domínio.

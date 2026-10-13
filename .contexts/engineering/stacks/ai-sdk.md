---
title: AI SDK
updated: 2026-10-13
source: docs/WEB-OFFLINE-PLAN.md §4 e ADR 0014
package: ai
version: "7.0"
docs: https://ai-sdk.dev/docs
---

# AI SDK

## Papel

Camada única de chamada a modelos de linguagem e de embeddings, atrás dos ports de IA do projeto. Permite
trocar de provedor (Google, OpenAI, Anthropic, OpenRouter, Ollama, servidor compatível com OpenAI) sem mudar
casos de uso nem prompts.

## Como usamos

- Tudo em `src/infrastructure/ai/`. Nenhum outro lugar importa `ai` nem `@ai-sdk/*`.
- `models.ts`: `languageModel(access, modelId)` e `embeddingModel(access, modelId)` montam o modelo a partir
  de `AiAccess` (`provider` e `apiKey`). Hoje só o Google está ligado; cada provedor novo entra aqui, com o
  pacote `@ai-sdk/<provedor>` correspondente.
- `generate-json.ts`: `generateText` com `Output.json()`, `instructions` como system prompt, `maxRetries: 0`
  e `timeout`. Mantém a lista de modelos de reserva por provedor e traduz os erros do SDK para `AppError`:
  `APICallError` 400/401/403 vira `AI_KEY_REJECTED`; 404, 429, 500, 503 e falha de rede passam ao modelo
  seguinte; `NoObjectGeneratedError` e `JSONParseError` viram `LLM_INVALID_OUTPUT`.
- Um adapter por port: `AiLlmProvider`, `AiTutorProvider` (áudio como `FilePart`), `AiLessonPlanner`,
  `AiSuggestionWriter` e `AiEmbeddingProvider` (`embedMany` com `providerOptions.google` para 256 dimensões).
- A saída continua `unknown` e passa pelo schema Zod do caso de uso, como antes.
- Teste de chave do Google: listagem de modelos por HTTP, sem gastar tokens (`test-api-key.ts`).

## Testes

`MockLanguageModelV4` e `MockEmbeddingModelV4` de `ai/test` fazem o papel do provedor; nenhum teste chama
provedor real. O `generateJson` aceita uma fábrica de modelos justamente para isso.

## Fora do SDK

Streaming, tools e agentes não são usados: todas as chamadas pedem uma resposta JSON inteira.

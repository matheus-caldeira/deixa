---
title: AI SDK
updated: 2026-10-13
source: .superpowers/planning/WEB-OFFLINE-PLAN.md §4 e ADR 0014
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
  de `AiAccess` (`provider`, `apiKey`, `baseUrl`). Provedores: Google (`@ai-sdk/google`), OpenAI
  (`@ai-sdk/openai`), Anthropic (`@ai-sdk/anthropic`, sem embeddings) e, pelo `@ai-sdk/openai-compatible`,
  OpenRouter, Ollama (endereço do usuário mais `/v1`) e qualquer servidor compatível com OpenAI.
- O provedor e o modelo vêm da escolha da conta (`user_ai_models`) ou do padrão do servidor
  (`aiGeneration`, `aiEmbedding` em `app_settings`); a chave vem da conta ou da global. Para Ollama e
  servidor compatível o segredo guardado é o endereço (e a chave, se houver), em JSON cifrado, validado por
  `canonicalServiceUrl`; o administrador pode desligar endereços próprios (`aiCustomEndpointsAllowed`).
- `generate-json.ts`: `generateText` com `Output.json()`, `instructions` como system prompt, `maxRetries: 0`
  e `timeout`. Mantém a lista de modelos de reserva por provedor e traduz os erros do SDK para `AppError`:
  `APICallError` 400/401/403 vira `AI_KEY_REJECTED`; 404, 429, 500, 503 e falha de rede passam ao modelo
  seguinte; `NoObjectGeneratedError` e `JSONParseError` viram `LLM_INVALID_OUTPUT`.
- Um adapter por port: `AiLlmProvider`, `AiTutorProvider` (áudio como `FilePart` em bytes), `AiLessonPlanner`,
  `AiSuggestionWriter` e `AiEmbeddingProvider` (`embedMany`; 256 dimensões no Google e na OpenAI, a largura do
  modelo nos demais; a chave em `work_embeddings` é `provedor/modelo`, e `document_hash` marca o texto
  vetorizado: texto novo, vetor novo).
- A saída continua `unknown` e passa pelo schema Zod do caso de uso, como antes.
- Teste de chave por provedor: listagem de modelos por HTTP, sem gastar tokens (`test-api-key.ts`).

## Testes

`MockLanguageModelV4` e `MockEmbeddingModelV4` de `ai/test` fazem o papel do provedor; nenhum teste chama
provedor real. O `generateJson` aceita uma fábrica de modelos justamente para isso.

## Fora do SDK

Streaming, tools e agentes não são usados: todas as chamadas pedem uma resposta JSON inteira.

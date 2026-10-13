---
title: "ADR 0014: Chamadas de IA pelo AI SDK"
updated: 2026-10-13
source: docs/WEB-OFFLINE-PLAN.md §4
status: aceita
---

# ADR 0014: Chamadas de IA pelo AI SDK

## Contexto

Os adapters de IA chamavam a API REST do Gemini por `fetch`, com o formato de pedido e de resposta do Google
embutido em cada um. O produto vai aceitar vários provedores (Google, OpenAI, Anthropic, OpenRouter, Ollama e
servidores compatíveis com OpenAI), medir tokens por chamada e, na versão pessoal, chamar o provedor direto do
navegador.

## Decisão

Toda chamada a modelo de linguagem ou de embeddings passa pelo AI SDK (`ai` e um pacote `@ai-sdk/*` por
provedor), dentro de `src/infrastructure/ai/`. Os ports (`LlmProvider`, `TutorProvider`, `LessonPlanner`,
`SuggestionWriter`, `EmbeddingProvider`) e os prompts não mudam; a saída continua validada por Zod no caso de
uso. O Mastra, previsto no `PROJETO.md`, não entra: é framework de servidor e os casos de uso já orquestram.

## Consequências

- Um adapter por port serve a todos os provedores; o provedor é um dado de `AiAccess`.
- O SDK devolve tokens de entrada e saída em toda chamada, base da medição de custo.
- Roda em Node e no navegador, o que a versão pessoal exige.
- Dependência nova de terceiros no caminho da IA; a versão fica fixada e as mudanças de maior versão são
  revisadas antes de atualizar.

## Alternativas descartadas

- Manter `fetch` por provedor: cada provedor duplicaria o tratamento de pedido, resposta, erro e tokens.
- Adapter único no formato da OpenAI com URL configurável: cobre vários provedores, mas a saída estruturada e
  o áudio do tutor variam entre eles.
- Mastra: não roda no navegador e esconderia a orquestração que já vive nos casos de uso.

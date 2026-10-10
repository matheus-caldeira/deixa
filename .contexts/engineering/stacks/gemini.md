---
title: Google Gemini
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: (API HTTP)
version: "v1beta"
docs: https://ai.google.dev/gemini-api/docs
---

# Google Gemini

## Papel

LLM das atividades personalizadas, com a chave de cada usuário.

## Como usamos

- `GeminiLlmProvider` em `src/infrastructure/google-ai/`, por `fetch` em
  `generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, com a chave no header
  `x-goog-api-key`.
- Modelo em `GEMINI_MODEL` (padrão `gemini-2.5-flash`).
- `responseMimeType: "application/json"`; a resposta passa pelo schema Zod do port.
- Teste de chave: listar modelos com a chave informada.

## Usos nas fases 01 e 02

| Uso                                 | Chamadas                |
| ----------------------------------- | ----------------------- |
| Explicar termos marcados            | 1 por geração de cards  |
| Traduzir fala sem par na legenda PT | 1 por pedido, com cache |

## Reserva

`FakeLlmProvider`: glossário fixo do diálogo fictício e respostas previsíveis para o resto.

## Fase 03

Mastra orquestra os workflows chamando os casos de uso; o port continua o mesmo.

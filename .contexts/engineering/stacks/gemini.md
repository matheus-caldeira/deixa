---
title: Google Gemini
updated: 2026-10-13
source: PROJETO.md §4 (Tecnologias)
package: (API HTTP)
version: "v1beta"
docs: https://ai.google.dev/gemini-api/docs
---

# Google Gemini

## Papel

LLM das atividades personalizadas, com a chave de cada usuário.

## Como usamos

- Pelo AI SDK, com o pacote `@ai-sdk/google` (ver @.contexts/engineering/stacks/ai-sdk.md); nenhum `fetch`
  direto à API do Google fora do teste de chave.
- Modelo em `GEMINI_MODEL` (padrão `gemini-2.5-flash`), com `gemini-flash-latest` e `gemini-2.5-flash-lite`
  como reserva quando o pedido falha por cota ou indisponibilidade.
- Saída pedida em JSON; a resposta passa pelo schema Zod do port.
- Embeddings com `gemini-embedding-001` em 256 dimensões.
- Teste de chave: listar modelos com a chave informada.

## Usos nas fases 01 e 02

| Uso                                 | Chamadas                |
| ----------------------------------- | ----------------------- |
| Explicar termos marcados            | 1 por geração de cards  |
| Traduzir fala sem par na legenda PT | 1 por pedido, com cache |

## Reserva

`FakeLlmProvider`: glossário fixo do diálogo fictício e respostas previsíveis para o resto.

## Outros provedores

O Google é o primeiro provedor ligado ao AI SDK; os demais entram pelo mesmo caminho (ADR 0014).

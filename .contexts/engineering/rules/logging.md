---
title: Logs
updated: 2026-10-10
source: PROJETO.md §10 (Segurança obrigatória)
---

# Logs

## Regra

Um logger, mensagens curtas, nenhum dado sensível.

## Como aplicar

- `logger.info("metadata.provider", { provider: "tmdb" })`: evento + objeto pequeno.
- Lista de campos que nunca entram: senha, hash de senha, cookie, token de sessão, token e chave do TMDB, chave
  Gemini, header `Authorization`, texto integral de legenda, prompt e resposta da LLM.
- O logger remove chaves com esses nomes em qualquer profundidade antes de escrever.
- Erro de serviço externo: nome do serviço, status, tentativa.

## Inicialização

`src/instrumentation.ts` registra uma vez: provider de metadados (`tmdb` ou `fake`) e de TTS (`kokoro` ou
`silent`), pelo nome.

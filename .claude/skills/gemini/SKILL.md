---
name: gemini
description: "Google Gemini atrás do LlmProvider: chave por usuário, saída estruturada validada por Zod, provider fake sem chave. Use ao mexer em src/infrastructure/google-ai, ai-credentials ou na geração de cards."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Gemini

Padrões do projeto:

- Port `LlmProvider` em `modules/learning`; implementações `GeminiLlmProvider` e `FakeLlmProvider`.
- A chave é do usuário: cifrada com AES-256-GCM em `user_ai_credentials`, decifrada só no servidor, na hora da chamada.
- Sem chave configurada, o `FakeLlmProvider` determinístico responde.
- Geração de cards: uma chamada em lote, resposta em JSON, validada por Zod.
- A legenda PT entra no prompt só como contexto; a tradução da fala alinhada não é pedida à LLM.
- Mastra entra na fase 03, chamando os mesmos casos de uso.

Proibido:

- Importar cliente Gemini fora de `src/infrastructure/google-ai/`.
- Devolver a chave ao navegador; logar a chave ou o prompt.
- Chamar Gemini real em teste.

Profundidade: @.contexts/engineering/stacks/gemini.md

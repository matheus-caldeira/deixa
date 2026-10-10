---
name: zod
description: "Zod 4: schemas nas fronteiras (env, actions, TMDB, LLM), z.infer como fonte de tipos. Use ao validar entrada, saída de serviço externo ou variável de ambiente."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Zod

Padrões do projeto:

- Variáveis de ambiente validadas em `src/infrastructure/config/env.ts`; string vazia conta como ausente.
- Resposta do TMDB e saída da LLM passam por `safeParse` antes de virar dado do domínio.
- Entrada de server action validada na borda; o caso de uso recebe dado já tipado.
- `z.infer` gera o tipo; mensagens de erro em português na borda.

Proibido:

- `parse` sem tratamento em dado externo dentro de caso de uso (use `safeParse` e `AppError`).
- Schema que aceite `userId` do cliente.

Profundidade: @.contexts/engineering/stacks/zod.md

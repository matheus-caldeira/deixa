---
name: next
description: "Next.js App Router: pages que buscam dados, server actions e route handlers finos, params assíncrono, next/font, next/image. Use ao criar rotas, pages, layouts, actions ou handlers em src/app/."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Next.js

Padrões do projeto:

- Pages (`src/app/**/page.tsx`) são server components: resolvem a sessão, chamam casos de uso pelo container e entregam props.
- Server actions em `src/app/**/actions.ts`: leem a sessão, validam com Zod, chamam o caso de uso, devolvem dado serializável.
- Route handlers só para binário ou streaming (áudio em `/api/audio/**`); `params` é uma Promise e recebe `await`.
- Fontes Bricolage Grotesque, Figtree e JetBrains Mono via `next/font/google`, expostas como variáveis CSS no `<html>`.
- Pôsteres do TMDB com `next/image`; host liberado em `images.remotePatterns`.
- Variáveis de ambiente pelo carregamento padrão do Next, validadas em `src/infrastructure/config/env.ts`.
- `src/instrumentation.ts` loga os providers ativos na inicialização.

Proibido:

- Lógica de negócio, SQL, `fetch` do TMDB ou chamada a LLM em `page.tsx`, action ou `route.ts`.
- `userId` vindo do corpo, de query string ou da LLM.
- Variável `NEXT_PUBLIC_` com segredo.
- Fontes por `<link>` externo; segundo servidor HTTP (Express, Hono): fora da stack.

Profundidade: @.contexts/engineering/stacks/next.md

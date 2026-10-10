---
title: Next.js
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: next
version: "16.4"
docs: https://nextjs.org/docs
---

# Next.js

## Papel

Interface, server actions e route handlers em uma aplicação só (App Router).

## Como usamos

- Grupos de rota: `(auth)` para entrar e criar conta; `(learning)` para as cinco abas, com topo e barra inferior
  no layout; `read/[episodeId]` em tela cheia.
- Pages são server components e dinâmicas (dependem do cookie de sessão).
- `params` e `searchParams` são Promises.
- Server actions para mutações e para buscas disparadas pelo cliente (TMDB, geração de cards).
- Route handler só para áudio (`/api/audio/cue/[cueId]`, `/api/audio/item/[itemId]`).
- `src/proxy.ts` redireciona para `/login` quando não há cookie de sessão; a validação real é do `requireUser`.
- `src/instrumentation.ts` loga os providers ativos.
- `next/font/google` para as três fontes; `next/image` para pôsteres, com `image.tmdb.org` em `remotePatterns`.
- Uploads por `FormData` em server action; `serverActions.bodySizeLimit` cobre dois SRT de 5 MB.

## Ambiente

O Next carrega o `.env`. Nenhum segredo com `NEXT_PUBLIC_`. A validação com Zod é preguiçosa (`getEnv()`), para
o build não exigir banco.

## Cuidados

Esta versão tem mudanças em relação a versões anteriores. Antes de usar uma API pouco familiar, ler o guia em
`node_modules/next/dist/docs/`.

---
title: Metadados externos (TMDB)
updated: 2026-10-10
source: PROJETO.md §5
---

# Metadados externos (TMDB)

## Regra

TMDB só no servidor, pelo `MetadataProvider`. Token fora do bundle, de respostas e de logs.

## Por quê

A credencial é do administrador. Vazada no cliente, qualquer pessoa a usa.

## Como aplicar

- Variáveis `TMDB_READ_ACCESS_TOKEN` e `TMDB_API_KEY`, sem `NEXT_PUBLIC_`, lidas só em `env.ts`.
- `src/infrastructure/tmdb/` é o único lugar com a URL da API e os headers.
- Erros do adapter carregam status e endpoint, nunca a URL com `api_key`.
- 401 com token → tenta a chave v3; 429 e 5xx → até duas novas tentativas com espera curta.
- Resposta mapeada por função pura (`mapTmdb…`) para os tipos do catálogo.
- `metadata_synced_at` controla a validade de 7 dias; "Atualizar dados" força.
- Pôster: guardar só `poster_path`; a URL é montada na interface com o host liberado em `next.config`.

## Atribuição

Na folha de perfil, seção "Sobre": o nome TMDB e o aviso "This product uses the TMDB API but is not endorsed or
certified by TMDB."

## Testes

- Unitário do mapeamento com respostas de exemplo (título vazio em pt-BR, sem pôster, série e filme).
- Integração com o TMDB real, pulada sem token.
- Bundle: valor do token ausente de `.next/static`.

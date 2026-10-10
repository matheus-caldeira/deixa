---
title: "ADR 0007: TMDB atrás do MetadataProvider"
updated: 2026-10-10
source: PROJETO.md §5
status: aceita
---

# ADR 0007: TMDB atrás do MetadataProvider

## Contexto

A obra precisa ser identificada (títulos, sinopse, pôster, temporadas, episódios). O TMDB exige credencial e
atribuição.

## Decisão

Port `MetadataProvider` com `TmdbMetadataProvider` (token v4 no header, chave v3 como alternativa, timeout,
retry curto, 401 e 429 tratados, `pt-BR` com nova busca em `en-US`) e `FakeMetadataProvider` (obras fixas).
Chamadas só no servidor. O que veio do TMDB fica no banco; nova chamada só a pedido ou depois de 7 dias.
Cadastro manual continua possível. Um teste procura o token em `.next/static` depois do build.

## Consequências

- O app funciona sem credencial, com o fake.
- O catálogo não depende do TMDB para ser lido.

## Alternativas descartadas

- Chamar o TMDB do navegador: exporia a credencial.
- Não guardar os metadados: latência e dependência a cada leitura.

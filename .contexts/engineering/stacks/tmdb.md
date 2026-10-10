---
title: TMDB
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: (API HTTP)
version: "3"
docs: https://developer.themoviedb.org/docs
---

# TMDB

## Papel

Identificar obras: títulos, sinopses, pôsteres, temporadas, episódios e ids externos. Não fornece legendas.

## Endpoints

| Uso                          | Endpoint                 |
| ---------------------------- | ------------------------ |
| Busca de obras               | `GET /3/search/multi`    |
| Série com temporadas         | `GET /3/tv/{id}`         |
| Episódios de uma temporada   | `GET /3/tv/{id}/season/{n}` |
| Filme                        | `GET /3/movie/{id}`      |

Base: `https://api.themoviedb.org`. Imagens: `https://image.tmdb.org/t/p/w342{poster_path}`.

## Autenticação

`Authorization: Bearer <TMDB_READ_ACCESS_TOKEN>` (v4). Com 401, nova tentativa com `api_key=<TMDB_API_KEY>` (v3).

## Idioma

`language=pt-BR`. Título ou sinopse vazios → mesma chamada em `en-US`, preenchendo só o que faltou. O título
original é sempre guardado.

## Robustez

Timeout de 8 s; 429 e 5xx com até duas novas tentativas (respeitando `Retry-After`, limitado a 2 s); 401 e 404
viram erros de domínio distintos.

## Cache

O banco é o cache: `metadata_synced_at` na obra e `episodes_synced_at` na temporada. Validade de 7 dias, ou
atualização a pedido.

## Atribuição

"This product uses the TMDB API but is not endorsed or certified by TMDB."

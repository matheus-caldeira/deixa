---
name: tmdb
description: "API do TMDB: busca de obras, temporadas, episódios e filmes pelo MetadataProvider, só no servidor. Use ao mexer em src/infrastructure/tmdb ou no cadastro de obras."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# TMDB

Padrões do projeto:

- Port `MetadataProvider` em `modules/catalog`; implementações `TmdbMetadataProvider` e `FakeMetadataProvider`.
- Endpoints: `search/multi`, `tv/{id}`, `tv/{id}/season/{n}`, `movie/{id}`.
- `Authorization: Bearer <TMDB_READ_ACCESS_TOKEN>`; `TMDB_API_KEY` (v3) só como alternativa em caso de 401.
- `language=pt-BR`, com nova busca em `en-US` quando título ou sinopse vierem vazios.
- Timeout de 8 s, até 2 novas tentativas em 429 e 5xx, respeitando `Retry-After`.
- Resposta validada por Zod e mapeada para o domínio em função pura testada.
- Pôster: `https://image.tmdb.org/t/p/w342{poster_path}`.

Proibido:

- Chamar o TMDB do navegador ou de componente React.
- Logar URL com `api_key` ou o header de autorização.
- Usar o TMDB para obter legendas.

Profundidade: @.contexts/engineering/stacks/tmdb.md

# Metadados externos (TMDB)

O TMDB identifica a obra; não fornece legendas. As chamadas acontecem só no servidor, pelo port `MetadataProvider`. O token nunca chega ao bundle, a respostas nem a logs.

Checklist:

- [ ] Nenhuma variável do TMDB com prefixo `NEXT_PUBLIC_`; leitura só em `src/infrastructure/config/env.ts`.
- [ ] Token v4 no header `Authorization: Bearer`; chave v3 só como alternativa quando o token falha.
- [ ] `language=pt-BR` com nova busca em `en-US` quando título ou sinopse vierem vazios; guardar o título original.
- [ ] O que veio do TMDB fica no banco (`metadata_provider`, `external_id`, títulos, sinopse, `poster_path`, temporadas, episódios); nova chamada só a pedido ou depois de 7 dias.
- [ ] Timeout, retry curto e tratamento de 401 e 429 no adapter.
- [ ] Sem credenciais, vale o `FakeMetadataProvider`; o provider ativo é logado na inicialização, sem valores.
- [ ] Pôster por `https://image.tmdb.org/t/p/w342{poster_path}`; sem pôster, o pôster tipográfico.
- [ ] Atribuição ao TMDB visível na interface.
- [ ] `pnpm test:bundle` garante que o token não está em `.next/static`.

Profundidade: @.contexts/engineering/rules/external-metadata.md

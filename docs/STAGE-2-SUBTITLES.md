# Etapa 2: legendas a partir do OpenSubtitles

Branch `feat/opensubtitles`. Pedido original na seção 16 do [PROJETO.md](../PROJETO.md).

## O que faz

Na folha "Adicionar ao catálogo", depois de escolher a obra e o episódio, o passo padrão passou a ser
**Buscar legendas**. O envio manual de `.srt` continua disponível no link "Enviar arquivos .srt manualmente".

1. O usuário toca em **Buscar legendas**. Só a busca é feita; nada é baixado.
2. A tela mostra a sugestão em inglês e em português, com release, downloads, quem enviou e os avisos
   "Com descrição de sons" e "Tradução automática". "Ver outras opções" lista as alternativas de cada idioma.
3. A linha de cota mostra os downloads restantes do dia e o horário de renovação.
4. O download só acontece quando o usuário toca em **Baixar e processar · N downloads**.
5. Os arquivos baixados entram no mesmo pipeline do upload manual: validação, SHA-256, duplicidade,
   leitura do SRT, alinhamento EN ↔ PT e publicação.
6. A tela de leitura mostra a origem: `Legenda EN: OpenSubtitles · release · autor`.

Nada é importado sozinho. Não existe importação de temporada inteira nem tarefa em segundo plano que
chame o OpenSubtitles.

## Regras de escolha

`src/modules/subtitle-sources/domain/ranking.ts`:

- par EN e PT do mesmo release primeiro (nome normalizado; só vale se o nome tiver marca de release,
  como `S01E03`, `720p` ou `HDTV`);
- sem descrição de sons antes das que têm;
- FPS mais comum entre os resultados;
- mais downloads; em empate, melhor avaliação;
- tradução automática só aparece quando é a única opção do idioma.

## Cota e limites

| Limite                      | Onde                                       | Valor                               |
| --------------------------- | ------------------------------------------ | ----------------------------------- |
| Cota da conta no fornecedor | resposta do `POST /download` (`remaining`) | 100 por dia com a chave atual       |
| Teto por usuário do app     | `SUBTITLE_DOWNLOADS_PER_USER_PER_DAY`      | padrão 10 em 24 horas               |
| Cache da busca              | tabela `subtitle_search_cache`             | 24 horas por episódio               |
| "Buscar de novo"            | `REFRESH_INTERVAL_MINUTES`                 | ignora pedidos em menos de 10 min   |
| Arquivo baixado             | adapter e caso de uso                      | até 5 MB, só de `*.opensubtitles.*` |

A cota do fornecedor fica na tabela `external_api_quota` e é atualizada a cada download. Quando a cota
conhecida não cobre a escolha, o app recusa antes de gastar download. O mesmo arquivo nunca é baixado
duas vezes: se o episódio já tem aquele `file_id`, os bytes vêm do disco.

## Como funciona por dentro

- `src/modules/subtitle-sources`: ranqueamento, `searchSubtitles` e `importFromSource`, com os ports
  `SubtitleSourceProvider` e `SourceRepository`.
- `src/infrastructure/opensubtitles`: adapter da API REST (`/subtitles`, `/download`, `/login`),
  com timeout, até duas novas tentativas em 429 e 5xx, e validação da resposta com Zod.
- `subtitle_files` ganhou `source`, `external_file_id`, `release_name`, `source_author`,
  `hearing_impaired` e `fps` (migração `0010`).
- Sem `OPENSUBTITLES_API_KEY`, o container usa `FakeSubtitleSourceProvider`, que devolve as legendas
  fictícias de `fixtures/`. O log de inicialização mostra `subtitles: "opensubtitles"` ou `"fake"`.

## Credenciais

`OPENSUBTITLES_API_KEY` fica só no `.env`. `OPENSUBTITLES_USERNAME` e `OPENSUBTITLES_PASSWORD` são
opcionais: com os dois, o adapter faz login e manda o token no download. As três são lidas só no
servidor, não aparecem em log e o `pnpm test:bundle` confere que não vão para `.next/static`.

## Testes

| Tipo       | Arquivo                                                                   | Cobre                                                                  |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unitário   | `src/modules/subtitle-sources/application/sources.unit.test.ts`           | ranking, par EN/PT, cache, reuso por `file_id`, cota, teto por usuário |
| Unitário   | `src/infrastructure/opensubtitles/opensubtitles-provider.unit.test.ts`    | mapeamento, parâmetros, retry, 401, 406, login, link fora do domínio   |
| Integração | `src/infrastructure/opensubtitles/opensubtitles-real.integration.test.ts` | busca real, sem download; pulado sem chave                             |
| E2E        | `tests/e2e/subtitle-source.spec.ts`                                       | buscar → confirmar → processar → ler EN + PT, com provider falso       |

## Validação real (2026-10-11)

- Busca real: funcionou só com a chave de API.
- Download real: funcionou sem login. Um episódio importado pelo app (Breaking Bad T1 E03, inglês e
  português): 472 e 473 falas, 471 pares alinhados (100%).
- Downloads gastos: 2. Cota depois: 98 de 100.

## Divergências em relação ao pedido

- O arquivo de credenciais tinha só a chave de API. Login virou opcional, e o download funcionou sem ele.
- A cota lida na API foi de 100 por dia, não 10; o app mostra o número que a API devolve.
- A API não tem endpoint de cota sem login (`/infos/user` devolve 401). Antes do primeiro download do
  dia, a tela diz que o número será informado no primeiro download.
- A busca não é disparada ao abrir a folha: exige o toque em "Buscar legendas".

## Antes de abrir para outros usuários

- Ler os termos da API: uso de uma chave única de servidor por vários usuários, redistribuição das
  legendas no catálogo compartilhado e exigência de atribuição.
- A cota é da conta do servidor e é dividida entre todos; o teto por usuário só evita que uma conta
  gaste tudo. Avaliar login por usuário ou plano pago.
- As legendas baixadas ficam em `data/` (fora do git) e continuam sendo conteúdo de terceiros.

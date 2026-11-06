---
title: "ADR 0024: Música com letra sincronizada e playlist como obra"
updated: 2026-11-06
source: .superpowers/planning/MUSIC-PLAN.md
status: aceita
---

# ADR 0024: Música com letra sincronizada e playlist como obra

## Contexto

A pessoa quer estudar inglês pelas músicas que ouve: toca o clipe do YouTube e a letra rola embaixo, com a linha
atual destacada. Leitura, marcação, cards, trilha e pacote já funcionam sobre episódios com falas
(`subtitle_cues`); um caminho paralelo duplicaria tudo isso.

## Decisão

- **Playlist é uma obra** (`media_items.type = 'music'`, `metadata_provider = 'manual'`,
  `external_id = 'playlist:<uuid>'`, `created_by` = a conta) com a temporada 1 "Músicas". Cada música é um
  episódio e uma linha em `song_tracks` (catálogo, sem dado individual). Só quem criou a playlist, ou o
  administrador, adiciona, remove ou ajusta músicas. Toda conta ganha "Minhas músicas" na primeira visita.
- **Letra vem do LRCLIB** (`lrclib.net/api`, sem chave) atrás do port `LyricsProvider`, com
  `LrclibLyricsProvider` e `FakeLyricsProvider` (letras fictícias; `LYRICS_PROVIDER=lrclib|fake`). A letra em LRC
  vira SRT e entra pelo `importEpisodeSubtitles`, então hash, deduplicação e alinhamento são os de sempre. A pessoa
  também pode colar a letra (LRC) e a tradução.
- **Tradução por IA, linha a linha**, em uma única chamada em lote (`LlmProvider.translateLines`) dentro de um job
  (`music_translate`); cada tradução herda o tempo da linha original e vira o idioma base do episódio. O episódio
  fica `READY` com a letra antes da tradução chegar. Etiqueta de origem: IA ou manual.
- **Tempo do clipe é do domínio** (`modules/music/domain/timeline.ts`): `lead_in_ms` (atraso inicial) e `pauses`
  (`atMs` no tempo da letra, `durationMs`) convertem tempo da letra em tempo do vídeo e o inverso. O polling do
  player roda só no cliente.
- Letras de obras reais não entram no repositório: só os ids dos clipes de demonstração; a letra é buscada na hora
  e gravada no banco e em `data/`.
- O pacote `.deixa.zip` leva `song_tracks` junto da obra `music`; pacotes antigos seguem válidos.

## Consequências

- A área Músicas reaproveita leitura, marcação e cards sem código novo de estudo.
- Obras `music` ficam fora do Explorar (que só lista séries e filmes).
- Licença comercial de letras fica pendente antes de abrir o catálogo a terceiros.

## Alternativas descartadas

- Musixmatch oficial (plano pago), Genius (sem tempos), NetEase e Megalobiz (não oficiais).
- Tradução sincronizada pronta: não existe de forma confiável.
- Tabela de playlists própria: duplicaria obra, temporada e episódio.

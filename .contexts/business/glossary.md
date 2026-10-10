---
title: Glossário
updated: 2026-10-10
source: PROJETO.md §1 a §13
---

# Glossário

Vocabulário único. Na interface, o termo em português; no código, o identificador em inglês.

| Termo (interface)    | Código                      | Significado                                                          |
| -------------------- | --------------------------- | -------------------------------------------------------------------- |
| Obra                 | `media_item`                | Série ou filme do catálogo                                           |
| Temporada            | `season`                    | Agrupamento de episódios; filme usa a temporada 0                    |
| Episódio             | `episode`                   | Unidade de estudo; o filme é um único episódio ("Filme completo")    |
| Catálogo             | `catalog`                   | Conjunto compartilhado de obras, episódios e legendas                |
| Legenda              | `subtitle_file`             | Arquivo `.srt` de um episódio em um idioma                           |
| Fala                 | `subtitle_cue` (`cue`)      | Um bloco da legenda, com início, fim e texto                         |
| Timecode             | `start_ms`, `end_ms`        | Tempo da fala no episódio                                            |
| Alinhamento          | `cue_alignment`             | Ligação entre uma fala EN e as falas PT que se sobrepõem no tempo    |
| Taxa de alinhamento  | `alignment_rate`            | Percentual de falas EN com par em PT                                 |
| Cena                 | `scene`                     | Trecho contínuo de falas, separado do seguinte por um silêncio longo |
| Leitura              | `read`                      | Tela "Ler episódio e marcar", com a legenda completa                 |
| Modo de exibição     | `display_mode`              | EN + PT, PT ao tocar ou Só inglês                                    |
| Marcação             | `user_highlight`            | Palavra, expressão ou fala que o usuário marcou                      |
| Expressão            | `phrase`                    | Palavras vizinhas marcadas na mesma fala                             |
| Mapa de dificuldade  | `highlight_stats`           | Contagem anônima de marcações por trecho                             |
| Card                 | `user_card`                 | Cartão de revisão de um usuário                                      |
| Item de aprendizado  | `learning_item`             | Termo ou frase com explicação, compartilhável entre usuários         |
| Alcance              | `share_scope`, `visibility` | "Só para mim" (`private`) ou "Para o catálogo" (`catalog`/`global`)  |
| Origem da tradução   | `translation_source`        | Etiqueta **PT** (legenda) ou **IA** (LLM)                            |
| Revisão              | `review`                    | Sessão de cartões vencidos, com nota De novo, Difícil, Bom ou Fácil  |
| Nível                | `level`                     | Nível do QECR: A1, A2, B1, B2, C1, C2                                |
| Faixa de nível       | `level_min`, `level_max`    | Níveis para os quais a obra é adequada                               |
| Adequação            | `fit`                       | "No seu nível", "Desafiador" ou "Tranquilo"                          |
| Trilha               | `trail`                     | Sequência de cenas do episódio a estudar                             |
| Sequência (foguinho) | `streak`                    | Dias seguidos com a meta cumprida                                    |
| Meta do dia          | `daily_goal`                | XP a atingir no dia: Leve 50, Regular 100, Firme 150, Intenso 250    |
| Chave de IA          | `user_ai_credential`        | Chave do Google AI (Gemini) do próprio usuário                       |
| Tutor                | `tutor`                     | Conversa com IA por cenário                                          |
| Estado do episódio   | `episode.status`            | `NONE`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED`, `NEEDS_REVIEW`  |

## Termos a evitar

- "Deck", "baralho": use **cards** e **revisão**.
- "Highlight" na interface: use **marcação**.

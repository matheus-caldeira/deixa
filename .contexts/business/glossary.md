---
title: Glossário
updated: 2026-10-10
source: PROJETO.md §1 a §13
---

# Glossário

Vocabulário único. Na interface, o termo em português (referência em `locales/pt-BR.json`, traduzido em
`locales/en.json`); no código, o identificador em inglês.

| Termo (interface)    | Código                      | Significado                                                                           |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Obra                 | `media_item`                | Série ou filme do catálogo                                                            |
| Temporada            | `season`                    | Agrupamento de episódios; filme usa a temporada 0                                     |
| Episódio             | `episode`                   | Unidade de estudo; o filme é um único episódio ("Filme completo")                     |
| Catálogo             | `catalog`                   | Conjunto compartilhado de obras, episódios e legendas                                 |
| Legenda              | `subtitle_file`             | Arquivo `.srt` de um episódio em um idioma                                            |
| Fala                 | `subtitle_cue` (`cue`)      | Um bloco da legenda, com início, fim e texto                                          |
| Timecode             | `start_ms`, `end_ms`        | Tempo da fala no episódio                                                             |
| Alinhamento          | `cue_alignment`             | Ligação entre uma fala de uma legenda e as falas de outro idioma no tempo             |
| Taxa de alinhamento  | `alignment_rate`            | Percentual de falas EN com par em PT                                                  |
| Cena                 | `scene`                     | Trecho contínuo de falas, separado do seguinte por um silêncio longo                  |
| Leitura              | `read`                      | Tela "Ler episódio e marcar", com a legenda completa                                  |
| Modo de exibição     | `display_mode`              | Os dois idiomas, tradução ao tocar ou só o idioma de estudo                           |
| Marcação             | `user_highlight`            | Palavra, expressão ou fala que o usuário marcou                                       |
| Expressão            | `phrase`                    | Palavras vizinhas marcadas na mesma fala                                              |
| Mapa de dificuldade  | `highlight_stats`           | Contagem anônima de marcações por trecho                                              |
| Card                 | `user_card`                 | Cartão de revisão de um usuário                                                       |
| Item de aprendizado  | `learning_item`             | Termo ou frase com explicação, compartilhável entre usuários                          |
| Alcance              | `share_scope`, `visibility` | "Só para mim" (`private`) ou "Para o catálogo" (`catalog`/`global`)                   |
| Origem da tradução   | `translation_source`        | Etiqueta **PT** (legenda) ou **IA** (LLM)                                             |
| Revisão              | `review`                    | Sessão de cartões vencidos, com nota De novo, Difícil, Bom ou Fácil                   |
| Nível                | `level`                     | Nível do QECR: A1, A2, B1, B2, C1, C2                                                 |
| Faixa de nível       | `level_min`, `level_max`    | Níveis para os quais a obra é adequada                                                |
| Adequação            | `fit`                       | "No seu nível", "Desafiador" ou "Tranquilo"                                           |
| Trilha               | `trail`                     | Sequência de cenas do episódio a estudar                                              |
| Trilha da obra       | `work_trail`                | Todas as trilhas de uma obra numa tela, uma seção por episódio e seletor de temporada |
| Sequência (foguinho) | `streak`                    | Dias seguidos com a meta cumprida                                                     |
| Meta do dia          | `daily_goal`                | XP a atingir no dia: Leve 50, Regular 100, Firme 150, Intenso 250                     |
| Chave de IA          | `user_ai_credential`        | Chave (ou endereço) de um provedor de IA do próprio usuário                           |
| Provedor de IA       | `ai_service`                | Google, OpenAI, Anthropic, OpenRouter, Ollama ou compatível com OpenAI                |
| Modelo em uso        | `user_ai_models`            | Provedor e modelo escolhidos pela conta para gerar texto e embeddings                 |
| Tutor                | `tutor`                     | Conversa com IA por cenário                                                           |
| Conversa encerrada   | `closed_at`                 | Conversa que não recebe mais mensagens; fica para ler, ouvir e revisar                |
| Revisão da conversa  | `review_status`             | Análise da conversa em segundo plano, com dificuldades e cards propostos              |
| Série pessoal        | `personal_series`           | Série de estudo de cada conta, feita dos cards das conversas, fora do catálogo        |
| Temporada pessoal    | `personal_seasons`          | Temporada da série pessoal; cada uma é um nível do QECR                               |
| Episódio pessoal     | `personal_episodes`         | Episódio da série pessoal, por tema ("Verbos I"), com trilha própria                  |
| Sugestão             | `user_recommendation`       | Obra indicada ao usuário pelo gosto e pelo nível, com o motivo                        |
| Retrato do aluno     | `learner_assessment`        | Resumo do estudo recente que orienta o desafio das sugestões                          |
| Pacote               | `package` (`.deixa.zip`)    | Arquivo com obras, legendas, cards e áudio para importar em outra instalação          |
| Roteiro              | `episode_script`            | Transcrição `.txt` conferida contra a legenda; completa falas cortadas                |
| Job                  | `job_queue`                 | Trabalho em segundo plano (trilha, cards, sugestões, áudio do episódio)               |
| Idioma base          | `native_language`           | Idioma em que a pessoa lê as traduções e explicações                                  |
| Idioma de estudo     | `target_language`           | Idioma que a pessoa está aprendendo: inglês, português, espanhol ou francês           |
| Par de idiomas       | `user_language_pairs`       | Idioma de estudo + idioma base de uma conta, com o nível; um par ativo                |
| Estado do episódio   | `episode.status`            | `NONE`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED`, `NEEDS_REVIEW`                   |

## Termos a evitar

- "Deck", "baralho": use **cards** e **revisão**.
- "Highlight" na interface: use **marcação**.

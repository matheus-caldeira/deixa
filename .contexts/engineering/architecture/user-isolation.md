---
title: Isolamento entre usuários
updated: 2026-10-10
source: PROJETO.md §1 (regra central), §7 e §8
---

# Isolamento entre usuários

**O catálogo é compartilhado. O aprendizado é individual.**

## Duas famílias de tabelas

| Compartilhadas (catálogo)                                                                  | Individuais (por usuário)                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `media_items`, `seasons`, `episodes`, `subtitle_files`, `subtitle_cues`, `cue_alignments`  | `sessions`, `user_preferences`, `user_ai_credentials`, `progress_snapshots`                      |
| `cue_translations`, `audio_assets`, `processing_jobs`                                      | `user_highlights`, `highlight_card_batches`, `user_cards`, `review_logs`                         |
| `learning_items` com `visibility = global`, `highlight_stats` (só contagem)                | `episode_progress`, `xp_events`, `learning_items` com `visibility = private` (pelo dono)         |

## De onde vem o usuário

Do cookie de sessão, resolvido no servidor (`requireUser`). Nenhuma entrada de action ou handler tem `userId`.
O caso de uso recebe o `userId` como dado e o repositório filtra por ele em toda consulta individual.

## Itens de aprendizado

- `global`: visível como sugestão para quem estudar o episódio; `owner_user_id` nulo.
- `private`: `owner_user_id` preenchido; só o dono lê e reutiliza.
- Ao gerar cards, o reuso considera itens globais do episódio e os privados do próprio usuário. Um item privado
  de outra pessoa nunca é reutilizado, ainda que o termo seja idêntico.
- "Para o catálogo" promove o item privado do próprio usuário a global.

## Marcações e contagem anônima

- `user_highlights` é sempre individual.
- Ao salvar cards com alcance "Para o catálogo", as marcações daquela geração entram em `highlight_stats`, que
  guarda só `(episode_id, cue_id, start_token, end_token, user_count)`.
- A interface mostra "marcada por N alunos" a partir do mínimo configurado (`MIN_HIGHLIGHT_COUNT_TO_SHOW`).

## Reprocessamento

Marcações referenciam a fala EN e a posição das palavras. Reimportar um episódio com o mesmo arquivo não cria
falas novas, logo nada do usuário se perde. Trocar a versão da legenda é decisão explícita e ainda não é
suportada: o envio de um arquivo diferente para um episódio já pronto é recusado.

## Recursos alheios

Pedido por recurso individual de outro usuário responde como inexistente.

## Testes obrigatórios

- Dois usuários marcam o mesmo episódio: cada um vê só as suas marcações.
- Card privado de um não aparece na revisão nem nas sugestões do outro.
- Item privado de um não é reutilizado na geração do outro.
- A chave de IA de um não é usada nem exibida para o outro.

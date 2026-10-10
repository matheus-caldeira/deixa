---
title: Idempotência
updated: 2026-10-10
source: PROJETO.md §5 e §9 (Idempotência e falhas)
---

# Idempotência

## Regra

Repetir uma operação não duplica efeito. A garantia está em hash + constraint.

## Onde

| Operação                    | Chave                                                          | Efeito da repetição                    |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| Importar legenda            | `(episode_id, language, processing_version, sha256)`           | Reutiliza; informa duplicidade         |
| Cadastrar obra do TMDB      | `(metadata_provider, external_id)`                             | Atualiza a existente                   |
| Temporada, episódio         | `(media_item_id, season_number)`, `(season_id, episode_number)`| Atualiza                               |
| Gerar áudio                 | `(text_hash, voice_id)`                                        | Serve do cache                         |
| Salvar card                 | `(user_id, learning_item_id)`                                  | Mantém o existente                     |
| Item de marcação            | episódio + fala + tokens + visibilidade/dono                   | Reutiliza                              |
| Sincronizar marcações       | `(user_id, cue_id, start_token, end_token, kind)`              | Diferença: insere novas, remove ausentes |
| Seed                        | e-mail, ids externos                                           | Não duplica                            |

## Como aplicar

- `INSERT … ON CONFLICT`, nunca `SELECT` seguido de `INSERT` fora de transação.
- Importação inteira em uma transação; arquivo gravado antes, com escrita atômica.
- Hash calculado sobre os bytes do arquivo enviado.

## Testes

Reenviar o mesmo SRT: uma legenda, as mesmas falas, resultado `DUPLICATE`. Gerar cards duas vezes: os mesmos
cards. Pedir o mesmo áudio duas vezes: uma geração.

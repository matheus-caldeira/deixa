# Isolamento entre usuários

O catálogo é compartilhado; o aprendizado é individual. O `userId` vem só da sessão, nunca do corpo, da query string ou da LLM. Toda leitura ou escrita em tabela individual filtra por esse `userId` dentro do repositório.

Checklist:

- [ ] Tabelas individuais (`user_preferences`, `user_ai_credentials`, `user_highlights`, `highlight_card_batches`, `user_cards`, `review_logs`, `episode_progress`, `xp_events`, `sessions`, `user_recommendations`, `recommendation_feedback`, `recommendation_runs`, `ai_usage_events`, `ai_usage_limits`, `user_ai_models`, `user_language_pairs`) só são acessadas com `userId` da sessão.
- [ ] Nenhum schema de entrada aceita `userId` do cliente.
- [ ] `learning_items` com `visibility = private` só é lido, reutilizado ou promovido pelo `owner_user_id`.
- [ ] `highlight_stats` guarda só contagem; nunca id de usuário. Só aparece a partir do mínimo de marcações.
- [ ] Reprocessar ou reimportar um episódio não apaga progresso, marcações nem cards de ninguém.
- [ ] Recurso de outro usuário responde como inexistente (404), sem revelar que existe.
- [ ] Mudança em repositório individual vem com teste de isolamento (dois usuários, um não enxerga o outro).

Profundidade: @.contexts/engineering/rules/user-isolation.md

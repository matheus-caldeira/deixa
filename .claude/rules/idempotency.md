# Idempotência

Repetir uma importação, um processamento ou um pedido de áudio não duplica legenda, fala, card nem arquivo. A garantia mora em hashes e constraints, não em `SELECT` seguido de `INSERT`.

Checklist:

- [ ] Legenda deduplicada por SHA-256: mesmo arquivo no mesmo episódio e idioma reutiliza o existente e não reprocessa.
- [ ] `UNIQUE (episode_id, language, processing_version, sha256)` em `subtitle_files`.
- [ ] Áudio deduplicado por hash de texto normalizado + voz + idioma + versão do modelo; arquivo existente é servido do cache.
- [ ] `user_cards` único por usuário e item; gerar cards duas vezes não duplica.
- [ ] `learning_items` de marcação reutilizado quando o termo já existe no episódio (global, ou privado do próprio usuário).
- [ ] Obra única por `(metadata_provider, external_id)`; temporada por número; episódio por número.
- [ ] Upserts com `ON CONFLICT`; etapas do processamento podem rodar de novo.
- [ ] Teste obrigatório: reenviar o mesmo SRT não cria segunda legenda nem segundas falas.

Profundidade: @.contexts/engineering/rules/idempotency.md

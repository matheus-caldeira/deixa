---
name: postgres
description: "PostgreSQL via docker compose: banco de dev, banco de teste, constraints de unicidade. Use ao mexer no compose, em índices ou em constraints."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# PostgreSQL

Padrões do projeto:

- Sobe por `docker compose up -d` (serviço `postgres`, porta 1442 no host).
- Banco `deixa` para dev; `deixa_test` para integração e `deixa_e2e` para o Playwright, criados pelos scripts.
- Unicidade no banco: e-mail, `(metadata_provider, external_id)`, `(episode_id, language, processing_version, sha256)`, `(user_id, learning_item_id)`, `(text_hash, voice_id)`.
- Ids `uuid`; datas `timestamptz`.

Proibido:

- Embeddings, pgvector e RAG: fora do escopo do MVP.
- Guardar arquivo no banco.

Profundidade: @.contexts/engineering/stacks/postgres.md

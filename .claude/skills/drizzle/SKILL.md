---
name: drizzle
description: "Drizzle ORM e drizzle-kit: schema, repositórios por módulo, upserts com onConflict, migrações. Use ao criar tabelas, queries ou migrações."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Drizzle ORM

Padrões do projeto:

- Schema em `src/infrastructure/database/schema/`, um arquivo por área (identity, catalog, learning).
- Repositórios em `modules/<m>/infrastructure/`, implementando o port do módulo e devolvendo tipos de domínio.
- Repositório individual sempre recebe `userId` e filtra por ele.
- Upsert com `onConflictDoNothing`/`onConflictDoUpdate`; operação composta em `db.transaction`.
- Migrações geradas por `pnpm db:generate` e aplicadas por `pnpm db:migrate`; integração usa as migrações reais.
- Caminhos de arquivo relativos a `DATA_DIR`; hashes em `text` hexadecimal.

Proibido:

- Drizzle fora de `infrastructure/`.
- Binário de legenda ou áudio em coluna.
- Editar à mão migração já aplicada.
- Prisma e outros ORMs: fora da stack.

Profundidade: @.contexts/engineering/stacks/drizzle.md

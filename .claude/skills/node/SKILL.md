---
name: node
description: "Node.js 24: crypto nativo (scrypt, AES-256-GCM, SHA-256), fs para data/, fetch nativo. Use ao escrever infraestrutura ou scripts."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Node.js

Padrões do projeto:

- Node 24 (`.nvmrc`).
- `node:crypto` para senha (`scrypt`), cifra da chave de IA (AES-256-GCM) e hashes (SHA-256).
- `node:fs/promises` para o storage local em `DATA_DIR`; escrita atômica (arquivo temporário + `rename`).
- `fetch` nativo com `AbortSignal.timeout` para TMDB, Gemini e Kokoro.
- Scripts de apoio em `scripts/*.mjs` ou em TypeScript com `tsx`.

Proibido:

- Biblioteca de HTTP ou de cripto quando o nativo resolve.
- Caminho absoluto gravado no banco.

Profundidade: @.contexts/engineering/stacks/node.md

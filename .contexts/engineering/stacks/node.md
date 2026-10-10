---
title: Node.js
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: node
version: "24"
docs: https://nodejs.org/docs/latest-v24.x/api/
---

# Node.js

## Papel

Runtime do Next, dos scripts e do futuro worker.

## APIs nativas usadas

| Necessidade              | API                                                  |
| ------------------------ | ---------------------------------------------------- |
| Hash de senha            | `crypto.scrypt`, `timingSafeEqual`                   |
| Cifra da chave de IA     | `crypto.createCipheriv("aes-256-gcm")`               |
| Hash de arquivo e áudio  | `crypto.createHash("sha256")`                        |
| Token de sessão          | `crypto.randomBytes(32)`                             |
| Arquivos                 | `fs/promises` (`mkdir`, `writeFile`, `rename`)       |
| HTTP                     | `fetch` com `AbortSignal.timeout`                    |
| Decodificação de legenda | `TextDecoder` (`utf-8` fatal, depois `windows-1252`) |

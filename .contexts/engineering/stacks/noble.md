---
title: noble (hashes e ciphers)
updated: 2026-10-27
source: .superpowers/planning/WEB-OFFLINE-PLAN.md (bibliotecas novas previstas)
package: "@noble/hashes, @noble/ciphers"
version: "2.4"
docs: https://github.com/paulmillr/noble-hashes
---

# noble

## Papel

Cripto em JavaScript puro, igual no Node e no navegador: SHA-256 síncrono, scrypt, AES-256-GCM e bytes aleatórios.

## Como usamos

- `src/shared/hash.ts` (`sha256Hex`, síncrono, usado no domínio) e `src/shared/base64.ts`.
- `portablePasswords` e `portableSessionTokens` (identity), `PortableGcmCipher` (chave de IA) e
  `PortablePersonalCipher` (pacote pessoal) produzem o mesmo formato das versões de Node; testes unitários
  conferem que um lado abre o que o outro gravou.
- O servidor continua com `node:crypto` para senha e cifras (mais rápido); o navegador usa as versões portáveis
  pela `browserPlatform`.

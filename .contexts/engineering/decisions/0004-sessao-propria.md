---
title: "ADR 0004: Autenticação por sessão própria"
updated: 2026-10-10
source: PROJETO.md §8 (users.password_hash) e §15 (fase 01)
status: aceita
---

# ADR 0004: Autenticação por sessão própria

## Contexto

O modelo de dados já prevê `users` com `password_hash`. A fase 01 pede autenticação e cadastro, sem login social.

## Decisão

Senha com `scrypt` (sal por usuário) do `node:crypto`. Sessão por token aleatório de 32 bytes, guardado como
SHA-256 em `sessions`, entregue em cookie `HttpOnly`, `SameSite=Lax`, com validade de 30 dias. `requireUser`
resolve o usuário no servidor em toda page, action e handler.

## Consequências

- Nenhuma dependência nova.
- Recuperação de senha, verificação de e-mail e limite de tentativas ficam para a fase de publicação (06).

## Alternativas descartadas

- Biblioteca de autenticação completa: mais peso do que a fase pede.
- JWT sem estado: revogação mais difícil, sem ganho aqui.

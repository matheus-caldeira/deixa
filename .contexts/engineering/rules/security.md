---
title: Segurança
updated: 2026-11-03
source: PROJETO.md §10 e §15 (critérios de aceite)
---

# Segurança

## Camadas

1. **Sessão**: cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção; token aleatório, hash no banco.
2. **Autorização**: tudo que é individual filtra pelo usuário da sessão.
3. **Entrada**: Zod; upload com extensão, tamanho e decodificação conferidos.
4. **Segredos**: ambiente validado; TMDB só no servidor; chave Gemini cifrada.
5. **Saída**: mensagens sem stack; nada sensível em resposta ou log.

## Senha

`scrypt` com sal de 16 bytes, comparação em tempo constante. Mínimo de 8 caracteres no cadastro.

## Contas e administrador

- A primeira conta vira administrador. Na família ela só é criada de pedido do próprio computador
  (`x-forwarded-for` com um único salto de loopback e `host` `localhost`, `127.x` ou `[::1]`), pelo port
  `RequestOrigin`; no modo pessoal o cadastro segue aberto. Os dois cabeçalhos podem ser forjados por quem está na
  rede: crie a primeira conta antes de expor a instalação.
- Só o administrador lista, cria, promove, redefine a senha e remove contas (`accounts.*`); o alvo é `accountId`,
  nunca `userId`. Ninguém remove a própria conta e o último administrador não perde o papel nem é removido
  (transação com trava).
- Redefinir a senha encerra todas as sessões da conta. Remover a conta apaga em cascata todas as tabelas
  individuais, os jobs e `data/packages/<userId>/`; o catálogo fica, com a autoria nula.

## Upload

- `.srt`, até 5 MB por arquivo.
- UTF-8 (com ou sem BOM); se inválido, tenta Windows-1252.
- Nome do arquivo do cliente serve só para exibição; o caminho no disco vem dos ids.

## Áudio

Endpoint por id de fala ou de item. Limite de gerações simultâneas por usuário.

## Pendências para a fase 06

Limite de tentativas de login, recuperação de senha, cabeçalhos de segurança, revisão de direitos do catálogo,
avaliação de Row Level Security.

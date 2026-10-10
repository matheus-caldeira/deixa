---
title: Isolamento entre usuários
updated: 2026-10-10
source: PROJETO.md §1, §7, §8
---

# Isolamento entre usuários

## Regra

O `userId` vem da sessão. Toda leitura e escrita em tabela individual filtra por ele no repositório.

## Por quê

É o critério de aceite mais importante do MVP: dados de um usuário nunca aparecem na conta de outro. Um filtro
esquecido vaza marcações, cards ou a chave de IA.

## Como aplicar

- `requireUser()` na borda devolve `{ id, name, level, … }`. A action passa `user.id` ao caso de uso.
- Assinatura de repositório individual começa por `userId`: `listDueCards(userId, now)`,
  `replaceHighlights(userId, episodeId, …)`.
- Consulta por id de recurso individual sempre leva `AND user_id = $userId`.
- Reuso de `learning_items`: `visibility = 'global' OR owner_user_id = $userId`.
- `highlight_stats` não tem coluna de usuário.

## Exemplo

```ts
const card = await cards.findById(userId, cardId);
if (!card) throw new AppError("CARD_NOT_FOUND");
```

O card de outra pessoa cai no mesmo `CARD_NOT_FOUND`.

## Testes

Para cada repositório individual: dois usuários, mesmas operações, um não vê o resultado do outro. Para a
geração de cards: item privado de A não é reutilizado por B.

Arquitetura: @.contexts/engineering/architecture/user-isolation.md

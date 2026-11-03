---
title: "ADR 0023: Registro de operações (borda única)"
updated: 2026-10-27
source: .superpowers/planning/WEB-OFFLINE-PLAN.md (etapa 6) e tarefa 138
status: aceita
---

# ADR 0023: Registro de operações (borda única)

## Contexto

O modo pessoal roda o app inteiro no navegador, sem servidor. As server actions do Next só existem no servidor e
misturavam a regra da borda (validar, chamar o caso de uso, agendar job) com detalhes do Next (`revalidatePath`,
`redirect`, cookies, `getTranslations`, `node:fs`). Reescrever cada action para o navegador duplicaria a borda.

## Decisão

- **Operação.** `src/operations/<área>.ts` define cada operação com nome (`"review.gradeCard"`), schema Zod da
  entrada, `refresh` (se a tela recarrega dados depois) e `run(contexto, entrada)`. Entrada fora do schema vira
  `INVALID_INPUT` antes de qualquer caso de uso.
- **Contexto.** `OperationContext` traz o usuário da sessão, o container, `schedule` (job da fila),
  `refreshSettings`, `readSample` e `translator`. Cada alvo monta o seu: a família em `src/app/operations.ts`, o
  navegador no worker do modo pessoal.
- **Registro.** `src/operations/registry.ts` junta os grupos; um teste garante que nenhum nome se repete.
- **Família.** As server actions viram invólucros de uma linha (`runOperation(nome, entrada)`), que resolve a
  sessão, executa, revalida e traduz o erro. O que é só do Next fica no invólucro: `redirect` depois de abrir a
  conversa, o cookie de idioma, a conversão de `FormData` em `{ filename, bytes }`.
- **Fronteira.** `src/operations` não importa `next`, `next-intl/server`, `node:*` nem adapters (ESLint).
- Ficam fora do registro, por serem só da família: cadastro e entrada (cookie de sessão), troca de idioma por
  cookie e a configuração do banco.

## Consequências

- O modo família continua renderizando no servidor; as pages seguem chamando o container.
- O modo pessoal chama as mesmas operações pelo worker, com o mesmo `userId` vindo da sessão local.
- Mudar a regra de uma action é mudar a operação; o invólucro não tem lógica.

## Alternativas descartadas

- Telas só cliente nos dois modos, com um handler HTTP único: tira a renderização no servidor da família sem
  ganho para o modo pessoal.
- Duplicar as actions para o navegador.

---
title: next-intl
updated: 2026-10-15
source: ADR 0018
package: next-intl
version: "4.14"
docs: https://next-intl.dev/docs
---

# next-intl

## Papel

Entregar os textos de `locales/<idioma>.json` aos componentes de servidor e de cliente, com plural, datas e
números no idioma da conta.

## Como usamos

- Sem rotas por idioma. `src/i18n/request.ts` resolve o idioma por pedido: cookie `deixa_locale`, depois
  `Accept-Language`, depois `pt-BR`. `src/i18n/messages.ts` carrega o JSON do idioma.
- `next.config.ts` passa pelo `createNextIntlPlugin("./src/i18n/request.ts")`; o `RootLayout` envolve a
  árvore com `NextIntlClientProvider` e põe o idioma no `<html lang>`.
- Componente cliente: `useTranslations("tela")`, `useFormatter()`, `useLocale()`. Page, action e rota:
  `getTranslations("tela")`; fora de um pedido com cookie (rota do desktop), `getTranslations({ locale })`.
- Chaves em camelCase agrupadas por tela; parâmetros entre chaves (`{count}`), plural em ICU
  (`{count, plural, one {# card} other {# cards}}`), trechos em negrito com `t.rich("chave", { b })`.
- Apóstrofo em inglês é o tipográfico (`’`), porque o ASCII é caractere de escape no ICU.
- `t.has("chave")` antes de traduzir um código que pode não ter texto; o padrão é `errors.generic`.
- Idiomas, nomes em inglês para os prompts e `matchLocale` ficam em `src/shared/locales.ts`.

## Testes

`src/i18n/messages.unit.test.ts` compara todos os JSON com o `pt-BR`: mesma lista de chaves, mesmos
parâmetros, nenhuma mensagem vazia. O e2e `tests/e2e/language.spec.ts` troca o idioma no perfil e volta.

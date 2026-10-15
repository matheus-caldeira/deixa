---
title: "ADR 0018: Interface em N idiomas"
updated: 2026-10-15
source: conversa de 14/10/2026 e docs/LANGUAGES-DRAFT.md
status: aceita
---

# ADR 0018: Interface em N idiomas

## Contexto

Todo texto da interface estava fixo em português nos componentes, nas pages, nas actions e dentro dos módulos
(mensagens de `AppError`, rótulos de domínio, passos do processamento, títulos de notificação gravados no
banco). Para oferecer a interface em inglês e, depois, em outros idiomas sem reescrever telas, o texto precisa
sair do código e o que é gravado no banco precisa deixar de ser frase pronta.

## Decisão

- `locales/<idioma>.json`, um arquivo por idioma, chaves agrupadas por tela (`home.*`, `read.*`,
  `settings.*`, `errors.*`). Idiomas de interface: `pt-BR` (referência) e `en`. Um idioma novo é um JSON
  novo; o teste `src/i18n/messages.unit.test.ts` falha se faltar chave ou parâmetro em qualquer idioma.
- `next-intl` sem rotas por idioma: o idioma vem do cookie `deixa_locale`, senão do `Accept-Language`, senão
  `pt-BR`. A preferência fica em `user_preferences.locale`; entrar na conta e trocar o idioma no perfil gravam
  o cookie. Componente cliente usa `useTranslations`; page, action e rota usam `getTranslations`.
- `AppError` carrega só `code` e, opcionalmente, `detail: { key, params }`; a borda (`runAction`,
  `describeAppError`) traduz por `errors.<code>` ou `errors.detail.<key>`. Nenhum módulo monta frase.
- O que o banco guarda é dado, não frase: notificações têm `kind` + `params`; passos do processamento têm
  `key` + `detail.{key, params}`; falhas de lote e de trilha guardam um código; o retrato do aluno e o motivo
  local das sugestões são JSON com números e chaves; títulos gerados de bloco ficam vazios e a borda traduz por
  `isFinal` e índice. Texto escrito pela IA continua texto, no idioma pedido no prompt.
- Rótulos de domínio (`LEVEL_NAMES`, `RATING_LABELS`, `ITEM_TYPE_LABELS`, `OPERATION_LABELS`, temas do tutor,
  conquistas, missões, habilidades) viraram chaves; o domínio exporta só identificadores.
- Prompts da IA foram reescritos em inglês e recebem o idioma da interface como "idioma nativo"
  (`src/infrastructure/ai/prompt-languages.ts`); o idioma de estudo continua inglês até a frente B.
- Intervalos de revisão viram `{ unit, value }` e a interface formata; números e datas passam por
  `useFormatter`, nunca por `toLocaleString("pt-BR")`.

## Consequências

- Nenhum texto em português fora de `locales/`, do seed e dos provedores fake (diálogos e glossário de
  demonstração). Trocar o idioma no perfil troca a interface inteira, inclusive mensagens de erro, aviso na
  bandeja do desktop e notificações antigas, que são traduzidas na leitura.
- Migração 0018: `user_preferences.locale` e `notifications.params`; `title` e `body` saíram.
- Planos de trilha guardados com a versão 1 são regenerados na próxima abertura (`PLAN_VERSION = 2`), porque os
  enunciados passaram a ser chaves.
- Os menus nativos da casca (Tauri) seguem em português; entram no idioma da conta numa tarefa própria.
- Testes unitários conferem códigos e chaves, não frases. O e2e roda em `pt-BR` e tem um fluxo que troca
  para inglês e volta.

## Alternativas descartadas

- Rotas por idioma (`/en/...`): a interface é por conta, não por endereço, e as URLs são compartilhadas entre
  contas na mesma instalação.
- Guardar no banco o texto já traduzido: travaria o idioma da notificação ou da falha no momento da gravação.
- Traduzir dentro dos módulos: `application` não conhece Next nem o idioma da sessão; a tradução é coisa da
  borda.

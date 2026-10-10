---
title: Playwright
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: @playwright/test
version: "1.64"
docs: https://playwright.dev
---

# Playwright

## Papel

Fluxo ponta a ponta e screenshots de comparação com o protótipo.

## Como roda

`pnpm test:e2e`: build, banco `deixa_e2e` migrado e semeado, `next start` na porta 1310 com providers fake e TTS
silencioso, Chrome instalado (`channel: "chrome"`), viewport 390×844, um worker.

## Fluxo coberto

Login → buscar obra → escolher temporada e episódio → enviar EN + PT → processamento até pronto → reenviar e ver
a duplicidade → ler o episódio nos três modos → marcar palavras e uma fala → gerar cards → salvar → revisar →
conferir que outro usuário não vê os cards.

## Screenshots

`scripts/screenshots.mjs` captura cada tela em claro e escuro, e a tela equivalente do `deixa.html`, em
`screenshots/` (fora do git).

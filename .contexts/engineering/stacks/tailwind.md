---
title: Tailwind CSS
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: tailwindcss
version: "4"
docs: https://tailwindcss.com/docs
---

# Tailwind CSS

## Papel

Utilitários de layout e ponte dos tokens do protótipo.

## Como usamos

- `src/app/globals.css` importa o Tailwind, `tokens.css` e `components.css`.
- `tokens.css`: variáveis do `:root` do protótipo (claro, escuro por mídia e por `data-theme`) e `@theme inline`
  mapeando cores, fontes, raio e sombra para utilitários (`bg-surface`, `text-muted`, `font-display`…).
- `components.css`: classes do protótipo, dentro de `@layer components`.
- PostCSS com `@tailwindcss/postcss`.

## Convenções

- Classe do protótipo para o componente; utilitário para espaçamento e alinhamento pontuais.
- Sem `tailwind.config.js`.

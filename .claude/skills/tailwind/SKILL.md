---
name: tailwind
description: "Tailwind CSS 4: tokens do protótipo em @theme, classes de componente portadas do deixa.html. Use ao estilizar componentes ou mexer em src/ui/styles/."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Tailwind CSS

Padrões do projeto:

- `src/ui/styles/tokens.css` declara os tokens do `:root` do protótipo (claro e escuro) e os expõe no `@theme`.
- `src/ui/styles/components.css` guarda as classes de componente do protótipo (`btn`, `chip`, `cuebox`, `tline`, `gcard`…), com as mesmas medidas.
- Utilitários do Tailwind para ajustes de layout que no protótipo eram `style` inline.
- Tema escuro por `prefers-color-scheme` e por `data-theme` no `<html>`.

Proibido:

- Cor, raio ou sombra fora dos tokens; hex em componente (exceto cor de pôster e de avatar vinda do dado).
- `tailwind.config.js` (o Tailwind 4 configura por CSS).
- Biblioteca de componentes que imponha outro visual.

Profundidade: @.contexts/engineering/stacks/tailwind.md

---
title: Front-end
updated: 2026-10-10
source: deixa.html e PROJETO.md §3
---

# Front-end

## Regra

A tela implementada é a tela do protótipo. Componentes usam as classes e os tokens portados; não inventam.

## Como aplicar

1. Abrir o `deixa.html` na tela equivalente.
2. Copiar a estrutura de elementos e as classes; `style` inline do protótipo vira utilitário do Tailwind.
3. Trocar dados simulados por props.
4. Ligar interações a server actions.
5. Screenshot em 390×844, claro e escuro; comparar e corrigir.

## Limites

- `src/ui/**` não importa infraestrutura. Tipos vêm do `index.ts` dos módulos, com `import type`.
- Cor só por token. Exceções: cores de pôster tipográfico e de avatar, que são dado.
- Texto visível segue @.contexts/product/tone-of-voice.md.
- Nome do produto por `APP_NAME`.
- Pôster real: `next/image`, proporção 2:3, raio de 14px, etiquetas de nível por cima como no protótipo.

## Acessibilidade

- Botão de ícone com `aria-label`.
- Palavra marcável é `role="button"` com `tabIndex` e responde a Enter e espaço.
- Estado de áudio ("gerando…") em texto, não só em animação.
- Contraste herdado dos tokens do protótipo; `prefers-reduced-motion` respeitado.

Arquitetura: @.contexts/engineering/architecture/frontend.md

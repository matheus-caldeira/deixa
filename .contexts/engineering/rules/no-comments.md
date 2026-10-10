---
title: Código sem comentários
updated: 2026-10-10
source: preferência do autor; ADR 0011
---

# Código sem comentários

## Regra

Nenhum comentário em `.ts`, `.tsx`, `.mts`, `.js`, `.mjs`, `.cjs` nem em configs.

## Em vez de comentar

| Vontade                          | Faça                                        |
| -------------------------------- | ------------------------------------------- |
| Explicar um bloco                | Extraia função com nome que diga o que faz  |
| Explicar um número               | Constante nomeada (`SCENE_GAP_MS`)          |
| Explicar uma decisão             | ADR, `docs/DECISIONS.md` ou corpo do commit |
| Silenciar o lint ou o compilador | Corrija a causa                             |

## Verificação

`pnpm lint:comments` (`scripts/no-comments.mjs`) percorre `src`, `scripts`, `tests`, `.claude/hooks` e os
configs da raiz usando o parser do TypeScript.

CSS e Markdown não entram na regra: a folha de estilos pode ter títulos de seção.

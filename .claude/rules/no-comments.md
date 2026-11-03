# Código sem comentários

O código se explica sozinho: nenhum comentário em `.ts/.tsx/.mts/.js/.mjs/.cjs` nem em configs. Precisa explicar? Extraia função, constante ou tipo com nome melhor. O porquê vai para ADR, stack, `.contexts/engineering/decisions/journal.md` ou corpo do commit.

Checklist:

- [ ] Nada de `//`, `/* */`, JSDoc ou `{/* */}` em JSX.
- [ ] Nada de diretivas em comentário (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`): corrija a causa.
- [ ] Números mágicos viram constantes nomeadas.
- [ ] `pnpm lint:comments` passa.

Profundidade: @.contexts/engineering/rules/no-comments.md

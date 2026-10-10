---
name: react
description: "React 19: server components por padrão, componentes cliente pequenos, estado local, sem biblioteca de estado. Use ao criar ou alterar componentes em src/ui/."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# React

Padrões do projeto:

- Server component por padrão; `"use client"` só onde há interação (marcador, flashcard, sheets, busca).
- Estado local com `useState`/`useReducer`; chamada ao servidor com `useTransition` + server action.
- Dados por props; componente não busca dado por conta própria.
- Listas longas (legenda do episódio) com `key` estável pelo id da fala.
- Acessibilidade: botão é `<button>`, rótulo em `aria-label` quando só há ícone, foco visível.

Proibido:

- Redux, Zustand, TanStack Query: fora da stack nesta fase.
- `useEffect` para derivar estado que cabe em render.
- `dangerouslySetInnerHTML` com texto de legenda.

Profundidade: @.contexts/engineering/stacks/react.md

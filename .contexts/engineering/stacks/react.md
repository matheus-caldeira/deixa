---
title: React
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: react
version: "19.3"
docs: https://react.dev
---

# React

## Papel

Componentes da interface.

## Como usamos

- Server components por padrão; cliente só onde há interação.
- `useTransition` para chamar server actions sem travar a tela; `useOptimistic` quando ajudar.
- Estado local; nenhum gerenciador global.
- Componentes por área em `src/ui/`, recebendo dados por props.

## Componentes cliente principais

`ReadScreen` (marcador, modos, busca, áudio, geração de cards), `ReviewScreen` (flashcard e notas),
`UploadSheet` (busca no TMDB, escolha de episódio, envio), `ProfileSheet` (preferências e chave de IA),
`CatalogScreen` (busca e filtros), `LoginScreen`.

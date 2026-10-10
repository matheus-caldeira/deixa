---
title: Front-end
updated: 2026-10-10
source: deixa.html e PROJETO.md §3
---

# Front-end

## Princípio

A interface segue o protótipo aprovado. O caminho mais curto para a fidelidade é reaproveitar a folha de estilos
dele: os tokens do `:root` e as classes de componente foram portados para `src/ui/styles/`, e os componentes
React usam os mesmos nomes de classe.

## Organização

```
src/ui/styles/tokens.css       tokens claro/escuro + @theme do Tailwind
src/ui/styles/components.css   classes do protótipo (btn, chip, nav, cuebox, tline, gcard…)
src/ui/icons.tsx               ícones do objeto I
src/ui/<área>/                 componentes por área: shell, catalog, read, review, home, progress, talk, auth
```

## Rotas

| Rota                    | Tela do protótipo                         |
| ----------------------- | ----------------------------------------- |
| `/login`, `/signup`     | Seletor de perfil (picker)                |
| `/`                     | Início                                    |
| `/catalog`              | Explorar                                  |
| `/catalog/[mediaId]`    | Detalhe da obra                           |
| `/review`               | Revisar                                   |
| `/tutor`                | Conversar                                 |
| `/progress`             | Progresso                                 |
| `/read/[episodeId]`     | Ler episódio e marcar (tela cheia)        |
| `/api/audio/**`         | Áudio de uma fala ou de um item           |

## Fluxo de dados

1. A page (server component) resolve o usuário e chama os casos de uso.
2. Entrega props serializáveis ao componente da tela.
3. Interações chamam server actions; a action revalida a rota quando o dado muda.
4. Áudio: o cliente pede ao handler, recebe o WAV e toca; enquanto espera, mostra "gerando…".

## Estado no cliente

Só o que é da interação: modo de exibição, marcações em edição (sincronizadas com o servidor), carta virada,
passo do envio. Nenhuma biblioteca de estado.

## Validação visual

Cada tela é conferida com screenshot em 390×844, claro e escuro, ao lado da mesma tela do protótipo. Depois, em
desktop, com a coluna de 480px centralizada.

Tokens e componentes: @.contexts/product/design-system.md

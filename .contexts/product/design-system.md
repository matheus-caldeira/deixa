---
title: Design system
updated: 2026-10-10
source: deixa.html (bloco :root, folha de estilos e objeto de ícones)
---

# Design system

O protótipo `deixa.html` é a referência visual. Tokens e classes foram extraídos dele; nenhuma cor é inventada.

## Tokens de cor

| Token          | Claro     | Escuro    | Uso                                         |
| -------------- | --------- | --------- | ------------------------------------------- |
| `--bg`         | `#F2F3F8` | `#0E1018` | Fundo da aplicação                          |
| `--surface`    | `#FFFFFF` | `#171A26` | Cartões, campos                             |
| `--surface-2`  | `#E8EAF2` | `#212536` | Fundo de chips, trilhos de barra            |
| `--ink`        | `#161927` | `#EDEFF7` | Texto                                       |
| `--muted`      | `#5F6680` | `#9AA1B9` | Texto secundário                            |
| `--line`       | `#D8DBE6` | `#2B3046` | Bordas, sombra inferior neutra              |
| `--brand`      | `#2F43D6` | `#6E80FF` | Ação principal, seleção                     |
| `--brand-deep` | `#1E2C9E` | `#4153D8` | Sombra inferior do botão principal          |
| `--brand-soft` | `#E3E7FF` | `#232A55` | Fundo de seleção                            |
| `--cue`        | `#FFC63A` | `#FFC63A` | Amarelo de legenda: marcador, nível, cena   |
| `--cue-deep`   | `#C9930C` | `#B88608` | Sombra e texto sobre `cue-soft`             |
| `--cue-ink`    | `#3A2900` | `#2B1F00` | Texto sobre amarelo                         |
| `--cue-soft`   | `#FFF3D1` | `#3A2F12` | Fundo de dica e de fala marcada             |
| `--flame`      | `#FF5A33` | `#FF6A45` | Sequência                                   |
| `--good`       | `#0F9E73` | `#2CC594` | Certo, pronto, legenda PT                   |
| `--good-soft`  | `#DDF5EC` | `#123A2F` | Fundo de sucesso                            |
| `--bad`        | `#DD3B44` | `#FF6B71` | Errado, falha                               |
| `--bad-soft`   | `#FDE3E4` | `#3F1B20` | Fundo de erro                               |

Sombra: `0 1px 2px rgba(22,25,39,.06), 0 6px 18px rgba(22,25,39,.06)` no claro; `0 1px 2px rgba(0,0,0,.4)` no
escuro. Raio base: 16px.

O tema segue `prefers-color-scheme`; `data-theme="light"` ou `"dark"` no `<html>` força um deles.

## Tipografia

| Papel   | Fonte               | Pesos              | Uso                                     |
| ------- | ------------------- | ------------------ | --------------------------------------- |
| Display | Bricolage Grotesque | 600, 800           | Títulos, números grandes, logotipo      |
| Corpo   | Figtree             | 400 a 800          | Texto, botões, rótulos (15px base)      |
| Mono    | JetBrains Mono      | 500, 700           | Timecodes, nível, etiquetas de origem   |

## Componentes (classes do protótipo)

- **Botão** (`btn`): maiúsculas, peso 800, raio 14px, sombra inferior sólida de 4px que afunda ao toque.
  Variantes: `cue`, `good`, `bad`, `ghost`, `onDark`, `block`.
- **Chip** (`chip`): pílula de 12px; variantes `good`, `warn`, `bad`, `brand`. `lvlchip`: nível em mono sobre amarelo.
- **Barra inferior** (`nav`): cinco abas fixas, ícone de 24px e rótulo de 11px.
- **Topo** (`topbar`): avatar, nível, sequência e XP do dia.
- **Cuebox**: bloco preto de legenda com timecode em mono e fala em amarelo.
- **Trilha** (`trail`, `tnode`): linha tracejada central, paradas alternadas, timecode de cada cena.
- **Pôster** (`poster`): 2:3, raio 14px. Real (TMDB) ou tipográfico (gradiente diagonal com o título).
- **Linha de leitura** (`tline`): timecode, fala em 18px, botão de marcador, tradução com etiqueta de origem.
- **Marcador** (`w.mk`): faixa amarela sobre a palavra. Fala inteira marcada: fundo `cue-soft`.
- **Card de geração** (`gcard`): termo em display, tipo, origem, contexto com o trecho destacado.
- **Flashcard** (`flash`): frente e verso com giro; notas em quatro botões (`grade`).
- **Sheet**: painel inferior com alça, para perfil e envio de legendas.
- **Passo de processamento** (`pstep`): concluído, em andamento, aguardando.

## Ícones

Os do objeto `I` do protótipo, em `src/ui/icons.tsx`: traço 2,2 (variações por ícone), cantos arredondados,
`currentColor`. Chama e raio usam as cores `flame` e `cue`.

## Layout

- Mobile-first, validado em 390×844.
- Coluna única de no máximo 480px, centralizada no desktop.
- Conteúdo com 16px de margem lateral e 112px de respiro para a barra inferior.
- Leitura, e depois lição e chat, em tela cheia, sem a barra inferior.

## Movimento

Transições curtas (80 a 450 ms). `prefers-reduced-motion: reduce` desliga animações e transições.

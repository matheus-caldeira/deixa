---
title: "ADR 0013: Interface portada do protótipo"
updated: 2026-10-10
source: deixa.html
status: aceita
---

# ADR 0013: Interface portada do protótipo

## Contexto

O protótipo foi aprovado e é a referência visual. Reinterpretá-lo em outra linguagem de estilo cria diferenças.

## Decisão

Portar tokens e classes do protótipo para `src/ui/styles/` e usar os mesmos nomes de classe nos componentes
React. Tailwind 4 recebe os tokens no `@theme` e cobre os ajustes de layout. Ícones do objeto `I` viram
componentes com os mesmos traços. shadcn/ui não entra enquanto nenhum componente dele ajudar.

## Consequências

- Fidelidade alta com pouco esforço.
- Duas formas de estilizar convivem: classes do protótipo para componentes, utilitários para layout.

## Alternativas descartadas

- Reescrever tudo em utilitários: mais risco de divergência.
- Biblioteca de componentes pronta: imporia outro visual.

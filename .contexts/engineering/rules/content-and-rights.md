---
title: Conteúdo e direitos
updated: 2026-10-10
source: PROJETO.md §5 (Produção) e §6 (Roteiro)
---

# Conteúdo e direitos

## Regra

Nada de legenda ou roteiro real no repositório.

## Como aplicar

- `fixtures/sample.en.srt` e `fixtures/sample.pt-BR.srt` usam o diálogo fictício do protótipo, com tempos
  levemente desalinhados de propósito.
- O seed cria obras pelo `FakeMetadataProvider` e episódios com o mesmo diálogo fictício.
- Obras reais entram pelo cadastro com o TMDB, e as legendas, pelo upload de quem usa; ficam em `data/`.
- Títulos, sinopses e pôsteres do TMDB são metadados, não conteúdo da obra.

## Antes de abrir para terceiros

Revisar direitos de redistribuição de legendas e roteiros; avaliar catálogo privado por grupo; não exibir
roteiro completo; guardar a origem.

Conformidade: @.contexts/business/compliance.md

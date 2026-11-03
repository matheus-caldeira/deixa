---
title: fflate
updated: 2026-10-13
source: .superpowers/planning/OFFLINE-EXPORT-DRAFT.md e ADR 0016
package: fflate
version: "0.8"
docs: https://github.com/101arrowz/fflate
---

# fflate

## Papel

Montar e abrir o `.deixa.zip` dos pacotes de importação e exportação, em Node e, depois, no navegador.

## Como usamos

- Só em `src/modules/packages/infrastructure/fflate-archive.ts`, atrás do port `PackageArchive`.
- `zipSync` com nível 6 para gerar; `unzipSync` com filtro de caminho para abrir: só entram caminhos relativos
  com letras, números, ponto, hífen e sublinhado, sem `..` nem barra inicial.
- O conteúdo do ZIP é tratado como entrada hostil: o manifesto diz quais arquivos valem e o hash de cada um; o
  resto é ignorado. Limites de tamanho total, de quantidade de arquivos e de cada JSON ficam no domínio.
- Hoje tudo em memória, com teto de 1 GB por pacote; o modo em fluxo fica para quando houver áudio em lote.

## Testes

Os testes unitários usam um arquivo de mentira em JSON; o fflate só entra na integração e no e2e.

---
title: Testes
updated: 2026-10-10
source: PROJETO.md §4 (Testes); ADR 0012
---

# Testes

## Pirâmide

| Nível      | Comando                 | O que cobre                                                  | Depende de               |
| ---------- | ----------------------- | ------------------------------------------------------------ | ------------------------ |
| Unitário   | `pnpm test`             | Domínio e casos de uso com fakes                             | Nada                     |
| Integração | `pnpm test:integration` | Repositórios Drizzle (isolamento, deduplicação); TMDB real   | Postgres; token opcional |
| Bundle     | `pnpm test:bundle`      | Token do TMDB ausente de `.next/static`                      | Build                    |
| E2E        | `pnpm test:e2e`         | Login → obra → upload → leitura → marcação → cards → revisão | Postgres, Chrome         |

## Casos unitários obrigatórios

- Parser SRT: bloco simples, várias linhas, tags de formatação, BOM, CRLF, bloco inválido ignorado.
- Alinhamento: 1:1, 1:N, N:1, deslocamento fixo, sem par.
- Agrupamento de marcações: vizinhas viram expressão; fala inteira; separadas ficam separadas.
- Deduplicação: mesmo arquivo → `DUPLICATE`; arquivo diferente → conflito.
- Isolamento: marcações, cards e itens privados.
- TMDB: mapeamento de busca, série, temporada e filme; pt-BR vazio cai para en-US.
- Áudio: hash estável; segundo pedido não chama o provider.
- Revisão: intervalos por nota; "De novo" zera a sequência.
- Cifra da chave: ida e volta; adulteração falha; máscara.

## Convenções

- Arquivo de teste ao lado do código, com o nível no nome.
- Fakes dos ports em `application/testing/`.
- `FixedClock` e ids sequenciais nos testes.
- Um arquivo por vez; nunca duas suítes ao mesmo tempo.
- Fixtures fictícias em `fixtures/`.

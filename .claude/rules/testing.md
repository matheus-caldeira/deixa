---
paths: ["**/*.test.ts", "**/*.test.tsx", "tests/**", "vitest*.config.*", "playwright.config.ts"]
---

# Testes

Testes unitários são o foco: domínio puro e casos de uso com fakes de ports. Integração cobre o que só existe com serviço real (repositórios no Postgres, TMDB). Um fluxo Playwright cobre a jornada principal. A LLM nunca é chamada em teste.

Checklist:

- [ ] Nomes: `*.unit.test.ts`, `*.integration.test.ts`; Playwright em `tests/e2e/*.spec.ts`.
- [ ] Domínio com teste ao lado: parser SRT, alinhamento (1:1, 1:N, N:1, deslocamento fixo), agrupamento de marcações, agendamento de revisão, hash de áudio, mapeamento do TMDB.
- [ ] Casos de uso com fakes: deduplicação de legenda, geração de cards, isolamento entre usuários.
- [ ] `pnpm test:integration` pula o TMDB real quando `TMDB_READ_ACCESS_TOKEN` não existe; nunca falha por falta de credencial.
- [ ] `pnpm test:bundle` roda depois do build e procura o token em `.next/static`.
- [ ] Fixtures de SRT fictícias em `fixtures/`.
- [ ] Sem paralelismo (RAM): `fileParallelism: false`, um worker.

Profundidade: @.contexts/engineering/rules/testing.md

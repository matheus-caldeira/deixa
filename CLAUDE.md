# CLAUDE.md

**Deixa** (nome provisório): plataforma para aprender um idioma (inglês, português, espanhol ou francês) a
partir das séries e filmes que a pessoa já assiste. O usuário escolhe o par idioma base → idioma de estudo,
importa a legenda do episódio (no idioma de estudo e, de preferência, no idioma base), lê o episódio inteiro,
marca o que não entendeu e transforma as marcações em cards de revisão. Especificação: @PROJETO.md. Protótipo aprovado da
interface: `deixa.html`.

Idioma: português do Brasil com acentuação correta; identificadores de código em inglês. Texto de interface
nunca fica no código: vai para `locales/pt-BR.json` e `locales/en.json`, com a mesma chave nos dois.

## Onde está cada coisa

- `PROJETO.md` manda em caso de dúvida. `deixa.html` manda no visual.
- `.contexts/` é a **fonte da verdade** (negócio, produto, engenharia). Índice: @.contexts/README.md
- `.claude/` só **ativa** esse conhecimento: rules, skills, agents e hooks. Mudou uma regra? Edite `.contexts/`
  primeiro, depois o ativador.
- `.superpowers/planning/` (local, fora do git): `PLAN.md` com as tarefas e o critério de pronto, `HANDOFF.md`,
  rascunhos e `TESTES-MANUAIS.md`. `docs/DECISIONS.md`: diário de decisões (versionado).
- Vocabulário único: @.contexts/business/glossary.md
- `data/` (legendas enviadas, alinhamentos, áudio) e `.env*` ficam fora do git.

## Regra central

**O catálogo é compartilhado. O aprendizado é individual.** Todo dado individual é lido e escrito com o `userId`
da sessão e, quando depende do idioma, com o par ativo da conta (`pairOf(user.preferences)`), nunca com um
par vindo do cliente. Detalhes: @.claude/rules/user-isolation.md

## Stack (versões e uso em `.contexts/engineering/stacks/`)

- Node 24, pnpm 12, TypeScript 5.9 estrito.
- Next 16 (App Router), React 19, Tailwind 4, Zod 4.
- Drizzle + PostgreSQL 17 (docker compose).
- TMDB atrás de `MetadataProvider`; IA pelo AI SDK atrás de `LlmProvider`; Kokoro atrás de `TtsProvider`. Cada um tem
  uma implementação de reserva (fake ou silenciosa) usada nos testes e quando falta credencial ou serviço.
- Vitest e Playwright.

## Estrutura de `src/`

```
src/app/              (auth), (learning) com as abas, settings, transfer, read/[episodeId], api/audio, api/transfer
src/ui/               componentes React, icons.tsx, styles/ (tokens e classes do protótipo)
src/modules/<m>/      domain/ · application/ (casos de uso + ports) · infrastructure/ · index.ts
                      identity, catalog, subtitles, alignment, highlights, learning, flashcards,
                      ai-credentials, audio, gamification, study, notifications, conversations,
                      subtitle-sources, recommendations, settings, ai-usage, packages, jobs, scripts
src/infrastructure/   config/env.ts, database/, storage/, tmdb/, ai/, kokoro/, logger/, container.ts
src/shared/           app.ts (APP_NAME), errors, levels, locales, study-languages (par de idiomas), clock, ids
src/i18n/             request.ts (idioma por pedido), messages.ts (carrega locales/<idioma>.json)
locales/              pt-BR.json e en.json: todo texto da interface, por tela (ADR 0018)
src/seed/             seed de demonstração
src/worker/           processo separado que consome a job_queue (pnpm worker)
tests/                e2e (Playwright), bundle
fixtures/             SRT fictícios EN e PT
```

Fronteiras: `domain` puro; `application` só com ports; um módulo importa outro pelo `index.ts`; componente React
nunca importa repositório, cliente Gemini, TMDB nem Kokoro. Detalhes:
@.contexts/engineering/architecture/modules-and-boundaries.md

## Comandos

```bash
pnpm install
pnpm setup:env         # cria ou completa o .env sem imprimir valores
pnpm infra:up          # Postgres (1442) e Kokoro (1881)
pnpm db:migrate        # aplica as migrações
pnpm db:seed           # perfis, obras e episódios de demonstração
pnpm dev               # http://localhost:1300
pnpm worker            # consome a job_queue (só com JOBS_MODE=worker no .env)
pnpm typecheck && pnpm lint && pnpm lint:comments && pnpm test
pnpm test:integration  # Postgres + TMDB real (pulado sem token)
pnpm build && pnpm test:bundle   # token do TMDB fora de .next/static
pnpm test:e2e          # Playwright no Chrome instalado
pnpm test:integration:pglite   # integração no PGlite em memória
pnpm build:web && pnpm test:web # modo pessoal (export estático em .next-web) no Chrome
```

## Gates de qualidade

- Depois de cada tarefa: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Não avançar com erro.
- **Código sem comentários** (@.claude/rules/no-comments.md).
- Testes **sem paralelismo**.
- LLM nunca é chamada em teste. TMDB real só em `test:integration`.
- Seeds e fixtures com diálogos fictícios (@.claude/rules/content-and-rights.md).

## Segredos

- Credenciais do TMDB só no `.env` (`TMDB_API_KEY`, `TMDB_READ_ACCESS_TOKEN`); nunca imprimir, logar ou versionar.
- O `.env.tmdb` usa `nome: valor`: não usar `cat`, `cut` nem `grep` que mostrem a linha.
- Chave Gemini do usuário cifrada com AES-256-GCM; nunca volta ao navegador.

## Git

- Identidade herdada do `~/.gitconfig`. Nunca rodar `git config user.*`.
- Conventional Commits, um por tarefa do plano. Sem push, remote ou PR sem pedido explícito.
- Antes de cada commit, `git status` confirma que nenhum `.env*` além do `.env.example` entrou.
- Regras completas: @.claude/rules/git-and-commits.md

## Instalação de software

Não instalar nada no sistema sem confirmação explícita do usuário. Dependências do projeto (`pnpm add`) e
imagens do `docker-compose.yml` fazem parte do trabalho.

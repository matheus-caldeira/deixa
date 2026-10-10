---
title: Visão geral da arquitetura
updated: 2026-10-10
source: PROJETO.md §4 e §14
---

# Visão geral

Monólito modular em TypeScript. Uma aplicação Next.js serve interface e API; a separação está nas camadas de
domínio, aplicação e infraestrutura, para extrair serviços depois sem reescrever regra de negócio.

```
┌───────────────────────────────────────────────────────────┐
│ src/app  — pages, server actions, route handlers (borda)  │
│ src/ui   — componentes React, tokens e classes do protótipo│
├───────────────────────────────────────────────────────────┤
│ src/modules/<m>/application — casos de uso + ports        │
│ src/modules/<m>/domain      — regras puras                │
├───────────────────────────────────────────────────────────┤
│ src/modules/<m>/infrastructure — repositórios Drizzle     │
│ src/infrastructure — config, database, storage, tmdb,     │
│                      google-ai, kokoro, logger, container │
├──────────────┬───────────────────┬────────────────────────┤
│ PostgreSQL   │ data/ (SRT, áudio)│ Kokoro (container)     │
└──────────────┴───────────────────┴────────────────────────┘
```

## Processos

| Processo       | Papel                                                     | Fase |
| -------------- | --------------------------------------------------------- | ---- |
| Next.js        | Interface, actions, handlers, importação de legendas      | 01   |
| PostgreSQL     | Catálogo, falas, alinhamento, marcações, cards, progresso | 01   |
| Kokoro-FastAPI | Geração de voz por HTTP                                   | 02   |
| Worker Node.js | Seleção pedagógica com LLM e áudio em lote                | 03   |

## Serviços externos e reservas

| Serviço | Port               | Implementação real     | Reserva                | Quando a reserva entra                 |
| ------- | ------------------ | ---------------------- | ---------------------- | -------------------------------------- |
| TMDB    | `MetadataProvider` | `TmdbMetadataProvider` | `FakeMetadataProvider` | Sem credenciais no `.env`; testes      |
| Gemini  | `LlmProvider`      | `GeminiLlmProvider`    | `FakeLlmProvider`      | Usuário sem chave; testes              |
| Kokoro  | `TtsProvider`      | `KokoroTtsProvider`    | `SilentTtsProvider`    | Sem `KOKORO_URL`; serviço fora; testes |

## Dados

- PostgreSQL guarda metadados, caminhos relativos, hashes e estados.
- Arquivos (legendas originais, alinhamento, áudio) ficam em `DATA_DIR` (`data/`), fora do git.
- Em produção, `data/` precisa de volume persistente ou storage de objetos; o port `FileStorage` isola isso.

## Fora do escopo do MVP

Kubernetes, microsserviços, embeddings, RAG, fila externa. Redis + BullMQ entram quando o processamento
assíncrono justificar.

Detalhes: @.contexts/engineering/architecture/modules-and-boundaries.md,
@.contexts/engineering/architecture/user-isolation.md,
@.contexts/engineering/architecture/processing-pipeline.md,
@.contexts/engineering/architecture/ai-layer.md,
@.contexts/engineering/architecture/frontend.md

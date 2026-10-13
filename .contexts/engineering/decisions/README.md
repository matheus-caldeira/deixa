---
title: Decisões de arquitetura (ADRs)
updated: 2026-10-10
source: PROJETO.md e execução das fases 01 e 02
---

# ADRs

Decisões permanentes de arquitetura. O diário do dia a dia, com as escolhas feitas durante a execução, está em
`docs/DECISIONS.md`; quando uma delas vira regra, ganha um ADR aqui.

| ADR  | Decisão                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------- |
| 0001 | [Next.js único, monólito modular](0001-nextjs-monolito-modular.md)                                      |
| 0002 | [Módulos verticais e fronteiras](0002-modulos-e-fronteiras.md)                                          |
| 0003 | [PostgreSQL com Drizzle](0003-postgres-drizzle.md)                                                      |
| 0004 | [Autenticação por sessão própria](0004-sessao-propria.md)                                               |
| 0005 | [Catálogo compartilhado, aprendizado individual](0005-catalogo-compartilhado-aprendizado-individual.md) |
| 0006 | [Alinhamento EN ↔ PT determinístico](0006-alinhamento-deterministico.md)                                |
| 0007 | [TMDB atrás do MetadataProvider](0007-metadata-provider-tmdb.md)                                        |
| 0008 | [LlmProvider e chave Gemini por usuário](0008-llm-provider-e-chave-por-usuario.md)                      |
| 0009 | [Kokoro em container, áudio sob demanda](0009-tts-kokoro-sob-demanda.md)                                |
| 0010 | [Arquivos em data/, caminho relativo e SHA-256](0010-arquivos-em-data-com-hash.md)                      |
| 0011 | [Código sem comentários](0011-codigo-sem-comentarios.md)                                                |
| 0012 | [Estratégia de testes](0012-estrategia-de-testes.md)                                                    |
| 0013 | [Interface portada do protótipo](0013-interface-pelo-prototipo.md)                                      |
| 0014 | [Chamadas de IA pelo AI SDK](0014-ia-pelo-ai-sdk.md)                                                    |
| 0015 | [Medição e limite de uso da IA](0015-medicao-e-limite-de-uso-da-ia.md)                                  |
| 0016 | [Pacotes de importação e exportação](0016-pacotes-de-importacao-e-exportacao.md)                        |

## Formato

Front-matter (`title`, `updated`, `source`, `status`) e quatro seções: Contexto, Decisão, Consequências,
Alternativas descartadas. ADR aceito não é reescrito: uma decisão nova o substitui e cita o anterior.
| 0017 | [Postgres embutido na instalação local](0017-postgres-embutido.md) |

---
title: Casos de uso
updated: 2026-10-10
source: PROJETO.md §14 (Regras)
---

# Casos de uso

## Forma

```ts
export function makeImportEpisodeSubtitles(deps: {
  episodes: EpisodeRepository;
  subtitles: SubtitleRepository;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function importEpisodeSubtitles(input: ImportInput): Promise<ImportResult> {
    …
  };
}
```

- Um arquivo por caso, em kebab-case, com verbo de negócio.
- Dependências por ports, montadas no container.
- Caso individual: `userId` no input, vindo da sessão.
- Erro esperado: `AppError`. Exceção genérica é bug ou infraestrutura.

## O que não é caso de uso

- Formatação para a tela (fica no componente).
- Regra pura reutilizável (fica em `domain/`).
- Chamada HTTP ou SQL (fica no adapter).

## Chamadores

Page, server action, route handler, seed e, na fase 03, worker e workflows. Todos pelo container.

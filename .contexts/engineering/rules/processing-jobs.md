---
title: Processamento de episódios
updated: 2026-10-15
source: PROJETO.md §9
---

# Processamento de episódios

## Regra

Etapas explícitas, estado gravado, falha recuperável. Nada de agente decidindo o fluxo.

## Como aplicar

- `processing_jobs` guarda `kind`, `status`, `attempts`, `steps` (rótulo, detalhe, estado) e `failure_reason`.
- O caso de uso `import-episode-subtitles` devolve as etapas com os dados reais; a interface as mostra.
- Erro esperado (arquivo inválido, versão conflitante) vira `AppError` e não muda o episódio.
- Erro inesperado no meio marca `FAILED` com motivo e permite reenvio.
- Áudio nunca bloqueia `READY`.

## Fila de jobs (fase 03)

- Trabalho em segundo plano (trilha, cards, sugestões, áudio do episódio) entra em `job_queue` pelo módulo `jobs`,
  com payload validado por Zod por tipo; nunca por `after()` direto.
- Reivindicação com `SELECT … FOR UPDATE SKIP LOCKED` numa transação; bloqueio de 15 min; tentativas com espera
  crescente até `max_attempts`; falha final guarda o motivo.
- `JOBS_MODE=inline` (padrão): a borda enfileira e executa o próprio job em `after()`. `JOBS_MODE=worker`: só o
  processo `pnpm worker` consome. Os dois modos podem rodar juntos.
- Timer dentro do processo web continua proibido; o polling vive só em `src/worker/main.ts`.
- Áudio em lote nunca segura o `READY`: é um job depois da importação, e a fala toca sob demanda enquanto isso.
- Redis + BullMQ só quando houver necessidade real.

Decisão: @.contexts/engineering/decisions/0021-worker-audio-em-lote-e-roteiro.md

Arquitetura: @.contexts/engineering/architecture/processing-pipeline.md

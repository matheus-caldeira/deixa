---
title: Processamento de episódios
updated: 2026-10-10
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

## Fase 03

O worker Node.js separado lê jobs com bloqueio transacional (`FOR UPDATE SKIP LOCKED`), executa seleção
pedagógica e áudio em lote, com tentativas limitadas. Redis + BullMQ só quando houver necessidade real.

Arquitetura: @.contexts/engineering/architecture/processing-pipeline.md

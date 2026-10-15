# Processamento de episódios

A importação é um workflow determinístico com etapas explícitas e estado gravado em `processing_jobs`. O episódio passa por `UPLOADED`, `PROCESSING` e termina em `READY`, `FAILED` ou `NEEDS_REVIEW`. Trabalho em segundo plano (trilha, cards, sugestões, áudio do episódio) entra na `job_queue` pelo módulo `jobs` e roda no próprio processo (`JOBS_MODE=inline`) ou no `pnpm worker`.

Checklist:

- [ ] O arquivo original é salvo antes de qualquer processamento.
- [ ] Cada job registra etapas, tentativas e motivo da falha.
- [ ] Falha deixa o episódio em `FAILED`, recuperável por novo envio, sem linhas órfãs.
- [ ] Alinhamento EN ↔ PT e conferência de roteiro não usam LLM.
- [ ] O episódio fica `READY` sem depender de áudio; a interface mostra o estado.
- [ ] Trabalho em segundo plano passa por `scheduleJob` (`src/app/schedule.ts`), nunca por `after()` direto; payload com schema Zod em `modules/jobs/domain/payloads.ts`.
- [ ] Reivindicação de job só com `FOR UPDATE SKIP LOCKED`; tentativa com espera crescente e motivo gravado.
- [ ] `setInterval` ou cron dentro do processo web: proibido; polling só em `src/worker/main.ts`.

Profundidade: @.contexts/engineering/rules/processing-jobs.md

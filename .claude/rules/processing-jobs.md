# Processamento de episódios

A importação é um workflow determinístico com etapas explícitas e estado gravado em `processing_jobs`. O episódio passa por `UPLOADED`, `PROCESSING` e termina em `READY`, `FAILED` ou `NEEDS_REVIEW`. Nas fases 01 e 02 roda dentro da requisição; o worker separado entra quando houver LLM e áudio em lote.

Checklist:

- [ ] O arquivo original é salvo antes de qualquer processamento.
- [ ] Cada job registra etapas, tentativas e motivo da falha.
- [ ] Falha deixa o episódio em `FAILED`, recuperável por novo envio, sem linhas órfãs.
- [ ] Alinhamento EN ↔ PT e conferência de roteiro não usam LLM.
- [ ] O episódio fica `READY` sem depender de áudio; a interface mostra o estado.
- [ ] `setInterval` ou cron dentro do processo web: proibido.

Profundidade: @.contexts/engineering/rules/processing-jobs.md

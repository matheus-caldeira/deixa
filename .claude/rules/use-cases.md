# Casos de uso

A regra de negócio vive em `modules/<m>/application/`: um arquivo por caso de uso, chamado do mesmo jeito por page, server action, route handler e, depois, worker. A borda é fina. O caso de uso depende de ports, nunca de infraestrutura concreta.

Checklist:

- [ ] Arquivo em kebab-case com verbo de negócio, exportando `make<CasoDeUso>(deps)`.
- [ ] Caso individual recebe `userId` como primeiro dado do input, vindo da sessão.
- [ ] Repositório, relógio, ids, storage, metadados, LLM e TTS entram por ports.
- [ ] Sem `Date.now()` nem `crypto.randomUUID()` direto no caso de uso: `Clock` e `IdGenerator`.
- [ ] Erro esperado é `AppError` com `code`; exceção genérica só para bug ou falha de infraestrutura.
- [ ] Sem regra de negócio em `page.tsx`, server action, `route.ts` ou componente.
- [ ] Server action é invólucro de `runOperation`; a operação mora em `src/operations/` (ADR 0023).

Profundidade: @.contexts/engineering/rules/use-cases.md

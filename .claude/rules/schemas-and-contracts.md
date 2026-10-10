# Schemas e contratos

O Zod é a fonte única de forma de dado nas fronteiras; o tipo vem de `z.infer`. Cada módulo expõe sua API pública em `index.ts`.

Checklist:

- [ ] Todo dado que cruza fronteira (server action, route handler, resposta do TMDB, resposta da LLM, variável de ambiente) passa por schema Zod.
- [ ] `type X = z.infer<typeof xSchema>`; sem `interface` paralela para o mesmo dado.
- [ ] Outro módulo importa só de `index.ts`, nunca de `domain/`, `application/` ou `infrastructure/` alheios.
- [ ] Entrada sem `userId` do cliente.
- [ ] Erro de domínio é `AppError` com `code` estável; a borda traduz para mensagem em português.
- [ ] Resposta ao cliente nunca inclui `password_hash`, `encrypted_api_key`, token ou caminho absoluto de arquivo.

Profundidade: @.contexts/engineering/rules/schemas-and-contracts.md

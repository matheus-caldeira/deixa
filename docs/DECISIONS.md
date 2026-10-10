# Diário de decisões

Decisões tomadas durante a execução, quando o PROJETO.md deixava a escolha em aberto. Formato: data, decisão,
motivo, alternativa descartada. Decisão que vira regra permanente ganha um ADR em
`.contexts/engineering/decisions/`.

| Data | Decisão | Motivo | Alternativa descartada |
| ---- | ------- | ------ | ---------------------- |
| 2026-10-10 | `.claude/` e `.contexts/` reescritos para este produto, mantendo a estrutura de origem (rules, skills, agents, hooks; business, product, engineering) | As regras de origem tratavam de multi-tenant, dinheiro, filas e billing, que não existem aqui; adaptar por substituição de palavras deixaria regras falsas | Copiar tudo e trocar nomes |
| 2026-10-10 | Saíram: verificador de harness, lefthook, dependency-cruiser, Stryker, Testcontainers e as stacks sem uso (fila, cache, storage S3, analytics, pagamentos, gráficos, MCP) | Nenhuma delas é usada nas fases 01 e 02; menos peças para manter | Manter a malha completa desde já |
| 2026-10-10 | Entraram regras novas: isolamento entre usuários, metadados externos (TMDB), conteúdo e direitos | São os riscos próprios deste produto | — |
| 2026-10-10 | Portas próprias: 3300 (dev), 3310 (e2e), 5442 (Postgres), 8881 (Kokoro) | 3000 e 5432 já estavam ocupadas por outros projetos na máquina | Parar os serviços dos outros projetos |
| 2026-10-10 | Autenticação por sessão própria: `scrypt` + token aleatório em cookie `HttpOnly` (ADR 0004) | O modelo de dados já prevê `password_hash`; nenhuma dependência nova | Biblioteca de autenticação completa |
| 2026-10-10 | Filme = temporada 0 com um episódio "Filme completo" (ADR 0005) | Um só caminho para legendas, leitura e progresso; é o que o protótipo faz | Legenda ligada direto à obra |
| 2026-10-10 | Imagem do Kokoro fixada em `ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.4` | Última versão publicada com imagem arm64; o checkout local (0.6.0-rc1) roda fora do Docker, com MPS | Construir a imagem a partir do checkout local |

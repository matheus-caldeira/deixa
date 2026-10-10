# Plano: fases 01 (Fundação e catálogo) e 02 (Leitura e marcador)

Atualizado conforme o trabalho avança. `[x]` concluído, `[ ]` pendente.

| #  | Tarefa | Critério de pronto | Estado |
| -- | ------ | ------------------ | ------ |
| 00 | Repositório, `.gitignore`, `.claude/` e `.contexts/` adaptados, plano e diário | `git check-ignore` confirma `.env` e `.env.tmdb`; primeiro commit só com documentação | [x] |
| 01 | Scaffold: Next, TypeScript estrito, Tailwind, ESLint, Vitest, compose, `env.ts`, `.env` | `pnpm typecheck`, `lint`, `test` e `build` passam; Postgres de pé; `.env` criado sem exibir valores | [ ] |
| 02 | Design system: tokens, classes do protótipo, ícones, fontes | Tokens claro/escuro idênticos ao `:root` do protótipo; ícones como componentes | [ ] |
| 03 | Schema e migrações | `pnpm db:migrate` cria todas as tabelas das fases 01 e 02 | [ ] |
| 04 | Identidade: senha, sessão, entrar, criar conta, preferências | Teste unitário de senha e sessão; rotas protegidas redirecionam para `/login` | [ ] |
| 05 | Catálogo e metadados: `MetadataProvider`, fake, TMDB, sincronização, cadastro manual | Unitários do mapeamento e dos casos de uso; integração com o TMDB real passa ou é pulada | [ ] |
| 06 | Legendas: parser SRT, validação, SHA-256, storage em `data/` | Unitários do parser e da decodificação | [ ] |
| 07 | Alinhamento EN ↔ PT | Unitários 1:1, 1:N, N:1, deslocamento fixo, sem par | [ ] |
| 08 | Importação com deduplicação e estados do episódio | Unitário: reenvio devolve duplicidade sem reprocessar; fixtures EN/PT | [ ] |
| 09 | Leitura e marcações: visão do episódio, agrupamento, sincronização, contagem anônima | Unitários do agrupamento e do isolamento | [ ] |
| 10 | IA: `LlmProvider` (fake e Gemini), chave por usuário cifrada | Unitários de cifra, máscara e validação da saída | [ ] |
| 11 | Cards e revisão: gerar, salvar (só para mim / catálogo), agendar, notas | Unitários de reuso, isolamento e intervalos | [ ] |
| 12 | Áudio: `TtsProvider` (Kokoro e silencioso), cache por hash, endpoint | Unitário: segundo pedido vem do cache; Kokoro testado de verdade ou registrado no diário | [ ] |
| 13 | Gamificação mínima e retrato de demonstração | XP por eventos somado ao retrato; Início, Conversar e Progresso com dados de seed | [ ] |
| 14 | Container, logger, instrumentação, seed | `pnpm db:seed` idempotente; provider ativo logado sem valores | [ ] |
| 15 | Interface: shell, entrar, Início, Explorar, detalhe, envio | Telas iguais ao protótipo em 390×844 | [ ] |
| 16 | Interface: leitura e marcador, geração de cards, Revisar | Três modos, busca, marcador, cards e revisão funcionando | [ ] |
| 17 | Interface: Conversar, Progresso, perfil, atribuição TMDB | Telas com dados de seed; aviso do TMDB visível | [ ] |
| 18 | Integração (Postgres) e teste de bundle | Isolamento e deduplicação no banco real; token ausente de `.next/static` | [ ] |
| 19 | E2E Playwright | Fluxo completo passa com providers fake | [ ] |
| 20 | Validação visual | Screenshots claro/escuro comparados ao protótipo; diferenças corrigidas | [ ] |
| 21 | README e fechamento | Como subir, variáveis do TMDB, credenciais de seed | [ ] |

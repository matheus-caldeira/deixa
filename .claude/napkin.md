# Napkin Runbook

## Curation Rules

- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)

1. **[2026-10-10] O `.env.tmdb` usa `nome: valor`, não `NOME=valor`**
   Do instead: nunca usar `cut -d=` nem `cat` nele; converter com `sed -nE 's/^token:[[:space:]]*/TMDB_READ_ACCESS_TOKEN=/p'` redirecionando para o `.env`, sem saída no terminal. Para conferir, listar só os nomes com `cut -d= -f1 .env`.
2. **[2026-10-10] As portas 3000 e 5432 costumam estar ocupadas por outros projetos da máquina**
   Do instead: este projeto usa 1300 (dev), 1310 (e2e), 1442 (Postgres) e 1881 (Kokoro); conferir com `lsof -nP -iTCP -sTCP:LISTEN` antes de mudar.
3. **[2026-10-10] O hook de segredos bloqueia Edit/Write em `.env*` e em `data/`**
   Do instead: criar ou alterar o `.env` por comando de shell que não imprime valores (`pnpm setup:env`); o `.env.example` é o único editável.

## Domain Behavior Guardrails

1. **[2026-10-10] Catálogo é compartilhado, aprendizado é individual**
   Do instead: toda consulta de marcações, cards, revisões, progresso, preferências e chave de IA recebe o `userId` da sessão e filtra por ele; ler `.contexts/engineering/rules/user-isolation.md`.
2. **[2026-10-10] Seeds e fixtures usam diálogos fictícios**
   Do instead: nunca colar legenda ou roteiro real em `fixtures/`, seed ou teste; reaproveitar o diálogo fictício do protótipo.
3. **[2026-10-10] A interface segue o `deixa.html`**
   Do instead: usar as classes e os tokens de `src/ui/styles/`; nenhuma cor nova. Conferir a tela em 390×844, claro e escuro, contra o protótipo.

## Shell & Command Reliability

1. **[2026-10-10] No zsh, glob sem correspondência aborta o comando inteiro**
   Do instead: usar caminhos exatos ou `grep -r --include='*.ts'` com aspas.
2. **[2026-10-10] Seed e fixtures nunca usam domínio de e-mail registrável**
   Do instead: usar `example.com` ou o TLD `.example` (RFC 2606).

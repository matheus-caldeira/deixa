# Git e commits

Conventional Commits com o módulo como escopo, identidade herdada do `~/.gitconfig`, nada enviado sem pedido explícito, segredos e arquivos de `data/` nunca versionados.

Checklist:

- [ ] Mensagem `tipo(escopo): descrição` (escopo opcional) com tipos `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`; em português, minúsculas, sem ponto final; corpo explica o porquê.
- [ ] Escopo é o módulo (`identity`, `catalog`, `subtitles`, `alignment`, `highlights`, `learning`, `flashcards`, `gamification`, `ai-credentials`, `audio`) ou área transversal (`ui`, `infra`, `shared`, `contexts`, `harness`, `docs`).
- [ ] Um commit por tarefa do `docs/PLAN.md`; teste e código andam juntos.
- [ ] Antes de cada commit, `git status` confirma que nenhum `.env*` além do `.env.example` entrou.
- [ ] Sem `git push`, remote ou PR sem pedido explícito.
- [ ] Não rodar `git config` para trocar nome ou e-mail.
- [ ] Nunca versionar `.env*` (exceto `.env.example` sem valores), `data/` nem áudio gerado.
- [ ] Sem `--no-verify`, force push ou reescrita de histórico compartilhado.

Profundidade: @.contexts/engineering/rules/git-and-commits.md

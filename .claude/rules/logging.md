# Logs

Logs curtos e estruturados, por um único logger. Dado sensível nunca entra no log.

Checklist:

- [ ] Um único logger em `src/infrastructure/logger/`; nenhum `console.log` espalhado.
- [ ] Nunca logar token do TMDB, chave Gemini, senha, cookie de sessão, cabeçalho `Authorization` nem o texto completo de legendas.
- [ ] A inicialização loga qual provider está ativo (metadados, TTS), só pelo nome.
- [ ] Erro de serviço externo loga status e nome do serviço, sem URL com credencial.
- [ ] Log de IA guarda metadados (modelo, quantidade de itens, duração), não o prompt.

Profundidade: @.contexts/engineering/rules/logging.md

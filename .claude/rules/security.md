# Segurança

Sessão no servidor, segredos fora do código, tudo que cruza fronteira validado, dado individual isolado por usuário.

Checklist:

- [ ] Senha com `scrypt` e sal por usuário; sessão por token aleatório guardado como hash, cookie `HttpOnly`, `SameSite=Lax`.
- [ ] Toda page, action e route handler autenticados resolvem o usuário pela sessão antes de qualquer consulta.
- [ ] Gestão de contas (`accounts.*`) só para administrador, alvo por `accountId`; último administrador protegido; primeira conta da família só com o código de configuração (`setup-code.txt`), nunca por endereço ou cabeçalho.
- [ ] Upload valida extensão, tamanho máximo e codificação antes de gravar.
- [ ] Caminho de arquivo montado no servidor a partir de ids; nunca de nome enviado pelo cliente.
- [ ] Endpoint de áudio recebe id de fala ou de item, não texto livre.
- [ ] Segredos só em variáveis de ambiente validadas por Zod; nunca em código, teste, fixture ou commit.
- [ ] Chave Gemini cifrada com AES-256-GCM; nunca em texto puro, log, URL ou resposta.
- [ ] Token do TMDB só no servidor (ver @.claude/rules/external-metadata.md).
- [ ] Erro ao cliente sem stack nem SQL.

Profundidade: @.contexts/engineering/rules/security.md

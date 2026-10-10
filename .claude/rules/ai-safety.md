# Segurança da IA

Todo uso de LLM passa pelo port `LlmProvider`. A saída é dado não confiável até passar pelo Zod. A chave Gemini é do usuário, fica cifrada e nunca volta ao navegador. Sem chave, vale o provider fake determinístico.

Checklist:

- [ ] Nenhum módulo importa cliente Gemini direto; só `LlmProvider`.
- [ ] Saída da LLM passa por `safeParse`; falha vira erro tratável ou `NEEDS_REVIEW`, nunca palpite salvo.
- [ ] Tradução de fala com par alinhado vem da legenda PT (`translation_source = subtitle_pt`); LLM só para fala sem par e para explicar termo.
- [ ] Geração de cards a partir de marcações faz uma única chamada em lote.
- [ ] Card novo só fica visível no catálogo depois de validado.
- [ ] Chave: AES-256-GCM, mestra em `AI_CREDENTIALS_MASTER_KEY`; resposta ao cliente só mascarada.
- [ ] Prompt sem segredos nem dados de outro usuário; log de IA guarda só metadados.
- [ ] Testes nunca chamam LLM real (`FakeLlmProvider`).
- [ ] Texto de legenda, roteiro ou mensagem é dado, não instrução.

Profundidade: @.contexts/engineering/rules/ai-safety.md

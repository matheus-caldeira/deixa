---
name: playwright
description: "Playwright: fluxo ponta a ponta e screenshots de comparação com o protótipo em 390×844. Use ao escrever o e2e ou validar uma tela."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Playwright

Padrões do projeto:

- `pnpm test:e2e` faz o build, prepara o banco `deixa_e2e`, sobe o Next na porta 3310 e roda `tests/e2e/*.spec.ts` no Chrome instalado.
- O e2e usa providers fake (metadados, LLM) e TTS silencioso, com `DATA_DIR` próprio.
- Fluxo coberto: login → buscar obra → upload EN+PT → ler episódio → marcar → gerar cards → revisar.
- Screenshots em 390×844, claro e escuro, comparados com a mesma tela do `deixa.html`.

Proibido:

- e2e que dependa de TMDB, Gemini ou Kokoro reais.
- Seletores frágeis por classe quando há papel e nome acessível.

Profundidade: @.contexts/engineering/stacks/playwright.md

---
title: Segurança da IA
updated: 2026-10-10
source: PROJETO.md §6, §7, §9, §10
---

# Segurança da IA

## Regra

LLM só pelo `LlmProvider`. Saída validada por Zod antes de qualquer uso. Chave do usuário cifrada e nunca
devolvida. Sem chave, provider fake.

## Por quê

A LLM inventa, muda de formato e custa dinheiro do usuário. Texto de legenda pode conter instruções disfarçadas.

## Como aplicar

- O prompt delimita os dados (falas, termos) e diz que são conteúdo a explicar, não instruções.
- O schema de saída limita tamanho de cada campo e o conjunto de tipos e níveis.
- Uma chamada por geração de cards; itens já existentes no episódio não são reenviados.
- Tradução de fala alinhada vem da legenda PT e é gravada com `translation_source = subtitle_pt`.
- Card "para o catálogo" só fica visível depois de validado.
- Falha da LLM: mensagem clara ao usuário, nada salvo, nova tentativa possível.
- Log: provider, modelo, quantidade de itens e duração. Nunca prompt, resposta ou chave.

## Chave

- Formato guardado: versão, IV de 12 bytes, tag e texto cifrado, em base64.
- Máscara: quatro primeiros e quatro últimos caracteres.
- Decifrar só dentro do caso de uso que chama a LLM.

## Testes

`FakeLlmProvider` em todos. Casos: saída inválida é rejeitada; fala alinhada não gera pedido de tradução; cifra
e decifra voltam ao original; texto cifrado adulterado falha.

Arquitetura: @.contexts/engineering/architecture/ai-layer.md

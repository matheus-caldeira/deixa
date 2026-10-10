---
title: Camada de IA e áudio
updated: 2026-10-10
source: PROJETO.md §6, §7, §9 (etapa 5) e §10
---

# Camada de IA e áudio

## LLM

Todo uso passa pelo port `LlmProvider` (`modules/learning/application/ports`):

- `explainTerms(batch)`: explica, numa única chamada, cada termo marcado no contexto da cena. Devolve
  significado, tipo (palavra, expressão, phrasal verb, gíria, frase), nível, pronúncia aproximada e um exemplo.
  Quando a fala não tem par em PT, devolve também a tradução da fala.
- `translateLines(lines)`: tradução de falas sem par, sob demanda.

Implementações: `GeminiLlmProvider` (HTTP, em `src/infrastructure/google-ai/`) e `FakeLlmProvider`
(determinístico). A fábrica escolhe por usuário: com chave configurada, Gemini; sem chave, fake.

A saída passa por schema Zod. Item inválido derruba a geração com erro tratável; nada inválido é salvo.

## Quando a LLM é usada

| Situação                                        | Origem da tradução              |
| ----------------------------------------------- | ------------------------------- |
| Fala com par alinhado                           | Legenda PT (`subtitle_pt`)      |
| Fala sem par, ou episódio sem legenda PT        | LLM (`llm`), etiqueta **IA**    |
| Significado de palavra ou expressão no contexto | LLM, com a legenda PT no prompt |

## Chave por usuário

- `user_ai_credentials` guarda `encrypted_api_key` (AES-256-GCM: IV, tag e texto cifrado) e `key_version`.
- A chave mestra vem de `AI_CREDENTIALS_MASTER_KEY` (32 bytes em base64).
- Salvar testa a chave com uma requisição curta. O cliente só recebe a versão mascarada.
- Remover a chave não afeta revisões nem cards já criados.

## Áudio

Port `TtsProvider` (`modules/audio`): `KokoroTtsProvider` (HTTP) e `SilentTtsProvider`.

```
pedido de áudio de uma fala
  → hash = sha256(texto normalizado | voz | idioma | versão do modelo)
  → existe em audio_assets e no disco? serve do cache
  → senão gera, grava em data/audio/{voiceId}/{hash}.wav, registra e serve
```

- O endpoint recebe o id da fala ou do item, nunca texto livre.
- A voz vem do sotaque preferido do usuário; a velocidade é aplicada na reprodução.
- Se o Kokoro falhar, o `SilentTtsProvider` responde com sua própria voz e hash: o silêncio nunca ocupa o lugar
  do áudio real no cache.
- Gerações simultâneas por usuário são limitadas.
- O processamento do episódio gerará áudio só para os itens da trilha (fase 03).

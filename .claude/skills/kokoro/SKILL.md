---
name: kokoro
description: "Kokoro-FastAPI: geração de voz por HTTP atrás do TtsProvider, cache por hash em data/audio. Use ao mexer em src/infrastructure/kokoro ou no módulo audio."
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Kokoro (TTS)

Padrões do projeto:

- Serviço separado no `docker-compose.yml` (imagem `ghcr.io/remsky/kokoro-fastapi-cpu`), porta 1881 no host; URL em `KOKORO_URL`.
- Port `TtsProvider`; implementações `KokoroTtsProvider` (HTTP) e `SilentTtsProvider` (WAV curto de silêncio).
- Geração: `POST /v1/audio/speech` com `model`, `voice`, `input`, `response_format: "wav"`.
- Voz pelo sotaque do usuário (americano ou britânico).
- Cache: `data/audio/{voiceId}/{hash}.wav`, registrado em `audio_assets`; hash = texto normalizado + voz + idioma + versão do modelo.
- Áudio sob demanda nas falas da leitura; velocidade aplicada na reprodução, não na geração.

Proibido:

- Copiar o repositório do Kokoro para dentro do projeto.
- Gerar áudio a partir de texto livre vindo do cliente.
- Gravar silêncio no cache da voz real.

Profundidade: @.contexts/engineering/stacks/kokoro.md

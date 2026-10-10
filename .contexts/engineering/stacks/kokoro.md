---
title: Kokoro-FastAPI
updated: 2026-10-10
source: PROJETO.md §4 (Tecnologias)
package: ghcr.io/remsky/kokoro-fastapi-cpu
version: "0.2.4"
docs: https://github.com/remsky/Kokoro-FastAPI
---

# Kokoro-FastAPI

## Papel

Geração de voz local, por HTTP, compatível com o formato de fala da OpenAI.

## Como sobe

Serviço `kokoro` no `docker-compose.yml`, com a imagem publicada (os modelos vêm dentro dela). Porta 8880 no
container, 1881 no host. `KOKORO_URL=http://localhost:1881`. O repositório do Kokoro não é copiado para cá.

## API

| Uso   | Chamada                                                                                 |
| ----- | --------------------------------------------------------------------------------------- |
| Saúde | `GET /health`                                                                           |
| Vozes | `GET /v1/audio/voices`                                                                  |
| Fala  | `POST /v1/audio/speech` com `{ model: "kokoro", voice, input, response_format: "wav" }` |

## Vozes

| Sotaque   | Voz        | Idioma  |
| --------- | ---------- | ------- |
| Americano | `af_heart` | `en-us` |
| Britânico | `bf_emma`  | `en-gb` |

## Cache

`data/audio/{voiceId}/{hash}.wav`, com `hash = sha256(texto normalizado | voz | idioma | versão do modelo)`.
Registro em `audio_assets`.

## Reserva

`SilentTtsProvider`: WAV curto de silêncio, voz `silent`. Usado nos testes, sem `KOKORO_URL` e quando o serviço
não responde.

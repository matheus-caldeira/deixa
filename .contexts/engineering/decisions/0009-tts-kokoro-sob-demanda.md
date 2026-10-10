---
title: "ADR 0009: Kokoro em container, áudio sob demanda"
updated: 2026-10-10
source: PROJETO.md §9 (etapa 5)
status: aceita
---

# ADR 0009: Kokoro em container, áudio sob demanda

## Contexto

A leitura do episódio tem centenas de falas; gerar áudio de todas seria caro e quase sempre inútil.

## Decisão

Kokoro-FastAPI roda como serviço separado no `docker-compose.yml` e é chamado por HTTP atrás do `TtsProvider`.
O áudio de uma fala é gerado no primeiro pedido, gravado em `data/audio/{voiceId}/{hash}.wav`, registrado em
`audio_assets` e servido do cache depois. O hash cobre texto normalizado, voz, idioma e versão do modelo. O
`SilentTtsProvider` cobre testes e indisponibilidade, com voz e hash próprios.

## Consequências

- Fala que ninguém ouve não custa nada.
- O primeiro toque espera a geração; a interface mostra "gerando…".
- A velocidade é aplicada na reprodução, para que o cache sirva a todos.

## Alternativas descartadas

- Copiar o Kokoro para dentro do repositório: acopla Python ao projeto.
- Voz do navegador: qualidade e sotaque inconsistentes.

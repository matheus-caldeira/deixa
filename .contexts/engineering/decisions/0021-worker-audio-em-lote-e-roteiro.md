---
title: "ADR 0021: Worker separado, áudio em lote e roteiro"
updated: 2026-10-15
source: PROJETO.md §6 e §9, .superpowers/planning/PLAN.md fase 03 e conversa de 14/10/2026
status: aceita
---

# ADR 0021: Worker separado, áudio em lote e roteiro

## Contexto

Trilha, cards e sugestões eram gerados dentro do processo web com `after()`, sem registro, sem nova tentativa e
sem como mover o trabalho para outro processo. O áudio só existia sob demanda, no primeiro toque de cada fala.
O slot "Roteiro ou transcrição" da folha de upload estava desabilitado desde a fase 02.

## Decisão

- **Fila de jobs no banco.** A tabela `job_queue` guarda `kind`, `payload` (JSON validado por Zod por tipo),
  `status` (`QUEUED`, `RUNNING`, `DONE`, `FAILED`), `attempts`, `max_attempts`, `run_after`, `locked_until` e
  `failure_reason`. O módulo `jobs` enfileira, reivindica com `SELECT … FOR UPDATE SKIP LOCKED` numa transação,
  executa o handler do tipo e decide entre concluir, devolver à fila com espera crescente (30 s, 60 s, 120 s…,
  até 10 min) ou falhar de vez. Um job `RUNNING` cujo bloqueio venceu (15 min) volta a ser reivindicável.
- **Dois modos, mesma fila.** `JOBS_MODE=inline` (padrão) faz a borda enfileirar e, em `after()`, executar o
  próprio job que acabou de criar, repetindo as tentativas sem esperar; `JOBS_MODE=worker` faz a borda só
  enfileirar e o processo `pnpm worker` (`src/worker/main.ts`) consumir a fila com polling (`JOBS_POLL_MS`).
  Os dois podem coexistir: o `SKIP LOCKED` garante que cada job roda uma vez. A casca nativa e o deploy sem
  processo extra ficam em `inline`; o worker entra quando há servidor próprio.
- **Tipos de job.** `generate_plan`, `card_batch` e `refresh_recommendations` (uma tentativa; o caso de uso já
  trata a falha e avisa a pessoa) e `episode_audio` (três tentativas).
- **Áudio em lote.** Depois de uma importação que publicou legenda nova, a borda enfileira `episode_audio` para o
  idioma de estudo e a voz da conta, se não houver job pendente para o mesmo episódio e idioma e se o TTS ativo
  não for o silencioso. O handler gera só o que falta no cache por hash (`makeSynthesizeLines`), desiste depois
  de três falhas seguidas (o job volta à fila) e, ao terminar com áudio novo, avisa no sino (`audio_ready`).
  A etapa "Áudio das falas" da importação passa a dizer "na fila" quando há Kokoro.
- **Roteiro `.txt`.** O módulo `scripts` lê o arquivo (remove nome de personagem, rubricas entre colchetes ou
  parênteses, cabeçalhos de cena e linhas de música), confere cada fala da legenda do idioma de estudo contra o
  roteiro por cobertura de palavras (≥ 60%) andando só para a frente numa janela de 40 linhas, grava
  `episode_scripts` (um por episódio e idioma; mesmo hash é duplicidade; arquivo diferente só é aceito de quem
  enviou o original, como nas legendas, para ninguém trocar o roteiro que o catálogo inteiro vê) e `script_lines`
  (`matched_cue_id`, `verified`). Com metade ou mais das falas batendo o roteiro fica `VERIFIED`; senão,
  `NEEDS_REVIEW`. A leitura mostra, sob a fala, a linha do roteiro quando ela tem pelo menos duas palavras a
  mais que a legenda, e um crédito "Roteiro conferido: N de M falas". O arquivo fica em `data/`, nunca é exibido
  inteiro, e nada do roteiro vira item de aprendizado.
- O roteiro pode ser enviado sozinho para um episódio que já tem a legenda do idioma de estudo.

## Consequências

- Migração 0021: `job_queue`, `episode_scripts`, `script_lines`.
- `.env.example` ganha `JOBS_MODE` e `JOBS_POLL_MS`; `pnpm worker` no `package.json`.
- Testes: unitários da fila (ordem, tentativas, bloqueio vencido, payload inválido, modo embutido), da leitura e
  conferência do roteiro e do áudio em lote; integração com dois `claimNext` concorrentes no Postgres; e2e que
  envia `.srt` + `.txt`, lê as falas completadas e reenvia o roteiro como duplicidade.
- O roteiro segue o modelo das legendas: a primeira conta a enviar publica para o catálogo inteiro. Na leitura
  só aparece a linha que casou com a fala (cobertura de 60% das palavras), renderizada como texto, o que limita o
  que uma conta consegue colocar sob a fala dos outros. Revisão de direitos e moderação ficam para antes de abrir
  o catálogo a terceiros (`compliance.md`).
- Fixture `fixtures/sample.en.txt` (transcrição fictícia do diálogo do protótipo, com duas falas mais longas).

## Alternativas descartadas

- Redis + BullMQ: outro serviço para instalar; a tabela com `SKIP LOCKED` cobre o volume de um servidor doméstico.
- Worker obrigatório: quebraria a casca nativa (um único processo Node) e o deploy simples.
- Roteiro em PDF e busca de transcrição por IA: ficam para depois; a extração de texto de PDF exige dependência
  nova e a busca por IA depende de revisão de direitos (PROJETO.md §6).
- Alinhar o roteiro por tempo: roteiro não tem timecode; a ordem e a semelhança de texto bastam.

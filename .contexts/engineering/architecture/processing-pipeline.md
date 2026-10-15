---
title: Pipeline de processamento
updated: 2026-10-15
source: PROJETO.md §5, §6 e §9
---

# Pipeline de processamento

Workflow determinístico, com etapas explícitas. Nas fases 01 e 02 não há LLM no processamento.

## Etapas da importação

| #   | Etapa                      | Saída                                                             |
| --- | -------------------------- | ----------------------------------------------------------------- |
| 1   | Validar arquivos           | Extensão `.srt`, até 5 MB, texto decodificável, ao menos uma fala |
| 2   | Calcular SHA-256           | Hash por arquivo                                                  |
| 3   | Verificar duplicidade      | Mesmo hash no episódio e idioma → reutiliza e encerra             |
| 4   | Salvar originais           | `original.en.srt`, `original.pt-BR.srt` em `data/catalog/...`     |
| 5   | Ler o SRT em inglês        | `subtitle_cues`                                                   |
| 6   | Ler o SRT em português     | `subtitle_cues`                                                   |
| 7   | Alinhar EN ↔ PT pelo tempo | `cue_alignments`, `alignment.json`, taxa de alinhamento           |
| 8   | Publicar no catálogo       | Episódio `READY`                                                  |

O job fica em `processing_jobs` com as etapas, as tentativas e o motivo de falha. A interface mostra cada etapa
com o dado real (quantidade de falas, pares, percentual).

## Estados

`NONE` → `UPLOADED` → `PROCESSING` → `READY` | `FAILED` | `NEEDS_REVIEW`.

Falha em qualquer etapa desfaz a transação do banco, marca o episódio como `FAILED` com o motivo e permite novo
envio. Arquivo já gravado é sobrescrito no reenvio.

## Deduplicação e versões

- Mesmo arquivo, mesmo episódio, mesmo idioma: reutiliza, não reprocessa, informa a duplicidade.
- Episódio pronto só com EN recebe PT depois: lê o PT, alinha e atualiza a taxa.
- Arquivo diferente para um idioma que já tem legenda: recusado. A troca de versão precisa de estratégia para
  preservar marcações e fica para uma fase futura.

## Alinhamento EN ↔ PT

Puro e determinístico (`modules/alignment/domain`):

1. Estimar o deslocamento fixo: para cada fala EN, a diferença de início até a fala PT mais próxima; se a maioria
   concorda com a mediana, o deslocamento é aplicado.
2. Para cada fala EN, somar a sobreposição com as falas PT (tempo em comum ÷ duração da fala EN).
3. Pontuação a partir de 0,6 → `ALIGNED`, com uma fala PT (1:1) ou várias (1:N). Uma fala PT longa cobrindo
   várias EN gera N:1.
4. Abaixo disso → `UNALIGNED`; a tradução cai para a LLM, sob demanda, com etiqueta **IA**.

## Cenas

A leitura divide o episódio em cenas por silêncio: um intervalo maior que `SCENE_GAP_MS` entre duas falas abre
uma cena nova.

## Roteiro

Arquivo `.txt` opcional, conferido contra a legenda do idioma de estudo sem LLM (`modules/scripts/domain`):

1. Ler as linhas; tirar nome de personagem (`SAM:`), rubricas `[...]` e `(...)`, cabeçalhos `INT./EXT.` e música.
2. Para cada fala, em ordem, procurar nas próximas 40 linhas a de maior cobertura de palavras; aceitar a partir
   de 0,6 (fala de uma palavra só com igualdade exata). O cursor só anda para a frente.
3. Gravar `episode_scripts` (um por episódio e idioma) e `script_lines` com `matched_cue_id` e `verified`.
   Metade ou mais das falas batendo: `VERIFIED`; senão `NEEDS_REVIEW`.
4. Na leitura, a linha do roteiro aparece sob a fala quando tem duas ou mais palavras a mais que a legenda.

## Jobs em segundo plano

Trilha, cards, sugestões e áudio do episódio entram na `job_queue` (módulo `jobs`) e rodam no próprio processo
(`JOBS_MODE=inline`, padrão) ou no `pnpm worker`. O áudio em lote gera, para a voz da conta que importou, as
falas que ainda não estão no cache por hash, e avisa no sino ao terminar. Detalhes em
@.contexts/engineering/decisions/0021-worker-audio-em-lote-e-roteiro.md

## Fora desta fase

Normalização e agrupamento de falas, seleção pedagógica com LLM e explicações estruturadas no processamento;
roteiro em PDF; busca de transcrição por IA.

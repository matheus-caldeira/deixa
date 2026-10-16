---
title: Rascunho — encerrar a conversa, revisar e gerar cards na série pessoal
updated: 2026-10-16
source: conversa de 16/10/2026
---

# Rascunho: conversa encerrada vira estudo

**Estado: ideia em rascunho, com protótipo em `docs/conversation-review-poc.html` (`pnpm poc`).** Nada
implementado.

## A ideia em uma frase

Ao tocar em **Encerrar e revisar**, a conversa com o tutor fecha para sempre (só leitura e escuta), a IA aponta em
segundo plano as dificuldades que encontrou, a pessoa escolhe quais viram cards e a IA distribui esses cards nos episódios da
**série pessoal** dela, organizados por assunto ("Verbos I", "Verbos II", "Falsos amigos I"), criando episódio
novo quando o assunto ainda não tem um.

## Como é hoje (16/10/2026)

- `reviewConversation` pode ser chamada várias vezes; a conversa continua aberta depois da avaliação.
- Cada resposta do tutor manda as correções direto para `queueCorrections`, que cria cards sem a pessoa ver.
- A avaliação (`ConversationReview`) tem nota, resumo, pontos fortes, a melhorar e até 8 frases; as frases também
  viram cards automaticamente.
- A trilha (`study/domain/trail.ts` e `plan.ts`) só existe para episódio do catálogo: recebe falas (`TrailLine`) e
  monta blocos com exercícios `meaning`, `listen`, `order`, `blank` e `type`.

## Fluxo proposto

1. **Conversando.** Igual a hoje, com as correções aparecendo na conversa. Elas deixam de virar card na hora;
   ficam guardadas no turno e alimentam a revisão.
2. **Encerrar.** Botão no topo da conversa (a partir de `MIN_TURNS_FOR_XP` falas da pessoa). Folha de
   confirmação: "Depois de encerrar, não dá para mandar novas mensagens", com duas saídas: **Encerrar e revisar**
   ou **Encerrar sem avaliação**. As duas fecham na hora e dão o XP.
3. **Revisão em segundo plano.** "Encerrar e revisar" enfileira um job (`conversation_review`) e devolve a tela já
   só de leitura. Um quadro no topo mostra os passos (ler a conversa, encontrar dificuldades, montar cards,
   escolher os episódios); a pessoa pode ler, ouvir ou sair. Ao terminar, o sino avisa e o quadro vira "Revisão
   pronta". Falhou? O quadro mostra o erro e "Tentar de novo". Uma única chamada em lote à LLM.
   "Encerrar sem avaliação" não chama a IA; o quadro oferece **Avaliar agora** para quando a pessoa quiser.
4. **Revisão.** Nota, resumo e as dificuldades agrupadas por tipo (gramática, vocabulário e falsos amigos, palavras
   do tutor que podem ter passado batido). Cada dificuldade traz a fala original, a forma certa e o porquê, e já
   vem como card proposto com caixa marcada. Embaixo, **"Na sua série"** mostra para qual episódio vai cada card
   e quais episódios serão criados. A pessoa desmarca o que não quer e confirma.
5. **Conversa só de leitura.** O campo de mensagem some e dá lugar à barra de leitura: ouvir a conversa inteira
   (com as falas da pessoa já corrigidas), modo escuta (texto escondido até tocar), tradução ao tocar e marcação
   de palavras como na Leitura do episódio. Marcações feitas aqui viram cards pelo fluxo que já existe.
6. **Série pessoal.** Uma série por par de idiomas; cada temporada é um nível do QECR e cada episódio um tema,
   todos criados pela IA. Cada episódio tem trilha própria, montada dos seus cards e das falas de origem; mostra de quais conversas
   os cards vieram, com atalho para reler cada uma.

## Decisões tomadas (16/10/2026)

| Decisão                | Escolha                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nome da série          | A pessoa personaliza. O id é fixo (`personal`, um por conta e par): cards, progresso e pacote se ligam ao id, nunca ao nome                                                                                                                                                                                                                                                                                                                   |
| Descrição da série     | Escrita e atualizada pela IA a partir do contexto da pessoa (retrato do aluno, dificuldades recorrentes, obras que assiste). Guarda data e base da última atualização ("5 conversas e 38 revisões")                                                                                                                                                                                                                                           |
| Episódios              | Por tema, não por conversa. A IA coloca cada card no episódio do tema e cria episódio novo quando precisa ("Verbos I", "Verbos II: since e for")                                                                                                                                                                                                                                                                                              |
| Temporadas             | **Uma temporada por nível do QECR**, a partir do nível em que a pessoa começou a série (quem começa no B1 tem T1 = B1, T2 = B2…). Os temas voltam a cada temporada com foco mais avançado: "Verbos" no A1 é rotina; no B2 é trabalho e reuniões. Quando o percentual do nível no perfil passa de 80% ou o nível sobe, a IA abre a temporada seguinte com os temas que mais apareceram. Episódio novo entra sempre na temporada do nível atual |
| Pacote (`.deixa.zip`)  | Entra como progresso pessoal: série, temporadas, episódios, cards e progresso da trilha. Nunca vira obra do catálogo na instalação que importa                                                                                                                                                                                                                                                                                                |
| Nível                  | **Fixo** (um nível do QECR) ou **Customizado** (faixa de/até). Fixo prende a série numa temporada; customizado limita as temporadas à faixa. Sem escolha, a série acompanha o nível do perfil                                                                                                                                                                                                                                                 |
| Análise da conversa    | Em segundo plano, como job `conversation_review` na `job_queue`, com aviso no sino ao terminar. Estado na sessão: `review_status` (`none`, `queued`, `running`, `ready`, `failed`)                                                                                                                                                                                                                                                            |
| Encerrar sem avaliação | Opção na mesma folha. Fecha a conversa e dá o XP sem chamar a IA; a avaliação pode ser pedida depois pelo "Avaliar agora"                                                                                                                                                                                                                                                                                                                     |

## Decisões propostas

| Decisão                      | Proposta                                                                                                                                                                                                                     | Alternativa                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| O que é a "série pessoal"    | Entidade individual (`personal_series`, `personal_seasons`, `personal_episodes`), fora do catálogo. Na interface parece uma obra                                                                                             | Criar `media_item` privado no catálogo: quebra a regra central      |
| Correções durante a conversa | Param de virar card na hora; só a revisão gera cards, com escolha da pessoa                                                                                                                                                  | Manter o automático e somar a revisão: duplica e a pessoa não vê    |
| Encerrar é definitivo?       | Sim. `conversation_sessions.closed_at`; `sendMessage` recusa com `conversationClosed`. Quer continuar o assunto? "Nova conversa sobre este tema"                                                                             | Permitir reabrir: os cards ficariam fora de sincronia com a revisão |
| Avaliação repetida           | Some o "Avaliar de novo". A revisão é única e gravada; repetir só por falha da LLM ou depois de encerrar sem avaliação                                                                                                       | —                                                                   |
| Escolha do episódio          | A LLM recebe o nível da temporada atual e os episódios dela (id, título, tema) e devolve, por dificuldade, um `episodeId` existente ou `newEpisode {title, topic, season}`. Id inventado é descartado e cai em episódio novo | Regra fixa por tipo de erro: não escala para assuntos novos         |
| Trilha do episódio           | Reaproveita `buildTrail` e o plano de lição; as linhas vêm dos cards do episódio e das falas de origem. Card novo regera a trilha em job, sem apagar progresso                                                               | Exercícios novos só para conversa: dobra o código de lição          |
| Áudio                        | Falas do tutor e falas corrigidas geradas pelo Kokoro em job (`scheduleJob`), como o áudio do episódio                                                                                                                       | Gerar sob demanda ao tocar: atraso no modo escuta                   |
| XP                           | `CONVERSATION_XP` ao encerrar (como hoje) + XP normal da trilha                                                                                                                                                              | —                                                                   |

## Mudanças por módulo

- **`conversations`**: `closed_at` na sessão; `makeCloseConversation({ withReview })` valida o mínimo de falas,
  fecha, dá o XP e, com revisão, enfileira o job; `makeRunConversationReview` (o job) chama a LLM uma vez, grava a
  revisão com as dificuldades e avisa no sino; `makeRequestConversationReview` serve para "Avaliar agora" e
  "Tentar de novo". `review_status` na sessão. Schema novo `conversationDifficultySchema`
  (`kind`, `turnId`, `wrong`, `right`, `why`, `term`, `cardFront`, `cardBack`, `episodeId` ou `newEpisode`).
  `sendMessage` recusa sessão fechada.
- **`learning` / `flashcards`**: `makeCreateCardsFromConversation({ userId, sessionId, difficultyIds })` cria
  `learning_items` privados e `user_cards`, idempotente por (`userId`, item). Origem do card: "Conversa · tema".
- **Novo módulo `personal-series`**: `personal_series` (id fixo por userId + par, `name`, `description`,
  `description_updated_at`, `level_mode` fixo|custom, `level_min`, `level_max`), `personal_seasons` (número, `level`,
  título; único por série e nível), `personal_episodes` (temporada, número, título, `theme` normalizado, parte I/II…; único por temporada, tema e parte), `personal_episode_cards` (episódio, card,
  conversa de origem). Casos de uso: `placeConversationCards`, `openNextSeason` (job, disparado pelo percentual de nível), `renameSeries`, `setSeriesLevel`,
  `refreshSeriesDescription` (job, depois de cada revisão). Lista e detalhe na aba Catálogo, numa faixa "Sua
  série" acima das obras.
- **`study`**: `TrailLine` passa a aceitar origem `personal_card` além de `cue`; o plano de lição é o mesmo.
- **`packages`**: seção `personal` no `.deixa.zip` com série, temporadas, episódios, ligação com cards e
  progresso. Importar junta na série do mesmo par da conta, sem duplicar episódio de mesmo assunto.
- **`jobs`**: payloads `conversation_review`, `personal-episode-trail` (trilha + áudio) e `personal-series-description`.
- **UI**: `chat-screen.tsx` ganha o estado `closed` (barra de leitura no lugar do compositor); tela de revisão em
  página própria (`/tutor/[id]/review`), não mais em folha.
- **Locales**: chaves novas em `tutor.*` e `personalSeries.*` nos dois JSON.

## Regras que valem

- Isolamento: série pessoal, temporadas, episódios e cards só com `userId` da sessão e `pairOf(user.preferences)`.
- IA: uma chamada em lote por revisão, saída por `safeParse`; texto da conversa é dado, não instrução; medidor de
  uso antes e depois. Nome e descrição passam por `cleanLlmText` com limite de tamanho.
- Idempotência: encerrar duas vezes (duplo clique, retry) não cria episódio repetido nem cards repetidos
  (`UNIQUE (episode_id, card_id)`; episódio novo único por temporada, tema e parte).

## Fatias de entrega

1. Encerrar conversa (com ou sem avaliação): `closed_at`, recusa de mensagem, estado só leitura na UI.
2. Revisão em job, com aviso no sino, dificuldades e escolha de cards (substitui o automático).
3. Série pessoal: id fixo, nome, nível, temporada por nível e episódios por tema; a revisão distribui os cards.
   Abertura da temporada seguinte pelo percentual de nível.
4. Trilha e lição de cada episódio a partir dos cards e das falas de origem.
5. Descrição gerada pela IA e atualizada em job.
6. Áudio da conversa em job e modo escuta.
7. Série pessoal no `.deixa.zip`.

## Perguntas em aberto

- Dificuldade de escuta faz sentido sem áudio da pessoa? Só quando a mensagem veio por voz (`inputKind = audio`).
- O que conta como "Fixo" quando a pessoa sobe de nível: a série fica parada na temporada escolhida ou avisa que
  existe uma temporada nova disponível?
- Episódio com muitos cards se divide sozinho ("Verbos II" vira "Verbos II" e "Verbos III")? A partir de quantos?
- Marcações feitas na Leitura de episódios do catálogo também entram na série pessoal, ou só as conversas?

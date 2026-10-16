---
title: "ADR 0022: Conversa encerrada e série pessoal"
updated: 2026-10-16
source: docs/CONVERSATION-REVIEW-DRAFT.md e conversa de 16/10/2026
status: aceita
---

# ADR 0022: Conversa encerrada e série pessoal

## Contexto

A conversa com o tutor não tinha fim: a avaliação podia ser repetida sem limite e cada correção virava card na hora,
sem a pessoa ver. O que a pessoa errava nas conversas não tinha onde ser estudado além da revisão de cards. A trilha
de exercícios só existia para episódios do catálogo, que é compartilhado.

## Decisão

- **Encerrar é definitivo.** `conversation_sessions.closed_at` fecha a conversa; `sendMessage` recusa com
  `conversationClosed`. A folha de encerramento oferece "Encerrar e revisar" e "Encerrar sem avaliação". As duas dão
  o XP da conversa (a partir de `MIN_TURNS_FOR_XP` falas). Sem avaliação, a pessoa pode pedir "Avaliar agora" depois.
- **Revisão em segundo plano.** `review_status` (`none`, `queued`, `running`, `ready`, `failed`) e o job
  `conversation_review`: uma chamada em lote ao tutor (com uma segunda tentativa se a saída não passar no Zod),
  que devolve nota, resumo, falas corrigidas (`conversation_turns.corrected_text`) e até 10 dificuldades. O tipo
  da dificuldade segue a fala de origem: fala do tutor é sempre `tutor`; fala da pessoa nunca é. Ao terminar, o
  sino avisa; se falhar, a conversa mostra "Tentar de novo".
- **Cards só com escolha.** As correções deixam de virar card na hora. A tela de revisão traz cada dificuldade como
  card proposto; só as marcadas viram `learning_items` privados e `user_cards`. Confirmar duas vezes é recusado
  (`cards_confirmed_at`). Palavras marcadas na conversa encerrada vão para o job `conversation_terms`, que explica
  os termos com a IA e cria os cards sem nova confirmação.
- **Série pessoal, fora do catálogo.** Módulo `personal-series`, com `personal_series` (uma por conta e par, id
  fixo, nome e nível escolhidos pela pessoa, descrição escrita pela IA), `personal_seasons` (uma por nível do QECR),
  `personal_episodes` (por tema e parte) e `personal_episode_cards` (card único por série).
- **Temporada por nível.** A temporada ativa é o nível do perfil (modo "Meu nível"), um nível fixo ou o nível do
  perfil limitado a uma faixa (customizado). Quando o percentual do nível passa de 80%, os episódios novos vão para
  a temporada do nível seguinte; os temas voltam nela com foco mais avançado.
- **Episódios por tema.** A IA indica, para cada card, um episódio existente da temporada ou um título novo. Id
  inventado é descartado; o tema normalizado decide. Episódio com 12 cards continua numa parte nova ("Verbos II").
- **Trilha e lição sem IA.** Blocos de 4 cards; a lição usa `buildLesson` com os cards do bloco e os cards da série
  como distratores; áudio pelo endpoint de item. Bloco aprovado (70%) libera o seguinte e paga XP uma vez.
- **Descrição pela IA.** Job `personal_series_description` depois de cada confirmação de cards; texto limpo e
  limitado, com data e base (conversas e cards) na tela.
- **Áudio da conversa.** Job `conversation_audio` ao encerrar e de novo depois da revisão, para as falas corrigidas
  entrarem no cache; "Ouvir tudo" toca a conversa em sequência e "Escutar" esconde o texto até tocar.
- **Pacote pessoal.** A série entra no `.deixa.zip` pessoal como progresso: temporadas, episódios, cards e blocos
  concluídos. Importar soma sem duplicar e só preenche nome e descrição quando estão vazios no destino.

## Consequências

- Migrações 0023 (colunas da conversa) e 0024 (tabelas da série).
- Tabelas individuais novas no checklist de isolamento; teste de integração cobre dois usuários.
- Notificações novas: `conversation_review_ready`, `conversation_review_failed`, `conversation_terms_ready`.
- Rotas novas: `/tutor/[id]/review`, `/series`, `/series/[episodeId]`, `/series/[episodeId]/lesson/[node]`.

## Alternativas descartadas

- Obra privada no catálogo para a série: quebra a regra de que o catálogo é compartilhado.
- Um episódio por conversa: espalha o mesmo tema em vários episódios e não constrói vocabulário por assunto.
- Temporada por mês: não acompanha o nível nem permite revisitar temas com foco maior.
- Revisão síncrona com tela de espera: prende a pessoa na tela enquanto a IA responde.
- Manter o card automático e somar a revisão: duplica cards e tira a escolha da pessoa.

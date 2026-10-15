---
title: "ADR 0020: Progresso com fonte real"
updated: 2026-10-15
source: docs/PLAN.md fase 04 e conversa de 14/10/2026
status: aceita
---

# ADR 0020: Progresso com fonte real

## Contexto

Percentual de nível, habilidades, acertos e erros recorrentes vinham de um retrato de demonstração gravado
pelo seed em `progress_snapshots`. Fora do seed, a tela Progresso mostrava zeros fixos. Já existiam as fontes
de verdade: tentativas de lição, registros de revisão, progresso por episódio e revisões do tutor.

## Decisão

- `progress_snapshots` saiu (migração 0020). O perfil é calculado a cada leitura por `getProfileSummary`, só
  com o `userId` da sessão.
- Cada tentativa de lição grava `kinds`: acertos e total por tipo de exercício (`choice`, `listen`, `order`,
  `blank`, `type`).
- **Habilidades** (`skillPercents`): escuta = acertos em `listen` + `type`; gramática = `order` + `blank`;
  vocabulário = média entre acertos em `choice` e retenção na revisão (1 − "De novo" / revisões);
  conversação = média das notas do tutor. Sem dado, 0%.
- **Acertos (30 dias)**: acertos de lição e revisões sem "De novo" sobre o total dos dois.
- **Nível**: estimativa de avanço dentro do nível atual: metade pelas lições aprovadas (12 por nível) e metade
  pelos cards na coleção (80 por nível), sem reiniciar quando a pessoa troca o nível no perfil.
- **Erros recorrentes**: termos com mais "De novo" nos últimos 30 dias, até cinco, mostrados na Revisão.
- **Conquistas** com contagem real: primeira lição, sequências de 3, 7 e 30 dias, 25 phrasal verbs na
  coleção, 10 episódios concluídos, 10 conversas revisadas, um ditado sem erro. "Ouvido global" fica sem
  fonte até existir sotaque por obra.

## Consequências

- O seed deixa de plantar retratos; os perfis de demonstração mostram só o que o seed realmente gerou
  (tentativas, cards, XP).
- O pacote pessoal não carrega mais `snapshot` (campo aceito e ignorado em pacotes antigos).
- Teste unitário cobre as fórmulas com números redondos; o de integração confere que o perfil de um usuário
  não vê dado do outro.

## Alternativas descartadas

- Guardar o perfil calculado numa tabela e atualizar por evento: mais estado para manter em dia, sem ganho
  para o volume de um servidor doméstico.
- Habilidades por avaliação da IA: custo por chamada e nota não auditável.

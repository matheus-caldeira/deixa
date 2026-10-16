---
title: "ADR 0015: Medição e limite de uso da IA"
updated: 2026-10-16
source: docs/WEB-OFFLINE-PLAN.md §4 e conversa de 12/10/2026
status: aceita
---

# ADR 0015: Medição e limite de uso da IA

## Contexto

O único controle era uma contagem de 60 chamadas por dia para quem usava a chave compartilhada. Com vários
provedores, chave própria e versão pessoal, o custo deixa de ser previsível e a pessoa precisa enxergar quanto
gasta e poder se proteger.

## Decisão

- Toda chamada de IA gera um evento em `ai_usage_events`: provedor, modelo que respondeu, operação, tokens de
  entrada e saída, valor estimado e origem da chave. Nunca o prompt nem a resposta.
- O valor é uma estimativa pela tabela `ai_model_prices` (dólar por milhão de tokens), com padrão no código e a
  linha do administrador vencendo. Modelo sem preço tem os tokens contados e o valor fica desconhecido, nunca
  zero.
- Limite por dia e por mês, em dólar ou em tokens, no fuso da pessoa. Quem usa a própria chave define o seu
  (o administrador também pode mudar); para a chave compartilhada vale o padrão do servidor, e o administrador
  pode dar um limite próprio a cada conta. A pessoa pode pôr um teto menor na chave compartilhada
  (`key_source = global_cap`); vale o menor dos dois em cada campo. O administrador também escolhe o modelo de
  texto de cada conta na chave compartilhada (`user_ai_models.assigned_generation`), que passa na frente da
  escolha da pessoa só nessa chave (atualizado em 16/10/2026). A conferência acontece antes da chamada; passou do limite, toda a IA trava até o período virar ou o
  limite subir, e ler, marcar e revisar continuam funcionando.
- A chave compartilhada nasce com limite fechado (`SHARED_KEY_DEFAULT_LIMIT`: dólar e tokens por dia e por mês),
  porque antes havia um teto de 60 chamadas e um padrão aberto deixaria qualquer conta esgotar a chave do
  administrador. O limite em tokens garante a trava mesmo para modelo sem preço cadastrado.
- Os tokens vindos do provedor são dado não confiável: valores ausentes, negativos ou não numéricos viram
  zero na fronteira da contagem.

## Consequências

- A chamada que cruza o limite termina, porque o tamanho da resposta só se conhece depois; a trava vale da
  seguinte em diante. A interface trata o valor como estimativa e mostra a data do preço.
- O custo de uma consulta ao banco antes de cada chamada de IA é aceito; a chamada em si é muito mais cara.
- A conferência e a gravação não são atômicas: chamadas simultâneas da mesma conta podem passar juntas pouco
  antes do limite. Travar por conta durante a chamada de IA seguraria o banco por minutos; o excesso de
  algumas chamadas é aceito.
- A contagem de 60 chamadas e a tabela `ai_usage` saem.

## Alternativas descartadas

- Só contar chamadas: não distingue uma tradução curta de uma trilha inteira.
- Limite só para a chave compartilhada: a chave própria também gera cobrança real para a pessoa.
- Bloquear no meio da chamada: o provedor já cobrou; interromper só perde o resultado.

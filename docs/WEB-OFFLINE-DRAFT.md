---
title: Rascunho — versão web offline, vários provedores de IA e controle de custo
updated: 2026-10-12
source: conversa de 12/10/2026
---

# Rascunho: versão web offline, vários provedores de IA e controle de custo

**Estado: rascunho. Nada daqui está implementado nem testado.** Serve para dar noção do tamanho do trabalho e
da ordem. Importar e exportar tem rascunho próprio: [OFFLINE-EXPORT-DRAFT.md](OFFLINE-EXPORT-DRAFT.md).

## 1. Objetivo

Dois modos de uso sobre o mesmo núcleo (`domain/` e `application/`):

| Modo        | Onde roda                                  | Para quem                                    | Catálogo                        |
| ----------- | ------------------------------------------ | -------------------------------------------- | ------------------------------- |
| **Pessoal** | PWA hospedado na Vercel, dados no aparelho | Uma pessoa, como um Anki                     | Entra por importação de arquivo |
| **Família** | Servidor local empacotado no Tauri         | Várias contas na mesma instalação, como hoje | Compartilhado no servidor       |

Junto com isso, duas mudanças que valem para os dois modos:

- A IA deixa de ser só Gemini: a pessoa escolhe o provedor e o modelo.
- O uso da IA passa a ser medido em tokens e em valor, com limite e tela de acompanhamento.

## 2. Situação atual

- O banco é Postgres via `postgres` + Drizzle. O schema não usa extensão; os vetores das sugestões são `jsonb`.
- As telas buscam dados no servidor e gravam por server actions (10 arquivos com `"use server"`).
- Cerca de 20 arquivos usam `node:crypto` ou `node:fs`, quase todos em `infrastructure/`.
- A IA é chamada por `fetch` direto na API REST do Gemini (`src/infrastructure/google-ai/`), atrás dos ports.
  O Mastra citado no `PROJETO.md` §9 nunca foi instalado.
- O único controle de uso é o `SharedKeyBudget`: 60 chamadas por dia por pessoa, só para a chave
  compartilhada. Não há contagem de tokens nem de valor, e a chave própria não tem limite nenhum.
- `work_embeddings` já guarda um vetor por obra **e por modelo** (chave primária `work_key` + `model`).
- Já existem `manifest.ts`, `public/sw.js` e `public/offline.html`.

## 3. Decisões tomadas na conversa

| Decisão                                                   | Motivo                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PGlite no modo pessoal, Postgres no modo família          | PGlite é Postgres em WASM: um schema, uma pasta de migrações, os mesmos repositórios      |
| Não adotar o Mastra                                       | É framework de servidor; não roda no navegador, e os casos de uso já fazem a orquestração |
| AI SDK da Vercel atrás dos ports de IA                    | Roda no navegador e no Node, trata vários provedores e aceita schema Zod na saída         |
| Um embedding por obra e por modelo                        | Vetores de modelos diferentes não são comparáveis; guardar por modelo evita recalcular    |
| Medir tokens e valor, com limite e tela de acompanhamento | Com vários provedores e chave própria, o custo deixa de ser previsível                    |

## 4. O que muda em cada peça

| Peça                 | Modo pessoal (navegador)                                  | Modo família (servidor)    |
| -------------------- | --------------------------------------------------------- | -------------------------- |
| Banco                | PGlite gravado no aparelho                                | Postgres, como hoje        |
| Repositórios Drizzle | Os mesmos                                                 | Os mesmos                  |
| Usuário              | Um usuário local fixo, sem tela de entrar                 | Contas e sessão            |
| Borda                | Casos de uso executados no próprio navegador              | Chamada HTTP ao servidor   |
| Arquivos             | OPFS                                                      | `data/`                    |
| Cifra da chave de IA | WebCrypto, com chave não exportável guardada no navegador | AES-256-GCM e chave mestra |
| IA                   | Chamada direta do navegador com a chave da pessoa         | Pelo servidor              |
| Áudio                | Voz do navegador ou nenhum áudio                          | Kokoro                     |
| TMDB e OpenSubtitles | A decidir (seção 9)                                       | Pelo servidor              |

A regra de isolamento continua valendo no modo pessoal: os casos de uso seguem recebendo `userId`, que passa a
ser sempre o do usuário local.

## 5. Vários provedores de IA

- Um adapter por port (`LlmProvider`, `TutorProvider`, planejador de aula, redator de sugestões, embeddings)
  escrito sobre o AI SDK, recebendo provedor e modelo. Substitui os adapters de `src/infrastructure/google-ai/`.
- Os fakes continuam sendo o padrão em teste e quando não há chave.
- `user_ai_credentials` passa a guardar o provedor; a pessoa pode ter mais de uma chave de IA. O teste de chave
  vira um por provedor.
- Escolhas separadas: **modelo de geração** (cards, tradução, tutor, plano de aula, sugestões) e **modelo de
  embeddings**. Nem todo provedor oferece embeddings.
- Embeddings: mantém a chave `(work_key, model)`. Trocar de modelo calcula os vetores que faltam; os antigos
  ficam guardados e voltam a valer se a pessoa trocar de volta. Sem modelo de embeddings, as sugestões precisam
  de um caminho sem vetores (conferir se o ranqueamento atual já tem esse caminho).
- No modo pessoal, cada provedor tem regra própria para aceitar chamada direta do navegador. Um provedor só
  entra na lista depois de testado nesse modo.

## 6. Custo: medição, limite e acompanhamento

### Medição

Tabela individual nova, um registro por chamada de IA:

| Campo                           | Conteúdo                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `user_id`                       | Da sessão                                                                |
| `provider`, `model`             | Quem atendeu                                                             |
| `operation`                     | Cards, tradução, tutor, plano de aula, sugestões ou embeddings           |
| `input_tokens`, `output_tokens` | Devolvidos pelo provedor na resposta                                     |
| `estimated_cost`                | Calculado na hora com o preço vigente; vazio se o preço for desconhecido |
| `key_source`                    | Chave própria ou compartilhada                                           |
| `created_at`                    | Pelo `Clock`                                                             |

O registro guarda só metadados, nunca o prompt nem a resposta, como já manda a regra de logs.

### Preços

- Tabela de preço por modelo (entrada e saída, por milhão de tokens), com data de vigência.
- Vem com valores iniciais e é editável, porque os preços mudam e o app não tem como saber sozinho.
- Modelo sem preço cadastrado: os tokens são contados e o valor aparece como desconhecido, nunca como zero.
- Modelo local tem preço zero cadastrado de forma explícita.

### Limites

- Por dia e por mês, em tokens ou em valor.
- Chave compartilhada: o administrador define o limite de cada pessoa. Substitui as 60 chamadas por dia do
  `SharedKeyBudget`.
- Chave própria: a pessoa define o próprio limite; sem limite definido, nada é bloqueado.
- A conferência acontece antes da chamada, contra o acumulado. Uma chamada pode ultrapassar um pouco o limite,
  porque o tamanho da resposta só é conhecido depois; a seguinte é recusada.
- Aviso ao chegar perto do limite (por exemplo, 80%) e mensagem clara ao bloquear, dizendo quando libera.
- Limite em valor só funciona para modelos com preço cadastrado; para os demais vale o limite em tokens.

### Tela "Uso da IA"

No perfil:

- Gasto de hoje e do mês contra o limite.
- Quebra por tipo de operação e por modelo.
- Histórico por dia.
- Para o administrador, no modo família: total por pessoa, sem detalhe do que cada uma fez.

Esta tela não existe no `deixa.html`. Precisa de desenho aprovado antes de ser construída.

## 7. Etapas

A ordem põe primeiro o que reduz risco e o que já serve ao modo família de hoje.

| Nº  | Etapa                           | O que entrega                                                                               | Critério de pronto                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0   | Prova do PGlite                 | Um fluxo (importar SRT, ler, marcar) no navegador com as migrações e os repositórios atuais | O fluxo roda sem alterar repositório; o que precisou mudar fica anotado                  |
| 1   | Banco com dois drivers          | Tipo `Database` genérico; abertura por `postgres` ou por PGlite                             | Testes de integração passam nos dois drivers                                             |
| 2   | IA pelo AI SDK, ainda só Gemini | Adapters novos atrás dos mesmos ports                                                       | Comportamento igual ao atual; testes existentes passam sem mudança                       |
| 3   | Medição de uso                  | Registro de tokens e valor por chamada; tabela de preços                                    | Toda chamada de IA gera registro; teste de isolamento entre dois usuários                |
| 4   | Limites e tela "Uso da IA"      | Limite por dia e por mês; bloqueio; tela no perfil                                          | Chamada acima do limite é recusada; tela confere com os registros                        |
| 5   | Escolha de provedor             | Provedor na chave de IA; modelo de geração e de embeddings separados                        | Dois provedores funcionando de ponta a ponta; trocar embeddings recalcula só o que falta |
| 6   | Borda única                     | Telas chamam uma interface só, com implementação local ou por HTTP                          | E2E atual passa no modo família                                                          |
| 7   | Adapters de navegador           | Cifra, arquivos e áudio sem Node                                                            | Modo pessoal roda o fluxo completo sem servidor                                          |
| 8   | Importar e exportar             | Conforme o [rascunho próprio](OFFLINE-EXPORT-DRAFT.md)                                      | Pacote exportado no modo família é importado no modo pessoal                             |
| 9   | PWA e publicação                | Cache completo do app, instalação, aviso de cópia de segurança, publicação na Vercel        | App abre e funciona com a rede desligada depois da primeira visita                       |

As etapas 2 a 5 não dependem do modo pessoal e podem ser feitas antes ou em paralelo. A etapa 6 é a maior.

## 8. Riscos

- **Borda única.** Trocar páginas que buscam dados no servidor por telas que chamam uma interface mexe em
  todas as telas. Alternativa descartada por ora: manter duas bordas, que duplicaria cada tela nova.
- **Perda de dados no navegador.** O navegador pode apagar o armazenamento local, principalmente no iOS quando
  o app não está instalado. A cópia de segurança exportável é obrigatória no modo pessoal.
- **Tamanho do PGlite.** Soma alguns megabytes ao primeiro carregamento. Medir na etapa 0.
- **Chave de IA no navegador.** No modo pessoal a chave fica no aparelho da pessoa; qualquer script que rode
  na página teria acesso a ela em uso. Exige política de conteúdo restrita e nenhuma dependência de terceiros
  carregada em tempo de execução.
- **Preços desatualizados.** O valor mostrado é estimativa. A tela precisa dizer isso e mostrar a data do
  preço usado.
- **Limite não é teto exato.** Uma chamada longa pode passar do limite antes do bloqueio valer.

## 9. Perguntas em aberto

- **TMDB e OpenSubtitles no modo pessoal.** O token do servidor não pode ir para o bundle. Opções: a pessoa
  cadastra as próprias chaves; ou uma função na Vercel serve de intermediária, o que expõe um endereço público
  usando o token do projeto e pede limite de uso; ou o modo pessoal vive só de importação. Falta conferir se a
  API do OpenSubtitles aceita chamada direta do navegador.
- **Senha na exportação.** O rascunho de exportação cifra os dados pessoais com e-mail e senha da conta. No
  modo pessoal não há conta: pedir uma senha só na hora de exportar?
- **Áudio no modo pessoal.** Voz do navegador (qualidade varia por aparelho), modelo de voz rodando no
  navegador (download grande) ou só áudio importado em pacote?
- **Estimativa antes de operações grandes.** Mostrar o custo previsto antes de gerar conteúdo para uma
  temporada inteira?
- **Moeda.** Os provedores cobram em dólar. Mostrar em dólar ou converter?
- **Sincronização.** Fica de fora: o modo pessoal não conversa com o modo família a não ser por arquivo.

## 10. Documentos a atualizar quando virar plano

- `PROJETO.md`: retirar o Mastra da stack e do §9; descrever os dois modos.
- `.contexts/business/glossary.md`: "Chave de IA" deixa de ser só do Google AI; entram os termos de uso e
  limite.
- ADR 0008 (provider de LLM e chave por usuário): substituir ou complementar com vários provedores.
- ADRs novos: PGlite no modo pessoal; AI SDK; medição e limite de custo.
- `.contexts/engineering/rules/user-isolation.md` e a rule correspondente: incluir a tabela de uso da IA.
- `docs/PLAN.md`: as etapas da seção 7, quando forem aprovadas.

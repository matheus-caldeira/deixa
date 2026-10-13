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
| **Pessoal** | PWA hospedado na Vercel, dados no aparelho | Uma pessoa por conta, como um Anki           | Entra por importação de arquivo |
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
| Passou do limite, trava toda a IA                         | O valor é estimativa, mas o bloqueio é total até o período virar ou o limite subir        |
| Entrar com e-mail e senha também no modo pessoal          | A experiência é a mesma nos dois modos; só o banco muda de lugar                          |
| Sem chave compartilhada no modo pessoal                   | Não há servidor para guardar segredo; cada pessoa cadastra as próprias chaves             |
| Sem função intermediária na Vercel                        | TMDB, OpenSubtitles e Gemini aceitam chamada direta do navegador                          |

## 4. O que muda em cada peça

| Peça                 | Modo pessoal (navegador)                                             | Modo família (servidor)                    |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Banco                | PGlite gravado no aparelho                                           | Postgres, como hoje                        |
| Repositórios Drizzle | Os mesmos                                                            | Os mesmos                                  |
| Usuário              | Contas com e-mail e senha, guardadas no banco local                  | Contas e sessão                            |
| Borda                | Casos de uso executados no próprio navegador                         | Chamada HTTP ao servidor                   |
| Arquivos             | OPFS, mais uma pasta escolhida pela pessoa onde o navegador permitir | `data/`                                    |
| Cifra das chaves     | WebCrypto, com chave derivada da senha da conta                      | AES-256-GCM e chave mestra                 |
| IA                   | Chamada direta do navegador com a chave da pessoa                    | Pelo servidor                              |
| Áudio                | Voz do navegador ou nenhum áudio                                     | Kokoro                                     |
| TMDB e OpenSubtitles | Chamada direta do navegador com as chaves da pessoa                  | Pelo servidor, com as chaves da instalação |

A regra de isolamento continua valendo no modo pessoal: os casos de uso seguem recebendo o `userId` da conta
que entrou, e mais de uma pessoa pode ter conta no mesmo navegador.

### 4.1 Contas no modo pessoal

- Criar conta e entrar funcionam como hoje, com e-mail e senha. A diferença é que a conta vive no banco local:
  ela não existe em outro aparelho até a pessoa importar a cópia de segurança.
- A senha continua guardada só como hash `scrypt`. O `scrypt` não existe no WebCrypto, então o navegador usa
  uma biblioteca em JavaScript com os mesmos parâmetros, para o hash valer nos dois modos.
- Não há cookie de sessão, porque não há servidor: a sessão é um registro local que dura até a pessoa sair.
- As chaves de API são cifradas com uma chave derivada da senha. Sem a senha, ninguém lê as chaves, nem com
  acesso ao aparelho.
- O restante do banco não é cifrado. A senha separa os perfis no uso normal, mas não protege os dados de
  estudo contra quem tem acesso ao aparelho e sabe inspecionar o armazenamento do navegador.
- Não existe "esqueci a senha": não há servidor nem e-mail de recuperação. Quem perde a senha precisa de um
  caminho para redefini-la mantendo o estudo e cadastrando as chaves de API de novo.
- A exportação dos dados pessoais usa o e-mail e a senha da conta, como no
  [rascunho de exportação](OFFLINE-EXPORT-DRAFT.md) §6, sem mudança.

### 4.2 Serviços externos no modo pessoal

No modo pessoal não existe chave compartilhada nem administrador. Cada pessoa cadastra as próprias chaves no
perfil, e o navegador chama o serviço direto:

| Serviço       | Sem a chave                                     | Chamada direta do navegador                      |
| ------------- | ----------------------------------------------- | ------------------------------------------------ |
| IA            | Provider fake, como hoje                        | Gemini aceita; os outros, testar um a um         |
| TMDB          | Cadastro manual da obra ou importação de pacote | Aceita                                           |
| OpenSubtitles | Envio manual do `.srt` ou importação de pacote  | Aceita no teste sem chave; falta teste com chave |

Conferido em 12/10/2026 com pedidos sem credencial: os três serviços respondem liberando qualquer origem.
Falta o teste real com chave, principalmente no OpenSubtitles, que identifica o aplicativo por cabeçalho.

Por isso a função intermediária na Vercel não é necessária. Ela só voltaria à mesa se algum serviço passasse
a recusar o navegador, ou se a ideia fosse oferecer uso sem a pessoa cadastrar chave nenhuma.

### 4.3 Onde os dados ficam no aparelho

| Lugar                           | O que guarda                                     | Onde funciona               |
| ------------------------------- | ------------------------------------------------ | --------------------------- |
| Armazenamento do navegador      | Banco (PGlite), legendas e áudio em OPFS         | Todos os navegadores        |
| Pasta escolhida pela pessoa     | Cópia de segurança automática, pacotes, legendas | Chrome e Edge no computador |
| Arquivo baixado e enviado à mão | Cópia de segurança e pacotes                     | Todos, inclusive celular    |

- A pasta usa a API de acesso a arquivos do navegador: a pessoa escolhe a pasta uma vez e o app passa a ler
  e gravar nela. Safari e Firefox não têm essa API; no celular o suporte é parcial e precisa ser medido.
- O navegador pode pedir a permissão de novo a cada visita. O app precisa mostrar isso como um passo normal,
  não como erro.
- O banco em uso continua no armazenamento do navegador. A pasta recebe a cópia de segurança (o mesmo
  `.deixa.zip` da exportação) e serve de origem para importar legendas e pacotes. Manter o banco vivo dentro
  da pasta fica de fora: dois navegadores ou duas abas gravando no mesmo arquivo corrompem o banco.
- Com a pasta configurada, a perda do armazenamento do navegador deixa de ser perda de dados: o app oferece
  restaurar da última cópia.
- O app também pede ao navegador armazenamento persistente, o que reduz a chance de limpeza automática.
- No modo família nada muda: os arquivos ficam em `data/`, no computador que roda o servidor.

### 4.4 Publicação na Vercel

- **O que sobe:** só o aplicativo (HTML, JavaScript, CSS, o WASM do PGlite e as migrações). Nenhum banco,
  nenhuma função, nenhuma variável de ambiente com segredo. Os dados nunca passam pela Vercel.
- **Dois alvos de build no mesmo repositório:** o atual do Tauri (`DEIXA_STANDALONE=1`, servidor empacotado)
  e um novo para a web, sem server actions nem route handlers. O container é montado conforme o alvo.
- **Teste de bundle:** o alvo web ganha a mesma conferência que já existe para o token do TMDB: nenhum
  segredo, nenhum módulo de Node e nenhum adapter de servidor dentro do que é publicado.
- **Offline:** o service worker guarda o aplicativo inteiro na primeira visita. Depois disso, abrir, ler,
  marcar e revisar funcionam sem rede; IA, TMDB e busca de legendas precisam de rede e avisam quando não há.
- **Atualização:** cada publicação traz uma versão nova do service worker. O app avisa que há versão nova e
  troca quando a pessoa aceita, para não mudar de versão no meio de uma revisão.
- **Migrações do banco local:** rodam no navegador, na abertura, quando a versão publicada traz migração
  nova. Antes de migrar, o app faz uma cópia de segurança. Versão publicada não pode ser desfeita com
  migração já aplicada no aparelho das pessoas: migrações só para a frente e compatíveis com a versão anterior.
- **Domínio:** o armazenamento do navegador é preso ao endereço. Trocar de domínio depois deixa os dados de
  todo mundo no endereço antigo, recuperáveis só por exportação. Escolher o domínio definitivo antes de
  divulgar. Endereços de pré-visualização da Vercel têm armazenamento separado, o que é bom para testar.
- **Cabeçalhos:** política de conteúdo restrita (só o próprio endereço e os serviços externos listados),
  porque as chaves da pessoa ficam em uso na página.
- **Plano da Vercel:** hospedagem estática cabe no plano gratuito, que é só para uso não comercial. Conferir
  os termos antes de abrir a terceiros.

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
- Chave compartilhada (só no modo família): o administrador define o limite de cada pessoa. Substitui as 60
  chamadas por dia do `SharedKeyBudget`.
- Chave própria: a pessoa define o próprio limite; sem limite definido, nada é bloqueado.
- A conferência acontece antes de cada chamada, contra o acumulado. **Passou do limite, trava tudo:** nenhuma
  chamada de IA é feita, em nenhuma operação, até o período virar ou o limite ser aumentado.
- O valor é estimativa, e a interface diz isso. A chamada que cruza o limite termina normalmente, porque o
  tamanho da resposta só é conhecido depois; o bloqueio vale da seguinte em diante.
- Aviso ao chegar perto do limite (por exemplo, 80%) e mensagem clara ao bloquear, dizendo quando libera.
- Com a IA travada, o que não depende dela continua funcionando: ler, marcar, revisar cards já criados.
- Limite em valor só funciona para modelos com preço cadastrado; para os demais vale o limite em tokens.

### Tela "Uso da IA"

No perfil:

- Gasto de hoje e do mês contra o limite.
- Quebra por tipo de operação e por modelo.
- Histórico por dia.
- Para o administrador, no modo família: total por pessoa, sem detalhe do que cada uma fez.

Esta tela é nova: o `deixa.html`, que é a referência visual aprovada do projeto, não tem nada parecido. O
mesmo vale para a escolha de provedor e modelo, os campos de chave do TMDB e do OpenSubtitles, a escolha da
pasta e o aviso de versão nova. O caminho é desenhar essas telas no próprio protótipo, com os componentes e
tokens que já existem (as barras e os cartões de Progresso servem de base), aprovar e só então construir.

## 7. Etapas

A ordem põe primeiro o que reduz risco e o que já serve ao modo família de hoje.

| Nº  | Etapa                           | O que entrega                                                                                                                 | Critério de pronto                                                                                    |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0   | Prova do PGlite                 | Um fluxo (importar SRT, ler, marcar) no navegador com as migrações e os repositórios atuais                                   | O fluxo roda sem alterar repositório; o que precisou mudar fica anotado                               |
| 1   | Banco com dois drivers          | Tipo `Database` genérico; abertura por `postgres` ou por PGlite                                                               | Testes de integração passam nos dois drivers                                                          |
| 2   | IA pelo AI SDK, ainda só Gemini | Adapters novos atrás dos mesmos ports                                                                                         | Comportamento igual ao atual; testes existentes passam sem mudança                                    |
| 3   | Medição de uso                  | Registro de tokens e valor por chamada; tabela de preços                                                                      | Toda chamada de IA gera registro; teste de isolamento entre dois usuários                             |
| 4   | Limites e tela "Uso da IA"      | Limite por dia e por mês; bloqueio; tela no perfil                                                                            | Chamada acima do limite é recusada; tela confere com os registros                                     |
| 5   | Escolha de provedor             | Provedor na chave de IA; modelo de geração e de embeddings separados                                                          | Dois provedores funcionando de ponta a ponta; trocar embeddings recalcula só o que falta              |
| 6   | Borda única                     | Telas chamam uma interface só, com implementação local ou por HTTP                                                            | E2E atual passa no modo família                                                                       |
| 7   | Adapters de navegador           | Senha, cifra, sessão local, arquivos, pasta de cópia de segurança e áudio sem Node; chaves de TMDB e OpenSubtitles por pessoa | Modo pessoal roda o fluxo completo sem servidor                                                       |
| 8   | Importar e exportar             | Conforme o [rascunho próprio](OFFLINE-EXPORT-DRAFT.md)                                                                        | Pacote exportado no modo família é importado no modo pessoal                                          |
| 9   | PWA e publicação                | Alvo de build web, cache completo, aviso de versão nova, migração local com cópia de segurança, publicação na Vercel (4.4)    | App abre e funciona com a rede desligada depois da primeira visita; teste de bundle do alvo web passa |

As etapas 2 a 5 não dependem do modo pessoal e podem ser feitas antes ou em paralelo. A etapa 6 é a maior.

## 8. Riscos

- **Borda única.** Trocar páginas que buscam dados no servidor por telas que chamam uma interface mexe em
  todas as telas. Alternativa descartada por ora: manter duas bordas, que duplicaria cada tela nova.
- **Perda de dados no navegador.** O navegador pode apagar o armazenamento local, principalmente no iOS quando
  o app não está instalado. A pasta de cópia de segurança resolve no computador com Chrome ou Edge; nos demais
  casos a pessoa depende de exportar à mão, e o app precisa lembrar disso.
- **Tamanho do PGlite.** Soma alguns megabytes ao primeiro carregamento. Medir na etapa 0.
- **Chave de IA no navegador.** No modo pessoal a chave fica no aparelho da pessoa; qualquer script que rode
  na página teria acesso a ela em uso. Exige política de conteúdo restrita e nenhuma dependência de terceiros
  carregada em tempo de execução.
- **Preços desatualizados.** O valor mostrado é estimativa. A tela precisa dizer isso e mostrar a data do
  preço usado.
- **Limite não é teto exato.** A chamada que cruza o limite termina; o bloqueio total vale a partir da
  seguinte. Aceito, desde que a interface trate o valor como estimativa.
- **Atrito das chaves.** No modo pessoal, quem quer busca de obra, busca de legenda e IA precisa criar e
  cadastrar três chaves. O app precisa funcionar bem sem nenhuma delas, só com importação e envio manual.
- **Senha sem recuperação.** Ver 4.1.

## 9. Perguntas em aberto

- **OpenSubtitles com chave real.** Confirmar que busca e download funcionam direto do navegador.
- **Senha perdida no modo pessoal.** Qual é o caminho de redefinição (ver 4.1)?
- **Pasta no celular.** Medir o suporte real em Android e iOS antes de prometer.
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

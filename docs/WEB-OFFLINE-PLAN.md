---
title: Viabilidade e plano — versão web offline, vários provedores de IA, custo e importar/exportar
updated: 2026-10-12
source: docs/WEB-OFFLINE-DRAFT.md, docs/OFFLINE-EXPORT-DRAFT.md e análise do código em 12/10/2026
---

# Viabilidade e plano

Este documento responde a duas perguntas sobre os rascunhos
[WEB-OFFLINE-DRAFT.md](WEB-OFFLINE-DRAFT.md) e [OFFLINE-EXPORT-DRAFT.md](OFFLINE-EXPORT-DRAFT.md): dá para
fazer, e em que ordem. É um plano mestre. Cada etapa ganha o próprio plano detalhado, com tarefas e critério
de pronto no `docs/PLAN.md`, quando for iniciada.

## 1. Veredito

**Dá para fazer tudo, com três limitações que não têm contorno e três incertezas que precisam de prova antes
de qualquer compromisso.**

O que sustenta o veredito:

- O banco no navegador foi provado com o código real (seção 2).
- As regras já vivem em casos de uso atrás de ports, e as telas de `src/ui` já recebem os dados prontos.
- As chaves por pessoa para IA, TMDB e OpenSubtitles já existem.

Limitações sem contorno:

1. **Pasta de destino só no Chrome e no Edge de computador.** Safari e Firefox não têm a API.
2. **Sem recuperação de senha no modo pessoal.** Não há servidor para mandar e-mail.
3. **Os dois modos só conversam por arquivo.** Não haverá sincronização entre o PWA e o servidor da família.

Incertezas que a etapa 0 precisa resolver:

1. **Memória do PGlite.** Uma medição anterior registrou picos perto de 1 GB (ver seção 2). Se isso se
   repetir no navegador, o modo pessoal não roda em celular.
2. **Next offline.** Navegar entre telas sem rede, com o App Router, depende de publicar o app como export
   estático. Isso exige trocar as quatro rotas com identificador no caminho e nunca foi testado aqui.
3. **PGlite dentro do navegador.** A prova rodou em Node. Faltam o empacotamento, a gravação no aparelho, o
   comportamento com duas abas abertas e o espaço ocupado no iPhone.

Se a incerteza 2 falhar, o modo pessoal ainda é possível, mas com outra casca no lugar do Next, o que muda o
custo da etapa 6. Por isso a etapa 0 vem antes de tudo e decide se o resto segue como está escrito.

## 2. O que foi verificado

### Prova executada: seed real sobre PGlite

Rodei as migrações e o `runSeed` do projeto sobre PGlite 0.5.9, em Node, numa pasta temporária, usando o
`buildContainer` real com os providers fake. Nenhum arquivo do repositório foi alterado.

| Verificação                                            | Resultado                                      |
| ------------------------------------------------------ | ---------------------------------------------- |
| 15 migrações aplicadas pelo migrador do Drizzle        | Passou, em cerca de 0,1 s                      |
| Seed completo (todos os repositórios usados pelo seed) | Passou, em cerca de 0,4 s                      |
| Seed repetido                                          | Mesmas contagens: idempotente                  |
| Fechar e reabrir o banco em disco                      | Dados preservados                              |
| Mudança necessária nos repositórios                    | Nenhuma; só o tipo `Database` precisou de cast |

O seed criou 3 usuários, 7 obras, 71 episódios, 618 falas, 264 alinhamentos, 21 marcações, 22 itens de
aprendizado, 25 cards e 141 eventos de XP. Passou por transações, `ON CONFLICT`, `jsonb` e pela trava
`pg_advisory_xact_lock` da primeira conta.

Fora da prova: o que o seed não exercita (tutor, sugestões com embeddings, notificações, parte do estudo) e
tudo o que é específico do navegador.

### Medições

| Item                                      | Valor                                           |
| ----------------------------------------- | ----------------------------------------------- |
| PGlite comprimido (WASM e dados iniciais) | Cerca de 5,3 MB a mais no primeiro carregamento |
| Banco recém-criado com o seed, em disco   | 41 MB                                           |
| Abrir o PGlite em Node                    | Cerca de 1 s                                    |

Os 41 MB contam: o iPhone limita o armazenamento de sites, e legendas e áudio somam por cima disso.

### Inventário do código

| Área                                    | Tamanho hoje                                                      | Destino                                                |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `src/modules`                           | 130 arquivos, 15,4 mil linhas                                     | Reaproveitado quase inteiro                            |
| `src/ui`                                | 28 arquivos, 5,5 mil linhas; telas recebem dados por propriedades | Reaproveitado; 18 arquivos trocam a chamada às actions |
| `src/app`                               | 13 pages, 10 arquivos de actions com 35 funções, 9 route handlers | Reescrito como borda única                             |
| `revalidatePath`                        | 27 chamadas                                                       | Substituído por recarga de dados no cliente            |
| `after()` (trabalho depois da resposta) | 5 chamadas: plano de aula, sugestões, lote de cards               | Vira fila retomável                                    |
| Arquivos com `node:*`                   | 19, quase todos em `infrastructure/`                              | Par de navegador ou biblioteca portável                |
| Uso do tipo `Database`                  | 22 arquivos                                                       | Troca de tipo, sem mudança de lógica                   |

Achados que mudam o plano em relação aos rascunhos:

- **Chaves por pessoa já existem.** `user_ai_credentials` é única por `(user_id, provider)` e o container já
  resolve Gemini, TMDB e OpenSubtitles por usuário. O modo pessoal não precisa de trabalho novo aqui.
- **Os ports de IA não devolvem tokens.** `explainTerms`, `translateLines` e os demais devolvem só o
  conteúdo. A medição entra no adapter, por um registrador injetado, sem mudar os casos de uso. É o mesmo
  desenho do `budgetedLlm` atual.
- **`sha256Hex` é síncrono e usado em domínio.** O hash do navegador é assíncrono. Com uma biblioteca em
  JavaScript puro a função continua síncrona e nada acima dela muda. São dois pontos de uso.
- **`KeyCipher` é síncrono.** Mesma saída: biblioteca portável, port intacto.
- **`src/app/actions/catalog.ts` importa `node:fs/promises`.** É regra de infraestrutura na borda; some com a
  borda única.
- **O PGlite já tinha sido medido antes, e a memória é o ponto fraco.** O `docs/HANDOFF.md` (3.3 A) registra
  uma prova de 12/10/2026 com a suíte de integração inteira passando sobre PGlite, mas com picos de 0,9 a
  1,2 GB de memória ao abrir e sob uso, assentando entre 175 e 280 MB. Por isso o Matheus decidiu **não
  embutir banco** no modo família, que segue com Postgres externo. A minha prova não mediu memória. Esse
  número é o maior risco do modo pessoal: uma aba de celular não aguenta um pico de 1 GB.
- **AI SDK:** o pacote `ai` está na versão 7 e aceita Zod 4 (`^4.1.8`). O projeto usa Zod 4.6.

## 3. Viabilidade por bloco

| Bloco                                  | Viável?              | Tamanho | O que pesa                                                             |
| -------------------------------------- | -------------------- | ------- | ---------------------------------------------------------------------- |
| Banco com dois drivers                 | Sim, provado em Node | P       | Rodar os testes de integração nos dois drivers                         |
| IA pelo AI SDK                         | Sim                  | M       | Cinco adapters; saída estruturada por provedor                         |
| Medição, limite e tela de uso          | Sim                  | M       | Tabela de preços; tela nova sem protótipo                              |
| Escolha de provedor e de embeddings    | Sim                  | M       | Testar cada provedor chamado do navegador                              |
| Importar e exportar, tipos 2 a 5       | Sim                  | G       | Pacote hostil, arquivos grandes, cifra, fusão de históricos            |
| Importar e exportar, tipo 1            | Incerto              | G       | Reconstruir texto de trilha e card a partir da legenda de quem importa |
| Borda única                            | Sim                  | G       | 13 pages e 35 actions; maior etapa do plano                            |
| Adapters de navegador                  | Sim                  | M       | Senha, cifra, arquivos, sessão local, áudio                            |
| Trabalho em segundo plano no navegador | Sim, com ressalva    | M       | Fechar a aba interrompe; precisa retomar ao abrir                      |
| PWA offline na Vercel                  | Depende da etapa 0   | M       | Export estático do Next e cache completo                               |
| Pasta de cópia de segurança            | Sim, parcial         | P       | Só Chrome e Edge de computador                                         |
| Áudio no modo pessoal                  | Parcial              | P       | Voz do navegador varia; Kokoro só para quem roda um na própria máquina |

Tamanhos relativos: P é questão de dias, M de uma a duas semanas, G de várias semanas. São ordens de grandeza
para comparar etapas, não prazos.

## 4. Desenho

### Borda única por registro de operações

Hoje a borda são pages que buscam dados e server actions. A proposta é um **registro de operações**: uma
tabela com nome da operação, schema Zod da entrada e o caso de uso que atende. As 35 funções de actions e as
buscas das 13 pages viram entradas desse registro.

- **Modo família:** um route handler recebe a operação, resolve a sessão pelo cookie e despacha.
- **Modo pessoal:** o mesmo registro roda dentro de um worker do navegador, ao lado do PGlite e do container.
- **Telas:** cliente nos dois modos. Chamam `operação(nome, entrada)` e recebem os mesmos dados que hoje
  chegam por propriedades.

O `userId` continua vindo só da sessão nos dois modos, e nenhum schema de entrada o aceita.

Consequência aceita: o modo família deixa de renderizar no servidor. Para um app local isso não faz falta.

### Worker no modo pessoal

O PGlite, o container e o registro ficam num worker compartilhado entre abas. Isso resolve três coisas de uma
vez: a interface não trava durante consultas, duas abas não abrem o mesmo banco ao mesmo tempo, e o trabalho
em segundo plano continua enquanto alguma aba estiver aberta.

### Fila retomável

As cinco chamadas a `after()` viram trabalhos com estado gravado no banco, como o lote de cards já faz. No
modo pessoal, ao abrir o app, trabalhos interrompidos são retomados. Continua valendo a proibição de
`setInterval` e cron dentro do processo web.

### Dois alvos de build

| Alvo    | Como é gerado                   | O que contém                                         |
| ------- | ------------------------------- | ---------------------------------------------------- |
| Família | `DEIXA_STANDALONE=1`, como hoje | Telas, handler de operações, áudio, rotas do desktop |
| Web     | Export estático                 | Telas, worker, PGlite, migrações; nenhum handler     |

Os handlers só de servidor ficam fora do alvo web por extensão de arquivo (`pageExtensions` do Next). As
quatro rotas com identificador no caminho (`read/[episodeId]`, `tutor/[sessionId]`, `catalog/[mediaId]`,
`study/[episodeId]/[node]`) passam a levar o identificador na query string, nos dois alvos, porque o export
estático não gera páginas para identificadores desconhecidos.

### IA, medição e limite

- Um adapter por port sobre o AI SDK, recebendo provedor e modelo.
- Um registrador de uso injetado no adapter grava provedor, modelo, operação, tokens e valor estimado.
- A conferência do limite acontece antes da chamada. Passou do limite, toda a IA trava até o período virar
  ou o limite subir. O valor é mostrado como estimativa.
- Embeddings ficam um por obra e por modelo, como a tabela já faz.

### Bibliotecas novas previstas

| Necessidade                         | Biblioteca                        | Motivo                                                       |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Banco no navegador                  | `@electric-sql/pglite`            | Postgres em WASM; provado com o código real                  |
| Vários provedores de IA             | `ai` e os pacotes de provedor     | Roda no navegador e no Node; aceita Zod 4                    |
| SHA-256, scrypt e AES-GCM portáveis | `@noble/hashes`, `@noble/ciphers` | JavaScript puro; mantém os ports síncronos                   |
| ZIP em fluxo                        | `fflate`                          | Roda nos dois lados; não carrega o pacote inteiro em memória |

Cada uma entra com documento de stack em `.contexts/engineering/stacks/` antes do primeiro uso.

## 5. Etapas

A ordem põe as provas primeiro, depois o que já melhora o modo família de hoje, e por último o que só existe
no modo pessoal.

| Nº  | Etapa                                  | Entrega                                                                                                   | Critério de pronto                                                                                            | Depende de |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 0   | Provas de viabilidade                  | PGlite em worker no navegador com gravação e duas abas; Next em export estático navegando sem rede        | Importar SRT, ler e marcar no navegador sem servidor e sem rede, em Chrome, Safari e iPhone; tamanhos medidos | —          |
| 1   | Banco com dois drivers                 | Tipo `Database` genérico; abertura por `postgres` ou PGlite; migrações embutidas                          | Testes de integração e de isolamento passam nos dois drivers                                                  | 0          |
| 2   | IA pelo AI SDK, só Gemini              | Cinco adapters novos atrás dos ports atuais                                                               | Testes existentes passam sem mudança; mesma saída para as mesmas entradas nos fixtures                        | —          |
| 3   | Medição de uso                         | Tabela de uso, tabela de preços, registrador nos adapters                                                 | Toda chamada de IA gera registro; teste de isolamento com dois usuários                                       | 2          |
| 4   | Limite e tela "Uso da IA"              | Limite por dia e por mês; trava total; tela desenhada no protótipo e construída                           | Chamada acima do limite é recusada em todas as operações; tela confere com os registros                       | 3          |
| 5   | Escolha de provedor                    | Provedor e modelo na chave de IA; modelo de embeddings separado                                           | Dois provedores de ponta a ponta; trocar embeddings recalcula só o que falta                                  | 2          |
| 6   | Borda única                            | Registro de operações; telas cliente; fila retomável; rotas sem identificador no caminho                  | E2E atual passa no modo família; nenhuma server action restante                                               | 0          |
| 7   | Importar e exportar, tipos 4, 5, 2 e 3 | Formato `.deixa.zip`, manifesto, validação, cifra dos dados pessoais                                      | Exportar e importar duas vezes não duplica; pacote adulterado é recusado; teste de isolamento                 | 6          |
| 8   | Modo pessoal                           | Container de navegador: senha, cifra, sessão local, arquivos em OPFS, áudio, pasta de cópia de segurança  | Fluxo completo sem servidor; pacote do modo família importado no modo pessoal                                 | 1, 6, 7    |
| 9   | PWA e publicação                       | Alvo web, cache completo, aviso de versão nova, migração local com cópia de segurança, cabeçalhos, Vercel | App funciona sem rede depois da primeira visita; teste de bundle do alvo web passa                            | 8          |
| 10  | Opcional: tipo 1                       | Exportação "só tempos"                                                                                    | Decidir depois de confirmar a interpretação do pedido                                                         | 7          |

As etapas 2 a 5 não dependem do modo pessoal e entregam valor sozinhas: vários provedores e controle de custo
no Tauri de hoje. Podem começar em paralelo à etapa 0.

A exportação vem antes do modo pessoal porque é a única proteção contra perda de dados no navegador e a única
ponte entre os dois modos.

### Etapa 0 em detalhe

É a única etapa que pode mudar o plano. Duas provas pequenas, em branch próprio, sem compromisso de manter o
código:

| Prova | Pergunta                                                                                                        | Se falhar                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A     | O PGlite roda num worker, grava no aparelho e aguenta duas abas?                                                | Limitar a uma aba ativa, com aviso na segunda                                                                 |
| B     | O Next em export estático navega entre todas as telas sem rede?                                                 | Trocar a casca do alvo web; a etapa 6 cresce                                                                  |
| C     | Quanto de memória e de espaço o PGlite usa no navegador, em computador e em iPhone, e o Safari mantém os dados? | Modo pessoal só em computador, ou outro banco no navegador, o que derruba o reaproveitamento dos repositórios |
| D     | OpenSubtitles funciona chamado do navegador com chave real?                                                     | Modo pessoal só com envio manual e importação de pacote                                                       |

## 6. Riscos

| Risco                                                   | Chance | Impacto | Resposta                                                                 |
| ------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------ |
| Next offline não fecha com export estático              | Média  | Alto    | Prova B antes de tudo                                                    |
| Borda única quebra telas que funcionam                  | Média  | Alto    | Migrar tela a tela, com o E2E atual rodando a cada passo                 |
| Navegador apaga os dados                                | Média  | Alto    | Exportação antes do modo pessoal; pasta automática onde houver; lembrete |
| Migração local falha no aparelho de alguém, sem volta   | Baixa  | Alto    | Cópia de segurança antes de migrar; migrações só para a frente           |
| Pacote malicioso na importação                          | Média  | Alto    | Limites de tamanho e de arquivos, caminhos conferidos, tudo por Zod      |
| Chave de API exposta por script na página               | Baixa  | Alto    | Política de conteúdo restrita; nada de terceiros carregado em execução   |
| Memória do PGlite derruba a aba no celular              | Alta   | Alto    | Prova C antes de tudo; o HANDOFF mediu picos perto de 1 GB em Node       |
| Espaço insuficiente no iPhone                           | Média  | Médio   | Prova C; áudio guardado opcional                                         |
| Preço de modelo desatualizado                           | Alta   | Baixo   | Valor tratado como estimativa, com a data do preço; tabela editável      |
| Fechar a aba no meio da geração de cards                | Alta   | Baixo   | Fila retomável; a chamada interrompida pode ser cobrada duas vezes       |
| Provedor de IA recusa chamada do navegador              | Média  | Baixo   | Só listar provedor testado no modo pessoal                               |
| Três chaves para cadastrar afastam quem só quer estudar | Alta   | Médio   | App útil sem nenhuma chave: importação de pacote e envio manual          |

## 7. Decisões pendentes

Bloqueiam a etapa indicada, não o começo do trabalho.

| Decisão                                           | Bloqueia | Recomendação                                            |
| ------------------------------------------------- | -------- | ------------------------------------------------------- |
| Senha perdida no modo pessoal: como redefinir     | 8        | Redefinir mantendo o estudo e apagando as chaves de API |
| Áudio no modo pessoal                             | 8        | Voz do navegador, mais Kokoro próprio para quem tiver   |
| Moeda da tela de uso                              | 4        | Dólar, que é como os provedores cobram                  |
| Estimativa de custo antes de operações grandes    | 4        | Sim, para geração de temporada inteira                  |
| Importar dados pessoais em conta com outro e-mail | 7        | Permitir, com confirmação explícita                     |
| Interpretação do tipo 1 ("só tempos")             | 10       | Confirmar antes de estimar                              |
| Domínio definitivo                                | 9        | Escolher antes da primeira divulgação                   |

## 8. Regras do projeto que este plano toca

- **Isolamento entre usuários:** a tabela de uso da IA entra na lista de tabelas individuais e ganha teste de
  isolamento. O modo pessoal mantém o `userId` da sessão em todo caso de uso.
- **Segurança:** o cookie `HttpOnly` não existe no modo pessoal; a regra precisa descrever a sessão local.
  A chave mestra em `master-key.txt` também não: as chaves passam a ser cifradas com chave derivada da senha.
- **Metadados externos:** hoje a regra diz que o TMDB só é chamado no servidor. No modo pessoal a chamada sai
  do navegador com a chave da própria pessoa. O que continua proibido é chave do projeto no bundle.
- **Processamento:** a fila retomável precisa caber na regra de jobs, sem timer no processo web.
- **Conteúdo e direitos:** a exportação carrega texto e áudio de obras reais. Vale para cópia pessoal;
  publicar pacotes é redistribuição e precisa de revisão antes de ser incentivado.
- **Protótipo:** uso da IA, escolha de provedor, pasta de cópia de segurança, importar e exportar e aviso de
  versão nova são telas novas. Entram no `deixa.html` e são aprovadas antes de construir.

Cada mudança de regra segue a ordem do projeto: `.contexts/` primeiro, ativador em `.claude/` depois, e um
ADR para o que virar regra permanente (PGlite, borda única, AI SDK, medição de custo, formato de pacote).

## 9. Próximo passo

Aprovar este plano e começar pela etapa 0, com as etapas 2 e 3 em paralelo se houver interesse em ter custo e
vários provedores logo no modo família.

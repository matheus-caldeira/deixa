# Plano: fases 01 (Fundação e catálogo) e 02 (Leitura e marcador)

Atualizado conforme o trabalho avança. `[x]` concluído, `[ ]` pendente.

| #   | Tarefa                                                                                  | Critério de pronto                                                                                  | Estado |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| 00  | Repositório, `.gitignore`, `.claude/` e `.contexts/` adaptados, plano e diário          | `git check-ignore` confirma `.env` e `.env.tmdb`; primeiro commit só com documentação               | [x]    |
| 01  | Scaffold: Next, TypeScript estrito, Tailwind, ESLint, Vitest, compose, `env.ts`, `.env` | `pnpm typecheck`, `lint`, `test` e `build` passam; Postgres de pé; `.env` criado sem exibir valores | [x]    |
| 02  | Design system: tokens, classes do protótipo, ícones, fontes                             | Tokens claro/escuro idênticos ao `:root` do protótipo; ícones como componentes                      | [x]    |
| 03  | Schema e migrações                                                                      | `pnpm db:migrate` cria todas as tabelas das fases 01 e 02                                           | [x]    |
| 04  | Identidade: senha, sessão, entrar, criar conta, preferências                            | Teste unitário de senha e sessão; rotas protegidas redirecionam para `/login`                       | [x]    |
| 05  | Catálogo e metadados: `MetadataProvider`, fake, TMDB, sincronização, cadastro manual    | Unitários do mapeamento e dos casos de uso; integração com o TMDB real passa ou é pulada            | [x]    |
| 06  | Legendas: parser SRT, validação, SHA-256, storage em `data/`                            | Unitários do parser e da decodificação                                                              | [x]    |
| 07  | Alinhamento EN ↔ PT                                                                     | Unitários 1:1, 1:N, N:1, deslocamento fixo, sem par                                                 | [x]    |
| 08  | Importação com deduplicação e estados do episódio                                       | Unitário: reenvio devolve duplicidade sem reprocessar; fixtures EN/PT                               | [x]    |
| 09  | Leitura e marcações: visão do episódio, agrupamento, sincronização, contagem anônima    | Unitários do agrupamento e do isolamento                                                            | [x]    |
| 10  | IA: `LlmProvider` (fake e Gemini), chave por usuário cifrada                            | Unitários de cifra, máscara e validação da saída                                                    | [x]    |
| 11  | Cards e revisão: gerar, salvar (só para mim / catálogo), agendar, notas                 | Unitários de reuso, isolamento e intervalos                                                         | [x]    |
| 12  | Áudio: `TtsProvider` (Kokoro e silencioso), cache por hash, endpoint                    | Unitário: segundo pedido vem do cache; Kokoro testado de verdade ou registrado no diário            | [x]    |
| 13  | Gamificação mínima e retrato de demonstração                                            | XP por eventos somado ao retrato; Início, Conversar e Progresso com dados de seed                   | [x]    |
| 14  | Container, logger, instrumentação, seed                                                 | `pnpm db:seed` idempotente; provider ativo logado sem valores                                       | [x]    |
| 15  | Interface: shell, entrar, Início, Explorar, detalhe, envio                              | Telas iguais ao protótipo em 390×844                                                                | [x]    |
| 16  | Interface: leitura e marcador, geração de cards, Revisar                                | Três modos, busca, marcador, cards e revisão funcionando                                            | [x]    |
| 17  | Interface: Conversar, Progresso, perfil, atribuição TMDB                                | Telas com dados de seed; aviso do TMDB visível                                                      | [x]    |
| 18  | Integração (Postgres) e teste de bundle                                                 | Isolamento e deduplicação no banco real; token ausente de `.next/static`                            | [x]    |
| 19  | E2E Playwright                                                                          | Fluxo completo passa com providers fake                                                             | [x]    |
| 20  | Validação visual                                                                        | Screenshots claro/escuro comparados ao protótipo; diferenças corrigidas                             | [x]    |
| 21  | README e fechamento                                                                     | Como subir, variáveis do TMDB, credenciais de seed                                                  | [x]    |

## Fora desta etapa (registrado para a fase 03 em diante)

- Áudio dos itens da trilha no processamento: depende da seleção pedagógica (fase 03); hoje todo áudio é sob demanda.
- Pré-geração das 2–3 falas seguintes à que foi tocada.
- Roteiro e busca de transcrição por IA (o campo aparece desabilitado no envio).
- Worker separado: a importação roda dentro da requisição.
- Troca de versão de uma legenda já publicada.

## Segunda rodada (pedidos depois do primeiro teste no celular)

| #   | Tarefa                                                                    | Critério de pronto                                             | Estado |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| 22  | Fotos do TMDB (pôster, fundo, imagem de episódio) e catálogo só pelo TMDB | Seed cadastra pela API; cadastro manual removido               | [x]    |
| 23  | "Continuar estudando": trilha por cenas e sessão de estudo por nível      | Lição completa no e2e; XP no servidor, sem XP ilimitado        | [x]    |
| 24  | PWA online-first                                                          | Manifesto, ícones, service worker sem guardar páginas de conta | [x]    |
| 25  | Folha de perfil fecha e não rola a página atrás; sem seleção de texto     | Botão de fechar coberto no e2e                                 | [x]    |
| 26  | Entrada só com e-mail e senha, mais "Criar conta"                         | Sem lista de perfis                                            | [x]    |
| 27  | Tela "Quem está estudando" ao tocar em XP ou sequência                    | Nome, nível, ofensiva e XP                                     | [x]    |
| 28  | Gamificação calculada: sequência, XP, semana, mapa de dias, missões       | Unitários do cálculo no fuso da conta                          | [x]    |

## Terceira rodada (pedidos depois do segundo teste)

| #   | Tarefa                                                                                | Critério de pronto                                                        | Estado |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| 29  | Cards em segundo plano com sino de notificações                                       | Tela não trava; aviso "Seus cards estão prontos"; coberto no e2e          | [x]    |
| 30  | Oito legendas fictícias distintas e seed fixo                                         | Cada episódio do seed com diálogo diferente; trilhas em `fixtures/plans/` | [x]    |
| 31  | Alternativas normalizadas e escuta com opções parecidas                               | Tudo em minúsculas; opções de escuta com tamanho próximo                  | [x]    |
| 32  | Trilha, blocos e questões por IA conforme o nível                                     | Plano por episódio e nível, validado e guardado; reserva sem chave        | [x]    |
| 33  | Mínimo de acerto, XP só por acertos, desafio final                                    | 70% para concluir; reprovação sem XP; desafio cobre o episódio            | [x]    |
| 34  | Todo erro entra na revisão                                                            | Erros de lição e correções do tutor viram cards disponíveis               | [x]    |
| 35  | Antecipar a próxima revisão                                                           | 10 cartões por vez, espera crescente, teto diário                         | [x]    |
| 36  | Conversar por temas, texto e áudio, com avaliação em tempo real e revisão da conversa | Testado com Gemini real e com tutor simulado no e2e                       | [x]    |
| 37  | Explorar: todas as temporadas e botão de adicionar no título                          | Seletor de temporadas carrega episódios do TMDB                           | [x]    |

## Etapa 2: legendas a partir do OpenSubtitles

Detalhes em [STAGE-2-SUBTITLES.md](STAGE-2-SUBTITLES.md). Branch `feat/opensubtitles`.

| Nº  | Item                                                               | Critério de pronto                                                    | Estado |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------ |
| 38  | Antecipação de revisão sem limite                                  | Sem teto diário nem espera                                            | [x]    |
| 39  | Notificação de cards some depois de usada                          | Sino lista só as não lidas                                            | [x]    |
| 40  | Origem da legenda no banco, cache de busca e cota                  | Migração 0010 aplicada                                                | [x]    |
| 41  | Ranqueamento e par EN/PT do mesmo release                          | Testes unitários                                                      | [x]    |
| 42  | Adapter do OpenSubtitles (busca, download, login opcional, cota)   | Testes unitários com respostas roteirizadas; busca real na integração | [x]    |
| 43  | "Buscar legendas" como passo padrão, importação só com confirmação | E2E com provider falso; screenshots 390×844 claro e escuro            | [x]    |
| 44  | Origem da legenda na leitura e citação no "Sobre"                  | Visível no e2e                                                        | [x]    |
| 45  | Teto de downloads por usuário e intervalo para refazer a busca     | Testes unitários, inclusive pedidos simultâneos                       | [x]    |
| 46  | Validação real                                                     | 1 episódio importado, 2 downloads gastos                              | [x]    |

## Etapa 3: sugestões personalizadas

Branch `feat/recommendations`. Descrição em [HANDOFF.md](HANDOFF.md), seção 5.

| Nº  | Item                                                               | Critério de pronto                                              | Estado |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------- | ------ |
| 47  | Obras relacionadas e populares no `MetadataProvider`               | TMDB e fake; typecheck                                          | [x]    |
| 48  | Retrato do aluno, vetores e ranqueamento                           | Testes unitários                                                | [x]    |
| 49  | Atualização em segundo plano com IA opcional e reservas locais     | Testes unitários (IA inválida, vetores fora do ar, simultâneo)  | [x]    |
| 50  | Tabelas de sugestões, recusas e vetores                            | Migração 0012; teste de isolamento no Postgres                  | [x]    |
| 51  | "Para você" no Explorar: motivo, adicionar e "não tenho interesse" | E2E com provider falso                                          | [x]    |
| 52  | Validação real                                                     | Sugestões com TMDB, vetores e texto do Gemini na conta de teste | [x]    |

## Etapa 4: chaves por usuário

Branch `feat/user-credentials`. Detalhes em [HANDOFF.md](HANDOFF.md), seção 3.3 B.

| Nº  | Item                                                          | Critério de pronto                                     | Estado |
| --- | ------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| 53  | Chaves de Gemini, TMDB e OpenSubtitles por usuário            | Testes unitários e de integração com isolamento        | [x]    |
| 54  | Chave global opcional, só para o administrador                | Teste de permissão; primeira conta é administradora    | [x]    |
| 55  | Providers resolvidos por usuário (usuário → global → reserva) | Suíte completa passando                                | [x]    |
| 56  | Chave mestra em `master-key.txt`, criada sozinha              | Testes unitários; fora do git e do bundle              | [x]    |
| 57  | Alerta de chave ilegível                                      | Teste unitário com chave mestra trocada; visto na tela | [x]    |
| 58  | Perfil com as três chaves e a seção global                    | E2E; chaves reais e falsas testadas contra os serviços | [x]    |

## Etapa 5: configuração do banco na primeira abertura

Branch `feat/database-setup`. Detalhes em [HANDOFF.md](HANDOFF.md), seção 3.3 A.

| Nº  | Item                                                  | Critério de pronto                                       | Estado |
| --- | ----------------------------------------------------- | -------------------------------------------------------- | ------ |
| 59  | Prova do banco embutido (PGlite)                      | Suíte de integração passou; descartado pela memória      | [x]    |
| 60  | App sobe sem banco e leva a `/setup`                  | E2E numa instância sem banco; banco fora do ar conferido | [x]    |
| 61  | Código de configuração em arquivo local               | Testes unitários; código errado recusado no e2e          | [x]    |
| 62  | Detecção de Postgres local e recomendação de instalar | Teste unitário da sondagem                               | [x]    |
| 63  | Conectar, criar o banco, migrar e guardar o endereço  | E2E até a primeira conta, que vira administradora        | [x]    |

## Etapa 6: seed sem credenciais

| Nº  | Item                                                         | Critério de pronto                                                     | Estado |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ------ |
| 64  | Catálogo fixo com identificadores reais do TMDB              | `fixtures/catalog.json` versionado; teste unitário                     | [x]    |
| 65  | Seed sem `.env`: catálogo fixo, legendas e trilhas fictícias | Rodado num banco novo sem variáveis: 7 obras, 15 episódios, 45 trilhas | [x]    |

## Etapa 7: configurações do servidor no banco

| Nº  | Item                                                 | Critério de pronto                                          | Estado |
| --- | ---------------------------------------------------- | ----------------------------------------------------------- | ------ |
| 66  | Tabela `app_settings` e casos de uso só para o admin | Testes unitários; migração 0014                             | [x]    |
| 67  | Seção de configurações do servidor no perfil         | E2E: valor inválido recusado, valor salvo persiste          | [x]    |
| 68  | Mudança vale sem reiniciar                           | Conferido: tirar o Kokoro troca a voz para silêncio na hora | [x]    |

## Etapa 8: casca nativa (Tauri), primeira parte

Branch `feat/desktop-shell`. Detalhes e pendências em [HANDOFF.md](HANDOFF.md), seção 3.3 D.

| Nº  | Item                                                   | Critério de pronto                                       | Estado |
| --- | ------------------------------------------------------ | -------------------------------------------------------- | ------ |
| 69  | Projeto Tauri com bandeja, janela, navegador e QR code | Compila; sobe e fica residente no macOS; instância única | [x]    |
| 70  | Teste manual do menu e das janelas                     | Conferido pelo autor                                     | [ ]    |
| 71  | Servidor embutido como sidecar                         | App instalável sobe sem `pnpm dev`                       | [ ]    |

## Etapa 9: sessão do dono na casca

Branch `feat/owner-session`. Detalhes em [HANDOFF.md](HANDOFF.md), seção 3.3 D.

| Nº  | Item                                                | Critério de pronto                                   | Estado |
| --- | --------------------------------------------------- | ---------------------------------------------------- | ------ |
| 73  | Token local da casca e entrada automática como dono | Testes unitários; token errado não entra             | [x]    |
| 74  | "Onde parei" e notificações no menu da bandeja      | Rota de estado conferida com a casca rodando         | [x]    |
| 75  | Aviso nativo para notificação nova                  | Casca permanece estável ao receber um aviso de teste | [x]    |
| 76  | Teste manual do menu e dos avisos na tela           | Conferido pelo autor                                 | [ ]    |

## Etapa 10: CI e release

Branch `feat/ci-release`. Detalhes em [HANDOFF.md](HANDOFF.md), seção 3.3 F.

| Nº  | Item                                                      | Critério de pronto                                           | Estado |
| --- | --------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| 77  | Sobre com autor e contato                                 | Perfil e menu nativo                                         | [x]    |
| 78  | Fluxo de CI (testes e compilação da casca)                | YAML válido                                                  | [x]    |
| 79  | Fluxo de release por tag, com instaladores e hashes       | YAML válido; conferência de versão testada                   | [x]    |
| 80  | Primeira execução real no GitHub                          | CI verde; release `v0.0.1` em rascunho com seis instaladores | [x]    |
| 81  | README de apresentação, licença e guia de desenvolvimento | Links e âncoras conferidos                                   | [x]    |
| 82  | Instaladores testados em cada sistema                     | Conferido pelo autor antes de publicar o release             | [ ]    |

## Etapa 11: provedores de IA, custo e pacotes (branch `feat/ai-providers`)

Plano mestre em `docs/WEB-OFFLINE-PLAN.md`; aqui só o que não depende da versão web.

| #   | Tarefa                                                                                                 | Critério de pronto                                                                                  | Estado |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------ |
| 83  | Protótipo das telas novas no `deixa.html`                                                              | Configurações, Uso da IA, menu Mais, opções do catálogo, importar e exportar, aprovados             | [x]    |
| 84  | IA pelo AI SDK, ainda só Gemini                                                                        | Mesmos ports e prompts; testes existentes passam; teste do cliente com modelo de mentira            | [x]    |
| 85  | Medição de tokens e valor por chamada                                                                  | Evento por chamada; preços por modelo; isolamento no Postgres                                       | [x]    |
| 86  | Limite por dia e por mês com trava total                                                               | Chamada acima do limite recusada em toda operação; padrão fechado para a chave global               | [x]    |
| 87  | Tela Configurações, Uso da IA, menu Mais e perfil enxuto                                               | E2E passa; capturas em 390 e 1280 sem erro                                                          | [x]    |
| 88  | Escolha de provedor e de modelo (Google, OpenAI, Anthropic, OpenRouter, Ollama, compatível com OpenAI) | Dois provedores de ponta a ponta; embeddings por modelo                                             | [x]    |
| 89  | Importar e exportar: formato, legendas, dados pessoais, cards, áudio                                   | Reimportar não duplica; pacote adulterado recusado; isolamento                                      | [x]    |
| 90  | Opções do catálogo e tela Importar e exportar; menu Arquivo do Tauri                                   | Conforme o protótipo                                                                                | [x]    |
| 91  | Pacote pessoal cifrado (preferências, progresso, marcações, cards, histórico) com e-mail e senha       | Exportar e importar na outra conta sem duplicar; senha errada e arquivo adulterado dão o mesmo erro | [x]    |
| 92  | Postgres embutido na instalação local (ADR 0017)                                                       | Assistente instala, sobe e grava a conexão; para no SIGTERM e volta no reinício                     | [x]    |

## Etapa 12: interface em N idiomas (frente A)

| #   | Tarefa                                                                                   | Critério de pronto                                                           | Estado |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| 93  | `next-intl` sem rotas por idioma; `locales/pt-BR.json` e `locales/en.json`               | Idioma por cookie, navegador e preferência da conta; `<html lang>` acompanha | [x]    |
| 94  | Toda a interface por chaves (telas, folhas, setup, configurações, transferência)         | Nenhum texto em português fora de `locales/`, seed e fakes                   | [x]    |
| 95  | `AppError` só com código e detalhe; borda traduz                                         | Mensagens de erro trocam de idioma; módulos sem frases                       | [x]    |
| 96  | Dado gravado sem frase: notificações, passos, falhas, retrato, motivos, títulos de bloco | Migração 0018; notificações antigas aparecem no idioma atual                 | [x]    |
| 97  | Prompts em inglês com o idioma da interface como idioma nativo                           | Explicações, tutor, trilha e sugestões respondem no idioma da conta          | [x]    |
| 98  | Idioma no perfil; teste de paridade dos JSON; e2e trocando de idioma                     | `messages.unit.test.ts` falha com chave faltando; `language.spec.ts` passa   | [x]    |

Pendente desta etapa: menus nativos da casca (Tauri) no idioma da conta.

## Etapa 13: estudo em N idiomas (frente B)

| #   | Tarefa                                                                             | Critério de pronto                                                                                  | Estado |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| 99  | Par por conta: idioma base e de estudo, pares com nível, troca no perfil, cadastro | Migração 0019; contas existentes ganham o par inglês → nativo; cadastro pede os dois idiomas        | [x]    |
| 100 | Catálogo por idioma: idioma original da obra, legenda e alinhamento por idioma     | Importar ES + PT e depois EN no mesmo episódio lê os três pares; leitura só com a legenda de estudo | [x]    |
| 101 | Vozes do Kokoro por idioma; sotaque só para inglês                                 | Fala usa a voz do idioma da legenda; item e tutor usam a do idioma de estudo                        | [x]    |
| 102 | Prompts e nível por par                                                            | Explicações, tutor, trilha e sugestões recebem o par; o QECR vale para os quatro idiomas            | [x]    |
| 103 | Cards, trilhas e sugestões filtrados pelo par ativo                                | Trocar o par troca a fila inteira; e2e `languages.spec.ts` passa                                    | [x]    |
| 104 | OpenSubtitles e pacotes carregam o par                                             | Busca nos idiomas do par; pacote guarda o idioma de legenda, card e marcação                        | [x]    |

Pendente desta etapa: validar com uma legenda real em espanhol e francês no OpenSubtitles e ouvir as vozes
`ef_dora`, `ff_siwis` e `pf_dora` no Kokoro (lista em `docs/TESTES-MANUAIS.md`).

## Etapa 14: progresso com fonte real (fase 04 restante)

| #   | Tarefa                                                                       | Critério de pronto                                                                  | Estado |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| 105 | Tentativa de lição grava acertos por tipo de exercício                       | `lesson_attempts.kinds` preenchido ao concluir a lição                              | [x]    |
| 106 | Perfil calculado: nível, acertos, habilidades, erros recorrentes, conquistas | Sem `progress_snapshots`; teste unitário das fórmulas; erros recorrentes na Revisão | [x]    |

## Etapa 15: worker separado, áudio em lote e roteiro (fase 03 restante)

| #   | Tarefa                                                                       | Critério de pronto                                                                                       | Estado |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 107 | Fila `job_queue` com `SKIP LOCKED`, tentativas e dois modos (inline, worker) | Trilha, cards e sugestões saem do `after()` direto; `pnpm worker` consome; integração com dois claims    | [x]    |
| 108 | Áudio em lote do episódio depois da importação                               | Job `episode_audio` gera o que falta no cache e avisa no sino; etapa da importação diz "na fila"         | [x]    |
| 109 | Roteiro `.txt` conferido contra a legenda e falas completadas na leitura     | `episode_scripts` e `script_lines`; e2e envia `.srt` + `.txt` e vê "Roteiro conferido" e a fala completa | [x]    |

## Etapa 16: retorno do teste no celular e no Windows (16/10/2026)

| #   | Tarefa                                                                  | Critério de pronto                                                                                       | Estado |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 110 | Sons de acerto, erro e seleção na lição                                 | Web Audio, sem arquivo; acerto e erro ao conferir, toque neutro ao escolher opção ou palavra             | [x]    |
| 111 | Aviso ao sair da lição com progresso                                    | Folha "Sair da lição?" no X; aviso do navegador ao fechar ou recarregar                                  | [x]    |
| 112 | Ordem dos exercícios e das opções muda a cada abertura                  | Semente nova por abertura; a correção refaz a mesma ordem no servidor; teste de domínio e de caso de uso | [x]    |
| 113 | Seletor do OpenSubtitles: opções legíveis e sugestão sempre na lista    | Opções em uma coluna; a sugestão entra entre as 8 exibidas                                               | [x]    |
| 114 | Tutor no idioma de estudo, com resumo do aluno e cartão na Início       | Conversa guarda o idioma (migração 0022); abertura nos 4 idiomas; prompt recebe revisões e erros         | [x]    |
| 115 | Windows: confirmar a escolha do banco e extrair o Postgres sem o `PATH` | Botão Confirmar; `tar.exe` pelo caminho do `System32`; casca repassa o `PATH`                            | [x]    |

## Etapa 17: conversa encerrada e série pessoal (detalhes em `docs/CONVERSATION-REVIEW-DRAFT.md`)

Protótipo: `docs/conversation-review-poc.html` (`pnpm poc`).

| #   | Tarefa                                                                                       | Critério de pronto                                                                                                                                                                                                               | Estado |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 116 | Encerrar conversa, com ou sem avaliação: `closed_at`, recusa de mensagem, tela só de leitura | Migração; `sendMessage` em sessão fechada dá `conversationClosed`; folha com as duas saídas; compositor vira barra de leitura; teste de caso de uso e de isolamento                                                              | [x]    |
| 117 | Revisão em segundo plano com dificuldades e escolha de cards                                 | Job `conversation_review` com `review_status` e aviso no sino; uma chamada em lote validada por Zod; "Avaliar agora" e "Tentar de novo"; correções param de virar card na hora; cards só dos itens marcados; repetir não duplica | [x]    |
| 118 | Série pessoal: id fixo, nome, nível (fixo ou customizado), temporada por nível               | Tabelas `personal_series`, `personal_seasons`, `personal_episodes`, `personal_episode_cards`; renomear e trocar nível; isolamento por conta e par                                                                                | [x]    |
| 119 | Distribuição dos cards em episódios por tema                                                 | Revisão mostra "Na sua série"; LLM devolve episódio existente ou novo; id inventado vira episódio novo; único por temporada, tema e parte                                                                                        | [x]    |
| 120 | Trilha e lição de cada episódio                                                              | `TrailLine` de origem `personal_card`; card novo regera a trilha em job sem apagar progresso                                                                                                                                     | [x]    |
| 121 | Temporada seguinte pelo percentual de nível                                                  | Job abre a temporada do próximo nível ao passar de 80% ou ao subir de nível; temporada travada mostra os temas previstos                                                                                                         | [x]    |
| 122 | Descrição da série escrita pela IA                                                           | Job depois de cada revisão; texto limpo e limitado; data e base da atualização na tela                                                                                                                                           | [x]    |
| 123 | Áudio da conversa e modo escuta                                                              | Falas do tutor e falas corrigidas no cache do Kokoro por job; "Ouvir tudo" e "Escutar" com texto escondido                                                                                                                       | [x]    |
| 124 | Série pessoal no pacote pessoal (`.deixa.zip`)                                               | Exporta série, temporadas, episódios, cards e progresso; importar junta na série do par sem duplicar episódio de mesmo tema                                                                                                      | [x]    |

## Próximo

Ordem decidida em 14/10/2026 (detalhes em `docs/LANGUAGES-DRAFT.md`):

1. Confirmar a 0.0.5 no Windows: janela de console oculta e Postgres embutido instalando (lista em
   `docs/TESTES-MANUAIS.md`).
2. ~~Interface em N idiomas (frente A)~~ Pronta na etapa 12.
3. ~~Estudo de N idiomas (frente B)~~ Pronta na etapa 13.
   Antes: estudo de N idiomas (frente B)
4. ~~Fase 04 restante: percentual de nível, habilidades e erros recorrentes com fonte real.~~ Pronta na etapa 14.
   Antes: fase 04 restante: par base → estudo por conta entre inglês, português, espanhol e francês,
   com mais de um par por conta e um ativo por vez.
5. Fase 04 restante: percentual de nível, habilidades e erros recorrentes com fonte real.
6. ~~Fase 03 restante: worker separado, áudio em lote, roteiro.~~ Pronta na etapa 15 (sem PDF e sem busca de
   transcrição por IA).
7. Versão web offline (etapas 0, 6, 8 e 9 de `docs/WEB-OFFLINE-PLAN.md`), que herda as frentes A e B prontas.
8. Fase 06: fala em tempo real, HTTPS para PWA e microfone.

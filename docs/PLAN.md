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

## Próximo

- Etapa do OpenSubtitles (seção 16 do PROJETO.md), deixada por último a pedido do autor.
- Fase 03 restante: worker separado, áudio em lote, roteiro.
- Fase 04 restante: percentual de nível, habilidades e erros recorrentes com fonte real.
- Fase 06: fala em tempo real, limites de uso por conta, HTTPS para PWA e microfone.

---
title: Escopo do produto
updated: 2026-10-10
source: PROJETO.md §3, §5, §7, §15
---

# Escopo

## Navegação

Barra inferior com cinco áreas e topo fixo com avatar, nível, sequência e XP do dia.

| Área      | Conteúdo                                                                                       | Estado nas fases 01 e 02      |
| --------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| Início    | Continuar estudando, Ler episódio e marcar, meta do dia, trilha, revisões, missões             | Real + dados de demonstração  |
| Explorar  | Busca, filtros, em andamento, catálogo, detalhe da obra, envio de legendas                     | Real                          |
| Revisar   | Flashcards vencidos, incluindo os das marcações; erros recorrentes                             | Real (erros: demonstração)    |
| Conversar | Cenários do tutor ordenados pelo nível                                                         | Demonstração                  |
| Progresso | Nível, sequência, XP, expressões, precisão, semana, dias estudados, habilidades, conquistas    | Demonstração                  |

## Fases 01 e 02: o que precisa funcionar

1. Entrar com uma conta; criar conta.
2. Buscar uma obra pelo nome no TMDB, escolher temporada e episódio, ver pôster, sinopse e títulos em pt-BR.
3. Cadastrar manualmente quando a obra não existir no TMDB.
4. Enviar o SRT em inglês e, opcionalmente, o em português; acompanhar o processamento até `READY`.
5. Reenviar o mesmo arquivo e ver a duplicidade detectada, sem reprocessar.
6. Ler o episódio inteiro, com a legenda EN ↔ PT alinhada por tempo, em três modos.
7. Marcar palavras, expressões e falas; buscar uma fala dentro do episódio.
8. Gerar cards a partir das marcações, só para mim ou para o catálogo, e vê-los em Revisar.
9. Ouvir uma fala: áudio gerado no primeiro toque e servido do cache depois.
10. Configurar, testar e remover a chave do Google AI.
11. Dados de um usuário nunca aparecem para outro.

## Fora destas fases

Trilha com lições completas, sessão de estudo, tutor, gamificação calculada, chamada de voz, roteiro e busca de
transcrição por IA. As telas existem com dados de demonstração onde o protótipo já mostra.

## Estados de um episódio

| Estado         | Na interface | Significado                                    |
| -------------- | ------------ | ---------------------------------------------- |
| `NONE`         | Sem legenda  | Cadastrado, sem SRT                            |
| `UPLOADED`     | Processando  | Arquivo recebido                               |
| `PROCESSING`   | Processando  | Em processamento                               |
| `READY`        | Pronto       | Pode ler, marcar e estudar                     |
| `FAILED`       | Falhou       | Pode ser reenviado                             |
| `NEEDS_REVIEW` | Em revisão   | Saída da IA precisa de revisão manual          |

## Critérios de aceite destas fases

- Com a legenda PT, as falas ficam alinhadas por tempo e a tradução das falas não usa LLM.
- Cards "só para mim" nunca aparecem para outro usuário; cards "para o catálogo" aparecem como sugestão, sem
  identificar quem marcou.
- Um segundo usuário escolhe o mesmo episódio e lê sem novo envio.
- O áudio é gerado localmente e reutilizado quando já existe.
- O sistema funciona sem chave de IA, sem TMDB e sem Kokoro, com os providers de reserva.

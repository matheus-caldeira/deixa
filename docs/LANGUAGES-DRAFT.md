---
title: Rascunho — interface em N idiomas e estudo de N idiomas
updated: 2026-10-14
source: conversa de 14/10/2026
---

# Rascunho: interface em N idiomas e estudo de N idiomas

**Estado: rascunho aprovado em 14/10/2026, sem implementação.** Duas frentes, feitas nesta ordem: a interface
primeiro (A), porque a segunda (B) mexe nos mesmos textos e seria traduzida duas vezes.

## Decisões tomadas

| Decisão                                                                                                          | Motivo                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Interface em pt-BR e inglês primeiro; os demais entram como JSON novo, sem código                                | Dois idiomas bastam para provar a estrutura                                |
| A pessoa escolhe o idioma base e o idioma de estudo entre inglês, português, espanhol e francês, em qualquer par | Os quatro seguem o mesmo padrão (QECR, voz no Kokoro, legendas abundantes) |
| Uma conta pode estudar mais de um idioma, com um par ativo por vez                                               | Cards, marcações, progresso e XP ficam separados por idioma de estudo      |
| Japonês, chinês e outros sem QECR ou sem separação por espaços ficam para depois                                 | Exigem escala de nível e tokenização próprias                              |

## Situação atual (medida em 14/10/2026)

- Cerca de 345 textos fixos em `src/ui`, 50 em pages e actions, 54 arquivos de `modules` e `infrastructure` com
  mensagens em português (erros `AppError`, rótulos, passos do processamento) e os prompts da IA, que dizem
  "professor de inglês para brasileiros".
- O par inglês → português está preso ao domínio em 224 pontos: `SubtitleLanguage = "en" | "pt-BR"`, alinhamento
  "EN com PT", vozes `af_heart`/`bf_emma` (inglês americano e britânico), pedidos ao OpenSubtitles, faixa de nível
  das obras pensada para inglês.
- `user_preferences.native_language` já existe (sempre `pt-BR` hoje); não há idioma de estudo.

## Frente A: interface em N idiomas

1. `locales/<idioma>.json`, um arquivo por idioma, chaves agrupadas por tela (`settings.usage.title`…).
2. `next-intl` na interface (plural, datas, números; funciona em componentes de servidor e cliente) e no servidor
   para o que chega ao cliente.
3. `AppError` carrega só `code` e parâmetros; a borda traduz (`actions/result.ts` já faz parte disso).
4. Rótulos de domínio (`OPERATION_LABELS`, `SERVICE_LABELS`, `LEVEL_NAMES`, passos do processamento) viram chaves.
5. Idioma da interface: preferência da conta; antes de entrar, o do navegador.
6. Prompts da IA parametrizados pelo idioma da interface na parte "responda em…".
7. Teste: um teste que lê todos os JSON e falha se alguma chave faltar num idioma; e2e roda em pt-BR.

Critério de pronto: nenhum texto em português fora de `locales/`; trocar o idioma no perfil troca a interface
inteira, inclusive mensagens de erro.

## Frente B: estudo de N idiomas

1. **Par por conta**: `targetLanguage` ao lado de `nativeLanguage`; tabela de pares da conta com o ativo.
   Tudo que diz "EN" vira "idioma de estudo" e "PT" vira "idioma nativo".
2. **Catálogo por idioma**: a obra guarda o idioma do áudio original; a legenda existe por idioma (a tabela já
   tem `language` livre); episódio "pronto" é por par. O alinhamento fica entre a legenda de estudo e a nativa.
3. **Vozes**: tabela idioma → vozes do Kokoro (inglês, espanhol, francês, português têm); sotaque vira escolha por
   idioma.
4. **IA e nível**: prompts recebem o par; o QECR vale para os quatro idiomas.
5. **Dado individual por par**: cards, marcações, progresso, XP, trilhas e sugestões filtram pelo idioma de
   estudo ativo; trocar o par no perfil troca a revisão inteira.
6. **OpenSubtitles e pacotes**: pedidos e `.deixa.zip` carregam o par; o pacote pessoal guarda o idioma em cada
   item.

Critério de pronto: uma conta estuda inglês e espanhol ao mesmo tempo sem misturar revisões; uma conta com base
inglês estuda português.

## Ordem das frentes (atualiza `docs/PLAN.md`)

1. Confirmar a 0.0.5 no Windows (janela de console, Postgres embutido).
2. Frente A.
3. Frente B, camadas 1 e 2 com inglês e espanhol; depois 3 a 6 e os quatro idiomas.
4. Progresso com fonte real e o restante da fase 03.
5. Versão web offline, que herda tudo pronto.

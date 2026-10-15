---
title: "ADR 0019: Estudo em N idiomas"
updated: 2026-10-15
source: conversa de 14/10/2026 e docs/LANGUAGES-DRAFT.md
status: aceita
---

# ADR 0019: Estudo em N idiomas

## Contexto

O produto nasceu preso ao par inglês → português: `SubtitleLanguage = "en" | "pt-BR"`, alinhamento "EN com
PT", vozes só em inglês, pedidos ao OpenSubtitles fixos em `en,pt-br`, prompts "para brasileiros". A pessoa
precisa escolher o idioma base e o idioma que quer aprender, entre inglês, português, espanhol e francês, em
qualquer par, e uma conta pode estudar mais de um idioma sem misturar revisões.

## Decisão

- **Par por conta.** `user_preferences.native_language` e `target_language` guardam o par ativo;
  `user_language_pairs` guarda todos os pares da conta com o nível de cada um. Trocar o par no perfil troca
  nível, revisão, trilha e sugestões; o cadastro pede idioma base, idioma de estudo e nível. Os idiomas vivem
  em `src/shared/study-languages.ts` (`STUDY_LANGUAGES`, `LanguagePair`, `pairKey`).
- **Catálogo por idioma.** A obra guarda `original_language` (do TMDB); a legenda já era por idioma; o
  episódio fica `READY` com qualquer legenda e a interface só libera leitura e estudo quando existe a legenda do
  idioma de estudo. O alinhamento é calculado entre cada par de legendas de idiomas diferentes do episódio
  (`cue_alignments.source_cue_id` + `target_language`), nos dois sentidos; a tradução por IA é guardada por
  `(cue_id, locale)`.
- **Caso de uso recebe o par.** `getEpisodeScript(episodeId, pair)` e tudo que deriva dele (leitura,
  marcações, cards, trilha, tradução) recebem `pair` do `userId` da sessão; o container resolve o par da
  conta para prompts, fontes e áudio.
- **Dado individual por par.** `learning_items.language` e a explicação por `locale` filtram cards e
  sugestões do catálogo; `lesson_plans` e `lesson_attempts` têm `language_pair`; marcações já são por fala (e
  a fala pertence a uma legenda). XP, sequência e progresso do episódio continuam por conta.
- **Vozes por idioma.** `VOICES_BY_LANGUAGE` no domínio de áudio: inglês (americano e britânico pela
  preferência de sotaque), português, espanhol e francês com uma voz do Kokoro cada; a fala usa a voz do
  idioma da legenda, o item e o tutor usam a do idioma de estudo.
- **Fontes e pacotes.** O OpenSubtitles é pedido nos idiomas do par e o ranqueamento devolve `target`/`native`;
  o `.deixa.zip` carrega o idioma de cada legenda, de cada card e de cada marcação (com padrão `en`/`pt-BR`
  para pacotes antigos). Sugestões buscam obras populares no idioma de estudo e a impressão digital inclui o
  idioma.

## Consequências

- Migração 0019: par ativo e tabela de pares (preenchida com `en` → idioma nativo para as contas existentes),
  `original_language`, alinhamento por idioma (colunas renomeadas, nada apagado), chave composta das traduções,
  `language` em itens, `language_pair` em planos e tentativas.
- Teste unitário importa espanhol → português e depois inglês no mesmo episódio e lê os três pares; o e2e
  `languages.spec.ts` cria uma conta espanhol a partir do português, importa, lê, marca, revisa e troca para
  inglês sem misturar a fila.
- Textos da interface que citavam "inglês"/"PT" passaram a receber o par como parâmetro.
- Os identificadores `subtitle_pt`, `exampleEnglish` e `examplePortuguese` continuam como estão: são valores
  gravados; significam "da legenda nativa", "exemplo no idioma de estudo" e "exemplo no idioma base".

## Alternativas descartadas

- Status do episódio por par: exigiria uma tabela de estado por idioma; a lista de idiomas das legendas
  resolve a interface.
- Uma conta por idioma de estudo: duplicaria sequência, XP e chaves de IA.
- Alinhar só o par ativo na importação: outro aluno com outro par teria de reprocessar; alinhar todos os
  pares é barato (função pura por tempo).

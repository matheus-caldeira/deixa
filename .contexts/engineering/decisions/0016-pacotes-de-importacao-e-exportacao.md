---
title: "ADR 0016: Pacotes de importação e exportação"
updated: 2026-10-13
source: docs/OFFLINE-EXPORT-DRAFT.md e docs/WEB-OFFLINE-PLAN.md
status: aceita
---

# ADR 0016: Pacotes de importação e exportação

## Contexto

Conteúdo precisa sair de uma instalação e entrar em outra (família para pessoal, cópia de segurança) sem
depender de TMDB, OpenSubtitles nem IA. A referência é o Anki: exportar e importar é o que dá vida ao catálogo.

## Decisão

- Um único formato, `.deixa.zip`, com `manifest.json` (versão do formato, app que gerou, lista de arquivos com
  SHA-256), `catalog.json` (obras, temporadas e episódios, identificados por provedor e id externo),
  `subtitles/` (os `.srt` originais), `cards/` (itens de aprendizado do catálogo, ligados à fala pela sequência
  da legenda em inglês) e `audio/` com índice. O módulo `packages` lê e grava o formato; os demais módulos
  entram por ports.
- Importar não pede o tipo do conteúdo: o pacote traz tudo. A pessoa vê a prévia (o que é novo e o que já
  existe) e confirma. O arquivo enviado fica em `data/packages/<usuário>/` até a confirmação, e só quem enviou
  consegue importá-lo.
- O que já existe não é sobrescrito: obra por `(provedor, id externo)`, episódio por número, legenda pelo
  caminho já existente de importação (deduplicada por hash; outra legenda no mesmo episódio vira aviso), card
  por fala e tokens, áudio por hash e voz. Importar duas vezes não duplica nada.
- Pacote adulterado, sem manifesto, com arquivo faltando ou de versão mais nova é recusado antes de gravar.
- Exportação por obra, temporada ou episódio, escolhendo legendas, cards do catálogo e áudio. Cards privados
  não saem; dados pessoais ficam para o pacote pessoal cifrado (fora desta decisão).

## Consequências

- Legenda e áudio de obras reais viajam no pacote: serve como cópia pessoal; redistribuir é problema de
  direitos, dito na interface.
- Tudo em memória, com teto de 1 GB; exportar temporada com áudio pode ficar pesado até o modo em fluxo.
- Cards importados entram como sugestão do catálogo, não direto na revisão de ninguém.

## Alternativas descartadas

- Exportação "só tempos", sem texto (tipo 1 do rascunho): exige reconstruir trilhas e cards a partir da legenda
  de quem importa; fica para depois.
- JSON único sem ZIP: não comporta áudio nem os `.srt` originais.

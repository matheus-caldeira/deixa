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
  não saem do pacote de catálogo.
- Pacote pessoal: `personal.json` em claro só com e-mail, data e se há chaves; `personal.enc` com preferências,
  marcações, cards com estado e histórico de revisão, progresso, XP, retrato e, opcionalmente, as chaves de
  API. Cifrado com AES-256-GCM e chave derivada por scrypt do e-mail normalizado e da senha, com sal e IV por
  arquivo; senha errada e arquivo mexido dão o mesmo erro. Exportar pede a senha da conta; importar pede a
  senha da conta de origem e entra na conta conectada, somando sem duplicar (marcação por fala e tokens, card
  por item, revisão por data, XP por origem) e mantendo o estado de revisão mais recente. Itens de episódio
  que a instalação de destino não tem ficam de fora e viram contagem no relatório.
- A proteção do pacote pessoal é a da senha: quem tem o arquivo pode tentar senhas sem limite. O scrypt usa
  N=2^17 e r=8 (cerca de 128 MB e perto de um segundo por tentativa) para encarecer isso, e as tentativas
  on-line de senha na exportação e na importação contam no mesmo limite do login.
- Áudio só entra se o hash corresponder a uma fala dos episódios do pacote, com a voz e a versão declaradas:
  um pacote não consegue registrar áudio para texto que não trouxe.
- Importar segue as mesmas permissões de adicionar à mão: qualquer conta cadastra obra e legenda, e os cards do
  pacote entram como sugestão do catálogo, como quando alguém compartilha "para o catálogo".

## Consequências

- Legenda e áudio de obras reais viajam no pacote: serve como cópia pessoal; redistribuir é problema de
  direitos, dito na interface.
- Tudo em memória, com teto de 1 GB; exportar temporada com áudio pode ficar pesado até o modo em fluxo.
- Cards importados entram como sugestão do catálogo, não direto na revisão de ninguém.

## Alternativas descartadas

- Exportação "só tempos", sem texto (tipo 1 do rascunho): exige reconstruir trilhas e cards a partir da legenda
  de quem importa; fica para depois.
- JSON único sem ZIP: não comporta áudio nem os `.srt` originais.

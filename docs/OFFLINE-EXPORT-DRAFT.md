---
title: Rascunho — importar e exportar (versão 100% offline)
updated: 2026-10-12
source: conversa de 12/10/2026
---

# Rascunho: importar e exportar

**Estado: parcialmente implementado em 13/10/2026** (tipos 2, 3 e 4 e a importação sem escolha de tipo, ADR 0016; o tipo 5 e o tipo 1 seguem como rascunho). Este documento guarda a ideia para o plano da versão que
funciona 100% offline. A referência é o Anki: o que dá vida ao Anki é poder exportar e importar baralhos.

## 1. Objetivo

- Levar conteúdo de uma instalação para outra sem depender de TMDB, OpenSubtitles nem IA.
- Fazer cópia de segurança dos dados de uma pessoa e restaurá-la em outro computador.

## 2. O que foi pedido

Cinco tipos de conteúdo exportável, combináveis:

| Nº  | Tipo                            | O que carrega                                                            |
| --- | ------------------------------- | ------------------------------------------------------------------------ |
| 1   | Só tempos                       | Estrutura do episódio por tempo (início e fim de cada fala), sem o texto |
| 2   | Cards já criados                | Itens de aprendizado e explicações                                       |
| 3   | Áudios gerados                  | Arquivos de áudio do cache                                               |
| 4   | Com arquivo de legenda          | Os `.srt` originais em inglês e português                                |
| 5   | Histórico de progresso e perfil | Dados pessoais, com ou sem as chaves de API                              |

Os dados pessoais (tipo 5) saem **cifrados com o e-mail e a senha do usuário**. O formato é um **ZIP**.

### Interpretação do tipo 1, a confirmar

"Importação apenas por tempo" foi lido como: o pacote não leva o texto das falas, só os tempos e o que foi
construído sobre eles (blocos da trilha, posição de cada card). Quem importa precisa ter a própria legenda do
mesmo episódio; o app encaixa o pacote nela pelo tempo. É a forma de compartilhar sem redistribuir legenda.

Se a intenção era outra (por exemplo, exportar só um intervalo de datas), este item muda.

## 3. Alcance de uma exportação

- Um episódio.
- Uma temporada.
- Uma obra inteira (série ou filme).
- Os dados pessoais de uma conta.

## 4. Formato proposto

Um arquivo `.deixa.zip`:

```
manifest.json            versão do formato, data, app que gerou, lista do que há dentro, hashes
catalog/works.json       obras: provedor, identificador externo, título, ano, tipo
catalog/episodes.json    temporadas e episódios: números, títulos, duração
timing/<episódio>.json   falas por tempo: início, fim, cena, hash do texto (tipo 1)
subtitles/<episódio>.<idioma>.srt                                          (tipo 4)
trails/<episódio>.<nível>.json   blocos e exercícios                       (acompanha 1 ou 4)
cards/<episódio>.json    itens de aprendizado e explicações                (tipo 2)
audio/<hash>.wav         áudio, com índice em audio/index.json             (tipo 3)
personal.enc             dados pessoais cifrados                           (tipo 5)
```

Regras:

- `manifest.json` diz a versão do formato. Importar uma versão mais nova que a do app é recusado com mensagem
  clara; versões antigas são migradas na importação.
- Cada arquivo tem o SHA-256 no manifesto. A importação confere antes de gravar qualquer coisa.
- Obra identificada por `(provedor, identificador externo)`, episódio por número de temporada e de episódio.
  É o que já garante que importar duas vezes não duplica.
- Tudo o que entra passa por schema Zod. Conteúdo de pacote é dado, nunca instrução (vale para o que for
  parar em prompt de IA).

## 5. Como cada tipo se encaixa

**Tipo 1, só tempos.** Leva `timing/` e, se escolhido, `trails/` e `cards/` referenciando as falas por tempo e
por hash do texto. Na importação:

- Episódio sem legenda: o pacote fica guardado como pendente até a legenda chegar.
- Episódio com legenda: casa cada fala por tempo, com tolerância para deslocamento fixo (o alinhador atual já
  lida com isso). Hash do texto igual confirma o encaixe; diferente marca o item como "a conferir".

Ponto em aberto: trilha e card têm texto de fala dentro (a frase do exercício, o exemplo do card). "Só tempos"
de verdade exige guardar posições e reconstruir o texto a partir da legenda de quem importa.

**Tipo 2, cards.** Só itens com alcance "catálogo". Card privado de alguém só sai na exportação pessoal dessa
pessoa. Na importação, o card entra como sugestão do episódio, não direto na revisão de ninguém.

**Tipo 3, áudios.** O cache já é por hash de texto normalizado + voz + idioma + versão do modelo. Importar é
copiar o arquivo e registrar o hash; áudio com hash desconhecido é ignorado.

**Tipo 4, legendas.** O `.srt` entra pelo mesmo caminho do envio manual (validação, deduplicação por hash,
alinhamento). Episódio que já tem legenda diferente não é trocado.

**Tipo 5, dados pessoais.** Preferências, progresso por episódio, marcações, cards do usuário com o estado de
revisão, histórico de revisões, eventos de XP, conversas com o tutor, sugestões recusadas. Opcionalmente, as
chaves de API.

## 6. Cifra dos dados pessoais

Pedido: cifrar com o e-mail e a senha do usuário.

Proposta:

- Chave derivada com `scrypt` a partir da senha, com o e-mail normalizado e um sal aleatório por arquivo.
- AES-256-GCM, com o cabeçalho (versão, sal, parâmetros do `scrypt`) autenticado junto.
- A senha é pedida na hora de exportar e na de importar. O servidor só guarda o hash da senha, então não dá
  para exportar sem a pessoa digitar.
- Exportar "com chaves": as chaves de API são decifradas com a chave mestra desta instalação e gravadas
  dentro do bloco cifrado. Na importação, são cifradas de novo com a chave mestra da instalação de destino.
- Exportar "sem chaves" é o padrão.

Consequências a aceitar:

- A proteção é tão forte quanto a senha da conta. Senha fraca, arquivo fraco.
- Quem troca a senha depois continua precisando da senha antiga para abrir exportações antigas.
- Senha errada e arquivo adulterado dão o mesmo erro, de propósito.

## 7. Importação

1. Enviar o ZIP. Limites de tamanho total, de quantidade de arquivos e de tamanho descompactado.
2. Ler o manifesto e mostrar o que há dentro, antes de gravar: obras, episódios, tipos de conteúdo, o que já
   existe aqui e o que entraria de novo.
3. A pessoa escolhe o que importar.
4. Gravar por episódio, em transação. Falha num episódio não desfaz os outros; o relatório final diz o que
   entrou, o que foi pulado e por quê.

Regras de conflito:

- Catálogo: o que já existe não é sobrescrito. Reimportar não apaga progresso, marcação nem card de ninguém.
- Dados pessoais: entram na conta de quem está conectado. Em conta que já tem dados, os históricos são
  somados sem duplicar (cada registro tem identificador estável) e o estado de revisão de cada card fica com
  o mais recente.

## 8. Riscos e perguntas em aberto

- **Direitos autorais.** Os tipos 2, 3 e 4 carregam texto ou áudio de falas de obras reais. Para cópia pessoal
  não há problema; publicar pacotes é redistribuição. O tipo 1 existe para contornar isso, mas só resolve se
  trilhas e cards também saírem sem texto. Antes de divulgar a função, decidir o que o app incentiva.
- **Pacote malicioso.** ZIP com caminhos que saem da pasta, bomba de descompactação, JSON enorme, texto feito
  para manipular a IA. A importação precisa tratar o pacote como entrada hostil.
- **Tamanho.** Áudio de uma temporada passa fácil de centenas de MB. Exportar e importar em fluxo, não em
  memória.
- **Encaixe por tempo.** Legendas de releases diferentes têm cortes e tempos diferentes. Definir a tolerância e
  o que fazer quando a taxa de encaixe for baixa.
- **Contas.** O pacote pessoal identifica a pessoa pelo e-mail. Decidir se importar em conta com outro e-mail é
  permitido.
- **Anki.** Exportar os cards do usuário num arquivo que o Anki importa é barato e ficou de fora deste pedido;
  vale reavaliar.

## 9. Ordem sugerida, quando for a hora

1. Formato, manifesto e validação, com a exportação e a importação do tipo 4 (legendas), que reaproveita o
   caminho do envio manual.
2. Tipo 5 sem chaves, com a cifra.
3. Tipos 2 e 3.
4. Tipo 5 com chaves.
5. Tipo 1, que é o mais difícil.

Entrada na interface: itens "Importar…" e "Exportar…" no menu Arquivo da casca e uma seção no perfil.

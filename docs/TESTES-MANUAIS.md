---
title: Testes manuais pendentes
updated: 2026-10-16
source: conversa de 14/10/2026
---

# Testes manuais pendentes

Lista do que só pode ser conferido em aparelho externo (Windows, Linux, celular) ou à mão. Marque `[x]` ao
validar e anote o resultado; o que falhar vira tarefa.

## Windows (release v0.0.6 ou mais nova)

A 0.0.5 falha na instalação do Postgres embutido com `spawn tar ENOENT`; a correção entra na 0.0.6.

- [ ] Na tela de configuração, tocar nas duas opções só muda a seleção; o botão **Confirmar** é que segue.

- [ ] Instalar pelo `.exe` ou `.msi` (SmartScreen: "Mais informações → Executar assim mesmo") e abrir como usuário
      comum, não como Administrador.
- [ ] Nenhuma janela de terminal aparece ao abrir o app nem enquanto ele roda (correção da 0.0.5).
- [ ] Tela de configuração: digitar o código de `setup-code.txt` (pasta de dados do app, em
      `%APPDATA%\app.deixa.desktop`) e escolher **Instalar um Postgres só para o Deixa**.
- [ ] O download (cerca de 23 MB) conclui, o banco é criado e a tela vai para a criação da primeira conta em menos
      de um minuto. Se falhar na extração, anotar a mensagem: o `tar` do Windows precisa abrir `.txz`.
- [ ] Fechar o app pela bandeja e conferir no Gerenciador de Tarefas que não sobrou `postgres.exe` nem `node.exe`.
- [ ] Abrir de novo: entra direto como o dono, sem pedir configuração.
- [ ] Aviso nativo do Windows ao chegar uma notificação (cards prontos).
- [ ] Menu Arquivo → Importar… e Exportar… abrem a tela certa.
- [ ] Com a conta em inglês (perfil → English), o aviso da bandeja ao chegar uma notificação sai em inglês;
      os menus nativos continuam em português (pendência conhecida).

## Lição e tutor (celular)

- [ ] Sons: toque neutro ao escolher opção ou palavra, som de acerto e de erro ao conferir. No iPhone, o modo
      silencioso corta o som.
- [ ] Tocar no X no meio da lição abre "Sair da lição?"; "Continuar a lição" volta sem perder nada.
- [ ] Abrir o mesmo bloco duas vezes: a ordem dos exercícios e das opções muda.
- [ ] Na Início, o cartão "Converse com o tutor" sugere um tema e, com uma conversa sem revisão, oferece
      continuar. Depois de revisar uma conversa, a tela Conversar mostra "O que o tutor leva em conta".
- [ ] Numa conta que estuda espanhol, o tutor abre a conversa em espanhol.
- [ ] No seletor do OpenSubtitles, "Outras opções" lista os arquivos em uma coluna legível.

## Idiomas (qualquer máquina, com chaves reais)

- [ ] Com a chave do OpenSubtitles, buscar legendas de um episódio com uma conta espanhol → português:
      aparecem opções em ES e PT e o download importa o par.
- [ ] Com o Kokoro ligado, ouvir uma fala em espanhol (`ef_dora`), uma em francês (`ff_siwis`) e uma em
      português (`pf_dora`): voz no idioma certo. Inglês segue com o sotaque do perfil.
- [ ] Com uma chave de IA, gerar cards numa conta espanhol → português: explicações em português sobre termos
      em espanhol; na conta inglês → espanhol, explicações em espanhol.

## Áudio em lote e worker (máquina com Docker)

- [ ] Com `pnpm infra:up` (Kokoro de pé) e `KOKORO_URL` no `.env`, importar um episódio novo: a etapa "Áudio
      das falas (Kokoro)" diz "na fila · gerado em segundo plano"; em alguns minutos chega o aviso "Áudio do
      episódio pronto" no sino, e ao abrir a leitura todas as falas tocam sem o estado "gerando". (O job em si já
      foi conferido em 15/10/2026 pelo `pnpm worker` com o Kokoro local: 24 falas geradas, `job.done`.)
- [ ] Com `JOBS_MODE=worker` no `.env`, subir `pnpm dev` e `pnpm worker` em terminais separados e gerar uma
      trilha: o log do worker mostra `job.done` com `kind=generate_plan` e a trilha aparece na Início. Sem o
      worker rodando, a trilha fica "montando" até ele subir.
- [ ] Com o Kokoro parado e `JOBS_MODE=worker`, importar um episódio: o worker registra `job.retry`, e ao
      religar o Kokoro o job termina sozinho na próxima tentativa.

## Linux

- [ ] AppImage e `.deb` abrem (WebKitGTK).
- [ ] Postgres embutido: a extração exige `xz` instalado; conferir numa distribuição limpa.

## macOS

- [ ] Aviso nativo aparece com o pacote assinado localmente (pendência antiga do HANDOFF).
- [ ] Instalador Intel abre em um Mac Intel.

## Celular (na rede da casa)

- [ ] Abrir pelo QR code da bandeja e instalar como PWA.
- [ ] Ditado do teclado funciona no Conversar (microfone direto só com HTTPS).
- [ ] `pnpm dev:https` (porta 1301): abrir `https://<ip>:1301` no celular, aceitar o certificado e gravar uma
      resposta no Conversar pelo microfone.

## Versão web offline (Safari e iPhone)

`pnpm build:web && node scripts/serve-web.mjs` publica o alvo web em `http://127.0.0.1:1320`. No iPhone, o
banco e o service worker pedem HTTPS: sirva o `.next-web` atrás de um HTTPS (ou publique na Vercel).

- [ ] Safari no Mac: `/lab/` abre o banco, "Criar conta de prova" soma uma conta, recarregar mantém a contagem.
- [ ] Safari no Mac: segunda aba mostra "Esperando o banco" e abre quando a primeira fecha.
- [ ] Safari no Mac: depois da primeira visita, sem rede, `/lab/detail/?id=b` abre.
- [ ] iPhone: os três itens acima, e anotar o espaço mostrado na prova.

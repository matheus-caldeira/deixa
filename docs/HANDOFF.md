---
title: Handoff — o que falta implementar
updated: 2026-10-12
source: PROJETO.md, docs/PLAN.md, conversa de 12/10/2026
---

# Handoff: o que falta implementar

Documento para quem retomar o trabalho (pessoa ou agente) sem o histórico da conversa. O que já foi entregue
está em `docs/PLAN.md`; as decisões tomadas, em `docs/DECISIONS.md`.

## 1. Estado atual

- `main` local com as sugestões personalizadas mescladas, **sem remote e sem push**.
- Entregue: fases 01 e 02 completas, mais partes das fases 03 a 06 (cards em segundo plano com notificações,
  trilhas e questões por IA, revisão com antecipação sem limite, Conversar por texto e áudio, PWA online-first,
  busca e importação de legendas pelo OpenSubtitles a pedido do usuário).
- Testes na última execução: 205 unitários, 7 de integração, 2 e2e, bundle 7 aprovados e 1 pulado.
- Execução hoje: Next em `0.0.0.0:1300`, Postgres 17 (porta 1442) e Kokoro (porta 1881) via docker compose,
  configuração em `.env`.

Como subir:

```bash
pnpm infra:up && pnpm db:migrate
nohup pnpm dev > data/app.log 2>&1 &
```

## 2. Pendências do produto (independentes do app nativo)

### Fase 03 restante

- [ ] Worker separado para o processamento de episódios (hoje roda dentro da requisição; `setInterval` e cron
      no processo web continuam proibidos).
- [ ] Áudio em lote por episódio (hoje o áudio é gerado no primeiro toque de cada fala).
- [ ] Importação e conferência de roteiro (`source_url` guardado, roteiro completo nunca exibido).

### Fase 04 restante

- [ ] Tela Progresso com fonte real: percentual de nível, habilidades e erros recorrentes ainda vêm do retrato
      de demonstração do módulo `gamification`.

### Fase 06 restante

- [ ] Fala em tempo real no Conversar.
- [ ] Limites de uso por conta.
- [ ] HTTPS na rede interna: sem ele, microfone e instalação como PWA só funcionam em `localhost`. Ver 3.5.

### Pendências menores

- [ ] Chave Gemini gratuita aguenta cerca de 20 requisições por dia por modelo; um episódio real (472 falas)
      esgota isso na geração de trilhas. Avaliar lote maior por chamada, cache por episódio e aviso de cota.
- [ ] O script de revisão de segurança dos commits falha com erro de `hashlib` do Python; só os títulos dos
      achados chegam. Corrigir ou remover o hook.
- [ ] Login opcional do OpenSubtitles (`OPENSUBTITLES_USERNAME` e `OPENSUBTITLES_PASSWORD`) nunca foi validado
      com conta real; só a chave de API foi.
- [ ] Revisar os termos da API do OpenSubtitles e os direitos de redistribuição de legendas antes de abrir o
      catálogo a terceiros.

## 3. Nova direção: app nativo instalável (Windows, Linux, macOS)

Pedido do Matheus em 12/10/2026. Objetivo: projeto open source, instalado por qualquer pessoa a partir de um
release do GitHub, sem Docker, sem `.env`, com o menor consumo de recursos possível.

### 3.1 O que foi pedido

1. Empacotar tudo num instalador por sistema operacional (Electron ou Tauri, o que consumir menos).
2. Migrar o `.env` para uma tabela no banco; na primeira abertura, um assistente pede os dados.
3. Chaves de TMDB, OpenSubtitles e Gemini **por usuário**, com uma chave **global** opcional. A do usuário
   sempre vence; a global só vale quando o usuário não tem a sua.
4. HTTPS servido pelo próprio app, para abrir no navegador de outros aparelhos.
5. Ícone na bandeja: um clique mostra o status e onde o dono do computador parou; outro abre o sistema
   (navegador ou janela própria). O dono do computador fica conectado como usuário padrão.
6. Notificações nativas do sistema quando há um perfil conectado no computador; sem perfil, sem notificação.
7. Releases no GitHub com atualização pelo próprio app.

### 3.2 Arquitetura recomendada

| Peça         | Hoje                   | Proposta                                                                      |
| ------------ | ---------------------- | ----------------------------------------------------------------------------- |
| Casca        | navegador              | **Tauri 2**: bandeja, janela no webview do sistema, notificações, atualizador |
| Servidor     | `pnpm dev`             | Next com `output: "standalone"` rodando como sidecar com um Node embutido     |
| Banco        | Postgres 17 no Docker  | **PGlite** (Postgres em WASM, no processo) com o mesmo schema Drizzle         |
| Voz          | Kokoro no Docker       | opcional: modelo ONNX baixado sob demanda; sem ele, `SilentTtsProvider`       |
| Configuração | `.env`                 | tabela `app_settings` + credenciais por usuário; segredo mestre fora do banco |
| Dados        | `data/` no repositório | diretório de dados do usuário no sistema operacional                          |

Por que Tauri e não Electron: o Electron embute um Chromium inteiro (instalador perto de 150 MB a mais e
algumas centenas de MB de memória com a janela aberta); o Tauri usa o webview que o sistema já tem. Como o app
passa a maior parte do tempo só na bandeja, a casca do Tauri fica em dezenas de MB de memória. O custo fixo
que sobra nos dois casos é o processo Node do servidor Next.

Custos do Tauri a aceitar: um pouco de Rust na casca, toolchain Rust para compilar (instalação no sistema
exige confirmação do Matheus) e diferenças de renderização entre WebView2, WebKitGTK e WKWebView.

### 3.3 Tarefas, na ordem sugerida

As etapas A a C valem mesmo sem a casca nativa e devem vir primeiro.

**A. Banco embutido**

- [ ] Prova de conceito: rodar migrações e `pnpm test:integration` contra PGlite (driver `drizzle-orm/pglite`).
      Pontos a conferir: índices únicos parciais, transações, `ON CONFLICT`, concorrência (PGlite é conexão
      única; as filas por usuário já existentes ajudam).
- [ ] Port de conexão escolhendo Postgres externo (`DATABASE_URL` definido) ou PGlite (padrão no app nativo).
- [ ] Migrações aplicadas na inicialização, com cópia de segurança do diretório antes de migrar.
- [ ] Se o PGlite não aguentar: alternativa é embutir binários do Postgres (instalador bem maior). SQLite
      obrigaria a reescrever schema e migrações; descartado em princípio.

**B. Configuração no banco e assistente de primeira abertura**

Feito em 12/10/2026 (branch `feat/user-credentials`):

- [x] Chaves de Gemini, TMDB e OpenSubtitles por usuário, na tabela `user_ai_credentials` (uma linha por
      serviço), com AES-256-GCM e resposta mascarada.
- [x] Chave global opcional em `app_credentials`, alterada só pelo administrador. Ordem de uso: usuário →
      global no banco → global no `.env` → provider de reserva.
- [x] Providers resolvidos por usuário no `container.ts` (antes eram montados uma vez).
- [x] Papel de administrador: a primeira conta criada (`users.is_admin`).
- [x] Chave mestra em `master-key.txt`, na raiz da instalação, criada na primeira execução. Chave guardada
      que não decifra é ignorada e gera alerta pedindo novo cadastro.
- [x] Cota do OpenSubtitles guardada por chave em uso; com chave própria não há teto diário do servidor.

Falta:

- [ ] Tabela `app_settings` para o resto do `.env` (modelo do Gemini, teto de downloads, endereço do Kokoro,
      atalhos de desenvolvimento) e remoção das chaves globais do `.env`.
- [ ] Assistente de primeira abertura: cria o dono do computador (admin), pede as chaves com link para onde
      obter cada uma, permite pular.
- [ ] Tela para o administrador promover outra conta.
- [ ] Numa instalação nova, a primeira conta criada vira administradora, e o servidor já escuta na rede
      interna. O assistente de primeira abertura deve aceitar a criação dessa conta só a partir do próprio
      computador.
- [ ] Porta e diretório de dados continuam fora do banco (são necessários antes de abri-lo).
- [ ] No app nativo, `master-key.txt` deve ir para o diretório de dados do usuário, não para a pasta do app.
- [ ] O nome `user_ai_credentials` ficou histórico (hoje guarda os três serviços); renomear numa migração
      futura, se valer a pena.
- [ ] Nenhuma chave embutida no binário nem no repositório: cada instalação traz as suas.

**C. Voz sem Docker**

- [ ] `TtsProvider` com modelo Kokoro em ONNX rodando no processo Node, baixado sob demanda (centenas de MB),
      com progresso e opção de não baixar.
- [ ] Reserva sem modelo: `speechSynthesis` do navegador ou silêncio.

**D. Casca Tauri**

- [ ] `next.config` com `output: "standalone"`; conferir `next/image` (o otimizador usa `sharp`, módulo
      nativo; usar imagens não otimizadas ou empacotar o binário por plataforma).
- [ ] Sidecar: binário do Node por plataforma + pasta standalone; a casca sobe, vigia e encerra o servidor.
- [ ] Instância única, início com o sistema (opcional), porta configurável com detecção de conflito.
- [ ] Bandeja: status do servidor, endereços (local e rede), "onde parei" do dono, abrir janela, abrir no
      navegador, sair.
- [ ] Sessão do dono: token de sessão de longa duração guardado no cofre do sistema e injetado só na janela
      local; acesso pela rede continua exigindo login.
- [ ] Notificações nativas: a casca consulta a caixa de notificações do dono (endpoint local autenticado) e
      dispara o aviso do sistema; sem perfil conectado, não consulta.

**E. HTTPS na rede interna**

- [ ] Ver riscos em 3.5 antes de implementar. Proposta mínima: autoridade certificadora local gerada na
      primeira abertura, certificado por IP e nome da máquina, página com QR code para instalar a autoridade
      no celular, e documentação da alternativa por Tailscale.

**F. Distribuição**

- [ ] Repositório no GitHub (ação do Matheus; nada de push sem pedido explícito).
- [ ] Antes de publicar: varredura de segredos em todo o histórico do git, escolha de licença, `README` de
      instalação, atribuição a TMDB e OpenSubtitles.
- [ ] GitHub Actions com matriz Windows, Linux e macOS gerando instaladores e publicando o release.
- [ ] Aviso de versão nova consultando os releases do GitHub, com link para o download manual.
- [ ] `README` com o passo de liberação do app não assinado em macOS e Windows (decisão em 3.4).

### 3.4 Decisões

Tomadas pelo Matheus em 12/10/2026:

1. Clicar na bandeja abre uma **janela própria**; o menu traz também "Abrir no navegador" e "Abrir pelo QR
   code", que mostra o endereço da rede interna como QR para o celular.
2. **Nenhuma assinatura de código paga.** O usuário baixa o instalador manualmente no GitHub. Consequências a
   documentar no `README`: no macOS é preciso liberar o app em Ajustes → Privacidade e Segurança; no Windows,
   "Mais informações → Executar assim mesmo". O app só **avisa** que há versão nova e abre a página do
   release; atualização automática silenciosa fica fora.
3. As sugestões personalizadas (seção 5) vieram antes do banco embutido e já estão prontas.

Ainda em aberto:

1. Voz: baixar o modelo sob demanda ou depender da voz do navegador.
2. Licença do projeto.
3. Nome definitivo do produto ("Deixa" é provisório e vira nome de pacote, identificador e ícone).
4. Microfone no celular: ver 3.6.

### 3.5 Riscos conhecidos

- **HTTPS para o celular é o ponto mais difícil.** Servir HTTPS é simples; fazer o celular **confiar** no
  certificado não é. Sem domínio público, o certificado é de uma autoridade local, que precisa ser instalada
  manualmente em cada aparelho (no iOS, em dois passos nas configurações). No próprio computador nada disso é
  necessário: `http://localhost` já é contexto seguro, com microfone e PWA funcionando.
- **Assinatura de código.** Sem certificado, o macOS bloqueia o app baixado (Gatekeeper) e o Windows mostra o
  aviso do SmartScreen. Apple Developer custa 99 dólares por ano; certificado para Windows também é pago. Dá
  para lançar sem, com instruções de contorno, mas isso contraria o "fácil para qualquer um".
- **PGlite** é conexão única e mais lento que o Postgres nativo; suficiente para uma casa, a validar com os
  testes de integração.
- **Memória total**: o piso é o Node do servidor Next (ordem de 150 a 250 MB). Reduzir além disso exigiria
  reescrever o servidor, o que não se recomenda agora.
- **Direitos**: com instalação local, cada pessoa monta o próprio catálogo, o que reduz o problema de
  redistribuição de legendas; ainda assim o repositório e os releases nunca carregam legenda real.

### 3.6 Microfone no celular sem HTTPS confiável

Opções levantadas, da mais barata para a mais cara:

1. **Ditado do teclado (já funciona).** O Conversar aceita texto, e o microfone do teclado do celular dita em
   qualquer página, mesmo em HTTP. Não envia o áudio (não serve para avaliar pronúncia), mas destrava a
   conversa falada hoje, sem código novo.
2. **Autoridade certificadora local + QR code** (tarefa E). Funciona em iOS e Android, sem custo, com uma
   instalação por aparelho. É o caminho recomendado.
3. **App Android** (APK no release do GitHub, sem loja). O Tauri 2 gera Android. Atenção: um webview apontando
   para `http://ip-da-rede` continua sem `getUserMedia`; o app precisa gravar pelo lado nativo e entregar o
   áudio à página, ou servir a interface de uma origem própria. iOS fica de fora, porque exige conta paga.
4. **Interface publicada em HTTPS (Vercel) falando com o servidor local.** Não recomendado: página HTTPS não
   pode chamar `http://ip-da-rede` (conteúdo misto). O Chrome recente abre exceção para rede local mediante
   permissão (a confirmar na versão vigente), o Safari do iOS não. Navegador também não varre a rede: a
   descoberta teria de ser por QR code ou por um serviço de encontro na nuvem. E a interface atual depende de
   server actions e renderização no servidor; teria de virar um cliente separado com API, CORS e token.

## 4. Regras que continuam valendo

- Português do Brasil com acentuação; identificadores em inglês; código sem comentários (`pnpm lint:comments`).
- Testes sem paralelismo; LLM nunca chamada em teste; OpenSubtitles sem download real em teste.
- Segredos nunca impressos, logados nem versionados; nada de `NEXT_PUBLIC_` para segredo.
- Importação pelo OpenSubtitles só a pedido do usuário, nunca em lote nem automática.
- Identidade do git herdada do `~/.gitconfig`; Conventional Commits; sem push, remote ou PR sem pedido.
- Nenhuma instalação de software no sistema sem confirmação explícita (inclui a toolchain Rust do Tauri).
- Portas na faixa 1XXX: app 1300, e2e 1310, Postgres 1442, Kokoro 1881.

## 5. Sugestões personalizadas (entregue em 12/10/2026)

Branch `feat/recommendations`. Módulo `src/modules/recommendations`.

Como funciona:

1. **Retrato do aluno**, só com dados da própria conta: obras estudadas (peso pelo progresso), acerto nos
   exercícios e cards esquecidos nos últimos 30 dias, densidade de marcações e termos mais esquecidos. Disso
   sai o desafio (subir, manter ou aliviar) e uma frase mostrada na tela.
2. **Candidatas**: recomendações do TMDB para as três obras mais estudadas, mais as populares em inglês.
   Saem as já estudadas, as recusadas e as já adicionadas.
3. **Recuperação**: cada obra vira um vetor (Gemini `gemini-embedding-001` com 256 dimensões; sem chave, um
   vetor local por hashing de palavras). Os vetores ficam em `work_embeddings` e não são gerados de novo. O
   gosto é o centro ponderado das obras estudadas; a nota junta semelhança, adequação de nível e popularidade,
   e afasta o que parece com o que foi recusado.
4. **Geração**: as 14 melhores vão à IA com o retrato; ela ordena, estima a faixa de nível e escreve o motivo.
   Saída validada com Zod; obra fora da lista é descartada. Sem IA, o motivo é montado localmente.
5. **Ciclo**: refaz em segundo plano ao abrir o Explorar quando o estudo mudou e passaram 12 horas, ou depois
   de 7 dias; "Atualizar" força (no máximo uma vez por minuto). "Não tenho interesse" e "Adicionar ao
   catálogo" realimentam o gosto.

O que ficou de fora e vale fazer depois:

- [ ] Usar o retrato do aluno também na montagem das trilhas e no tutor (hoje só as sugestões usam).
- [ ] Faixa de nível medida de verdade (vocabulário e velocidade das falas) quando a obra tiver legenda;
      hoje é estimativa por gênero ou pela IA.
- [ ] Guardar gêneros em `media_items` para enriquecer o vetor das obras estudadas.
- [ ] Notificar quando surgirem sugestões novas.
- [ ] Diversidade: hoje uma obra muito estudada puxa quase todas as sugestões para o mesmo gênero quando a
      IA não está disponível.

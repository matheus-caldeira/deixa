---
title: Handoff — o que falta implementar
updated: 2026-10-12
source: PROJETO.md, docs/PLAN.md, conversa de 12/10/2026
---

# Handoff: o que falta implementar

Documento para quem retomar o trabalho (pessoa ou agente) sem o histórico da conversa. O que já foi entregue
está em `docs/PLAN.md`; as decisões tomadas, em `docs/DECISIONS.md`.

## 1. Estado atual

- `main` local em `e221f60`, árvore limpa, **sem remote e sem push**. O branch `feat/opensubtitles` aponta para
  o mesmo commit e pode ser apagado.
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

| Peça          | Hoje                         | Proposta                                                                        |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Casca         | navegador                    | **Tauri 2**: bandeja, janela no webview do sistema, notificações, atualizador   |
| Servidor      | `pnpm dev`                   | Next com `output: "standalone"` rodando como sidecar com um Node embutido       |
| Banco         | Postgres 17 no Docker        | **PGlite** (Postgres em WASM, no processo) com o mesmo schema Drizzle           |
| Voz           | Kokoro no Docker             | opcional: modelo ONNX baixado sob demanda; sem ele, `SilentTtsProvider`         |
| Configuração  | `.env`                       | tabela `app_settings` + credenciais por usuário; segredo mestre fora do banco   |
| Dados         | `data/` no repositório       | diretório de dados do usuário no sistema operacional                            |

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

- [ ] Tabela `app_settings` (chave, valor, cifrado ou não) para o que hoje é `.env` global.
- [ ] Generalizar `user_ai_credentials` para `user_api_credentials` com `provider` (`gemini`, `tmdb`,
      `opensubtitles`), mantendo AES-256-GCM e resposta mascarada.
- [ ] Resolvedor único de credencial: usuário → global → provider de reserva (fake ou silencioso). Hoje os
      providers são montados uma vez no `container.ts`; passam a ser resolvidos por requisição com o `userId`.
- [ ] O que **não** pode ir para o banco: a chave mestra (`AI_CREDENTIALS_MASTER_KEY`), porque ela cifra o que
      está no banco. Gerar na primeira abertura e guardar no cofre do sistema operacional (Keychain, Credential
      Manager, Secret Service), com arquivo `0600` no diretório de dados como reserva. Porta e diretório de
      dados também ficam fora (são necessários antes de abrir o banco).
- [ ] Assistente de primeira abertura: cria o dono do computador (admin), pede as chaves com link para onde
      obter cada uma, permite pular (o app funciona com os providers de reserva).
- [ ] Papel de administrador: só ele edita chaves globais e configurações do servidor.
- [ ] Cota do OpenSubtitles contabilizada por chave em uso (hoje é por servidor + teto por usuário).
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
- [ ] Atualizador do Tauri apontando para os releases, com par de chaves de assinatura da atualização.
- [ ] Assinatura de código: ver 3.5.

### 3.4 Decisões em aberto (do Matheus)

1. Janela própria ou só navegador ao clicar na bandeja. Recomendação: janela própria (webview) como padrão e
   "Abrir no navegador" no menu.
2. Voz: baixar o modelo sob demanda ou depender da voz do navegador.
3. Licença do projeto.
4. Pagar ou não a assinatura de código (macOS e Windows).
5. Nome definitivo do produto ("Deixa" é provisório e vira nome de pacote, identificador e ícone).

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

## 4. Regras que continuam valendo

- Português do Brasil com acentuação; identificadores em inglês; código sem comentários (`pnpm lint:comments`).
- Testes sem paralelismo; LLM nunca chamada em teste; OpenSubtitles sem download real em teste.
- Segredos nunca impressos, logados nem versionados; nada de `NEXT_PUBLIC_` para segredo.
- Importação pelo OpenSubtitles só a pedido do usuário, nunca em lote nem automática.
- Identidade do git herdada do `~/.gitconfig`; Conventional Commits; sem push, remote ou PR sem pedido.
- Nenhuma instalação de software no sistema sem confirmação explícita (inclui a toolchain Rust do Tauri).
- Portas na faixa 1XXX: app 1300, e2e 1310, Postgres 1442, Kokoro 1881.

---
title: Desenvolvimento
updated: 2026-10-12
source: README.md anterior, .superpowers/planning/HANDOFF.md
---

# Desenvolvimento

Como rodar, testar e empacotar o Deixa a partir do código. Para o que o projeto é e como instalar o
aplicativo pronto, veja o [README](../README.md).

- Especificação: [`PROJETO.md`](../PROJETO.md)
- Protótipo aprovado da interface: [`deixa.html`](../deixa.html)
- Plano e pendências: `.superpowers/planning/` (local, fora do git) · Diário de decisões: [`DECISIONS.md`](DECISIONS.md)
- Regras de arquitetura e documentação por tecnologia: [`.contexts/`](../.contexts/README.md)

## Requisitos

Node 24, pnpm 12 e Docker (para o Postgres e, se quiser voz, o Kokoro). Rust só para a casca nativa.

## Como subir

```bash
pnpm install
pnpm setup:env          # cria ou completa o .env com valores de desenvolvimento, sem imprimir nada
docker compose up -d    # Postgres (porta 1442) e Kokoro (porta 1881)
pnpm db:seed            # perfis, obras e episódios de demonstração (pode rodar de novo)
pnpm dev                # http://localhost:1300 e http://<IP da máquina>:1300
pnpm worker             # consome a fila de jobs (só é preciso com JOBS_MODE=worker)
```

As migrações rodam sozinhas quando o app sobe; `pnpm db:migrate` continua existindo para rodar à mão.

Para testar pelo celular na mesma rede, abra `http://<IP da máquina>:1300`. A aplicação escuta em `0.0.0.0`;
Postgres e Kokoro ficam só em `127.0.0.1`.

A imagem do Kokoro tem cerca de 8 GB. Sem ela, deixe o endereço do Kokoro vazio: o áudio vira um WAV curto de
silêncio e o resto funciona.

### Portas

| Serviço    | Porta |
| ---------- | ----- |
| Aplicação  | 1300  |
| E2E        | 1310  |
| E2E setup  | 1311  |
| PostgreSQL | 1442  |
| Kokoro     | 1881  |

## Configuração

Em desenvolvimento, a configuração vem do `.env`, validado com Zod em `src/infrastructure/config/env.ts`. O
[`.env.example`](../.env.example) lista os nomes, sem valores. No aplicativo instalado não há `.env`: o banco é
configurado na tela `/setup` e o resto no perfil.

| Variável                              | Para quê                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Conexão com o Postgres. Sem ela, vale o endereço guardado pela tela `/setup`            |
| `AI_CREDENTIALS_MASTER_KEY`           | Opcional. Substitui a chave mestra do arquivo `master-key.txt` (testes)                 |
| `TMDB_READ_ACCESS_TOKEN`              | Chave global do TMDB (token de leitura)                                                 |
| `TMDB_API_KEY`                        | Chave global do TMDB (chave de API), usada se o token for recusado                      |
| `OPENSUBTITLES_API_KEY`               | Chave global do OpenSubtitles                                                           |
| `OPENSUBTITLES_USERNAME`              | Opcional: usuário para login antes do download                                          |
| `OPENSUBTITLES_PASSWORD`              | Opcional: senha desse usuário                                                           |
| `GEMINI_API_KEY`                      | Chave global do Gemini, para quem não cadastrou a própria                               |
| `GEMINI_MODEL`                        | Modelo inicial de geração (Google); o administrador troca em Configurações              |
| `SUBTITLE_DOWNLOADS_PER_USER_PER_DAY` | Padrão do teto de downloads por conta; o administrador pode trocar no perfil            |
| `KOKORO_URL`                          | Padrão do endereço do Kokoro; o administrador pode trocar no perfil                     |
| `DATA_DIR`                            | Diretório das legendas e dos áudios (padrão `data`, fora do git)                        |
| `DEIXA_CONFIG_DIR`                    | Pasta de `master-key.txt`, `database-url.txt` e dos arquivos locais da casca            |
| `SESSION_COOKIE_SECURE`               | `true` por padrão; `false` permite entrar por HTTP na rede interna                      |
| `DEV_SHORTCUTS`                       | `true` mostra o atalho de arquivos de exemplo                                           |
| `JOBS_MODE`                           | `inline` (padrão) roda os jobs no próprio servidor; `worker` deixa para o `pnpm worker` |
| `JOBS_POLL_MS`                        | Intervalo do worker entre consultas à fila (padrão 2000)                                |

### Chaves de API

- Cada conta cadastra as próprias chaves de IA (Google, OpenAI, Anthropic, OpenRouter, Ollama ou servidor
  compatível com OpenAI), TMDB e OpenSubtitles em Configurações. A chave do usuário sempre
  vence; sem ela, vale a chave global (definida pelo administrador no perfil ou no `.env`); sem nenhuma, o
  serviço funciona em modo de demonstração.
- A primeira conta criada é a administradora.
- As chaves ficam cifradas no banco com a chave mestra de `master-key.txt`, criado na primeira execução e fora
  do git. Se ele for trocado ou apagado, as chaves guardadas ficam ilegíveis: o app avisa e basta
  cadastrá-las de novo.
- Nenhuma credencial vai para o navegador nem para o log; `pnpm test:bundle` confere o bundle.

### Banco de dados

O Deixa usa um PostgreSQL seu (testado na versão 17). Sem `DATABASE_URL`, a primeira abertura leva a `/setup`:
digite o código do arquivo `setup-code.txt`, escolha o Postgres encontrado ou informe o endereço, e o app cria
o banco e as tabelas. O endereço fica em `database-url.txt`; para trocar de banco, apague esse arquivo.

## Seed de demonstração

`pnpm db:seed` cria três perfis, sete obras com os identificadores reais do TMDB, quinze episódios com
legendas fictícias e as trilhas deles em A1, B1 e C1. Usa só os arquivos de [`fixtures/`](../fixtures/): não
precisa de `.env` nem de chave nenhuma, apenas do banco configurado.

| Perfil  | E-mail                  | Nível | Senha       |
| ------- | ----------------------- | ----- | ----------- |
| Ana     | `ana@deixa.example`     | A1    | `deixa1234` |
| Matheus | `matheus@deixa.example` | B1    | `deixa1234` |
| Lucas   | `lucas@deixa.example`   | C1    | `deixa1234` |

O texto dos episódios do seed vem de oito diálogos fictícios escritos para o projeto, nunca de legendas reais.
`pnpm db:reset` apaga o banco de desenvolvimento e os arquivos em `data/`, migra e semeia de novo.

## Comandos

```bash
pnpm typecheck && pnpm lint && pnpm lint:comments && pnpm test   # depois de cada tarefa
pnpm test:integration            # repositórios no Postgres real; TMDB e OpenSubtitles reais só com chave
pnpm build && pnpm test:bundle   # procura os segredos no bundle do cliente
pnpm test:e2e                    # build + bancos de teste + Playwright no Chrome instalado
pnpm db:generate                 # gera migração a partir do schema
pnpm fixtures:catalog            # regera o catálogo fixo do seed (precisa da chave do TMDB)
pnpm fixtures:plans              # regera as trilhas fixas do seed (precisa da chave do Gemini)
```

Os testes rodam sem paralelismo e nunca chamam a IA.

## Organização

```
src/app/              páginas, server actions e rotas (borda fina)
src/ui/               componentes React, ícones e estilos portados do protótipo
src/modules/<m>/      domain · application (casos de uso + ports) · infrastructure
src/infrastructure/   env, banco, storage, TMDB, IA (AI SDK), Kokoro, OpenSubtitles, logger, container
src/seed/             seed de demonstração
src-tauri/            casca nativa (Tauri)
tests/                e2e (Playwright) e bundle
fixtures/             catálogo fixo, diálogos fictícios e trilhas do seed
data/                 legendas enviadas e áudios gerados (fora do git)
```

## Casca nativa

`src-tauri/` tem o app Tauri: fica na bandeja do sistema, sobe o servidor do Deixa e o abre numa janela
própria, no navegador ou por QR code no celular.

```bash
pnpm desktop:server      # gera o servidor embutido (build do Next + Node) em src-tauri/
pnpm desktop:run         # executa a casca em modo de desenvolvimento
pnpm desktop:build       # gera só o aplicativo em src-tauri/target/release/bundle
pnpm desktop:installer   # gera também o instalador
```

Se já houver um servidor do Deixa na porta 1300 (por exemplo, `pnpm dev`), a casca usa esse. Os dados do app
instalado ficam na pasta de dados do sistema, não na pasta do projeto.

## Publicar uma versão

1. Atualize a versão em `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` e
   `src/shared/app.ts`, e rode `pnpm desktop:check` para atualizar o `Cargo.lock`.
2. Crie e envie a tag, com `v` na frente: `git tag v0.0.2 && git push origin v0.0.2`.
3. O fluxo `Release` confere a versão, gera os instaladores de macOS, Linux e Windows e os anexa a um release
   em rascunho, com os hashes. Confira e publique.

## Limites conhecidos

- O microfone do Conversar só funciona em HTTPS ou em `localhost` (restrição do navegador).
- No plano gratuito do Google AI a cota é pequena; o app tenta modelos alternativos e avisa quando acaba.
- Percentual de nível, habilidades e erros recorrentes da tela Progresso ainda mostram dados de demonstração.

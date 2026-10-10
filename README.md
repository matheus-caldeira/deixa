# Deixa

Nome provisório. Plataforma para aprender inglês a partir das séries e filmes que você já assiste: você importa
a legenda do episódio (inglês e, de preferência, português), lê o episódio inteiro, marca o que não entendeu e
transforma as marcações em cards de revisão.

- Especificação: [`PROJETO.md`](PROJETO.md)
- Protótipo aprovado da interface: [`deixa.html`](deixa.html)
- Plano da etapa: [`docs/PLAN.md`](docs/PLAN.md) · Diário de decisões: [`docs/DECISIONS.md`](docs/DECISIONS.md)

Esta etapa cobre as fases **01 · Fundação e catálogo** e **02 · Leitura e marcador**.

## Requisitos

Node 24, pnpm 12, Docker.

## Como subir

```bash
pnpm install
pnpm setup:env          # cria ou completa o .env com valores de desenvolvimento, sem imprimir nada
docker compose up -d    # Postgres (porta 1442) e Kokoro (porta 1881)
pnpm db:migrate         # aplica as migrações
pnpm db:seed            # perfis, obras e episódios de demonstração (pode rodar de novo)
pnpm dev                # http://localhost:1300
```

Para testar pelo celular na mesma rede: `pnpm build && pnpm start` e abra `http://<IP da máquina>:1300`.
A aplicação escuta em `0.0.0.0`; Postgres e Kokoro ficam só em `127.0.0.1`.

A imagem do Kokoro tem cerca de 8 GB; o primeiro `docker compose up` demora. Sem ela, comente o serviço ou deixe
`KOKORO_URL` vazio: o áudio vira um WAV curto de silêncio e o resto funciona.

### Portas

| Serviço    | Porta |
| ---------- | ----- |
| Aplicação  | 1300  |
| E2E        | 1310  |
| PostgreSQL | 1442  |
| Kokoro     | 1881  |

## Variáveis de ambiente

Tudo fica no `.env`, lido pelo carregamento padrão do Next.js e validado com Zod em
`src/infrastructure/config/env.ts`. O [`.env.example`](.env.example) lista os nomes, sem valores.

| Variável                    | Para quê                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`              | Conexão com o Postgres                                                               |
| `AI_CREDENTIALS_MASTER_KEY` | Chave mestra (32 bytes em base64) que cifra a chave Gemini de cada usuário           |
| `TMDB_READ_ACCESS_TOKEN`    | Token de leitura v4 do TMDB, usado no header `Authorization: Bearer`                 |
| `TMDB_API_KEY`              | Chave v3 do TMDB, usada só como alternativa se o token for recusado                  |
| `KOKORO_URL`                | Endereço do Kokoro; vazio = áudio silencioso                                         |
| `DATA_DIR`                  | Diretório das legendas e dos áudios (padrão `data`, fora do git)                     |
| `GEMINI_MODEL`              | Modelo do Gemini (padrão `gemini-2.5-flash`)                                         |
| `SESSION_COOKIE_SECURE`     | `true` por padrão; `false` permite entrar por HTTP na rede interna                   |
| `DEV_SHORTCUTS`             | `true` mostra os perfis de seed na tela de entrada e o atalho de arquivos de exemplo |

### Credenciais do TMDB

As credenciais do TMDB ficam **só no `.env`**, nas variáveis `TMDB_READ_ACCESS_TOKEN` e `TMDB_API_KEY`. O
`pnpm setup:env` não as preenche: coloque-as você. Elas são lidas apenas no servidor, nunca vão para o bundle do
cliente (`pnpm test:bundle` confere) e nunca aparecem em log. Sem elas, a busca de obras usa um provider de
demonstração com algumas obras fixas, e o provider ativo aparece no log de inicialização.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Perfis de seed

Todos com a mesma senha de desenvolvimento: **`deixa1234`**

| Perfil  | E-mail                  | Nível | Obra atual            |
| ------- | ----------------------- | ----- | --------------------- |
| Ana     | `ana@deixa.example`     | A1    | Friends               |
| Matheus | `matheus@deixa.example` | B1    | How I Met Your Mother |
| Lucas   | `lucas@deixa.example`   | C1    | Ted Lasso             |

Com `DEV_SHORTCUTS=true`, a tela de entrada mostra os três perfis: toque em um e digite a senha. Também dá para
criar uma conta nova em "Criar conta".

Os episódios do seed usam um **diálogo fictício** (o mesmo do protótipo), nunca legendas reais. Obras reais entram
pelo cadastro com o TMDB e pelo envio das suas legendas; em [`fixtures/`](fixtures/) há um par EN/PT de exemplo.

## O que dá para fazer

- Buscar uma série ou filme no TMDB, escolher temporada e episódio e ver pôster, sinopse e títulos em pt-BR.
- Enviar o `.srt` em inglês e, opcionalmente, em português; acompanhar o processamento até `READY`; reenviar o mesmo
  arquivo e ver a duplicidade detectada.
- Ler o episódio inteiro com a legenda EN ↔ PT alinhada por tempo, nos modos EN + PT, PT ao tocar e Só inglês.
- Marcar palavras, expressões e falas; gerar cards só para você ou para o catálogo; revisar em Revisar.
- Ouvir cada fala: o áudio é gerado no primeiro toque (Kokoro) e servido do cache depois.
- Configurar a chave do Google AI no perfil. Sem chave, as explicações dos cards são simuladas.

Início (trilha e missões), Conversar e Progresso mostram dados de demonstração nesta etapa.

## Comandos

```bash
pnpm typecheck && pnpm lint && pnpm lint:comments && pnpm test   # depois de cada tarefa
pnpm test:integration   # repositórios no Postgres real + busca no TMDB real (pulada sem token)
pnpm build && pnpm test:bundle   # procura os segredos em .next/static
pnpm test:e2e           # build + banco deixa_e2e + Playwright no Chrome instalado, com providers de demonstração
pnpm screenshots        # telas da aplicação e do protótipo em 390×844, claro e escuro, em screenshots/
pnpm db:generate        # gera migração a partir do schema
```

## Organização

```
src/app/              páginas, server actions e endpoints de áudio (borda fina)
src/ui/               componentes React, ícones e estilos portados do protótipo
src/modules/<m>/      domain · application (casos de uso + ports) · infrastructure
src/infrastructure/   env, banco, storage, TMDB, Gemini, Kokoro, logger, container
src/seed/             seed de demonstração
tests/                e2e (Playwright) e bundle
fixtures/             SRT fictícios EN e PT
data/                 legendas enviadas e áudios gerados (fora do git)
```

Regras de arquitetura, decisões e documentação por tecnologia: [`.contexts/`](.contexts/README.md).

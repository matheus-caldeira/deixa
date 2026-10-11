# Deixa

Nome provisório. Plataforma para aprender inglês a partir das séries e filmes que você já assiste: você importa
a legenda do episódio (inglês e, de preferência, português), lê o episódio inteiro, marca o que não entendeu e
transforma as marcações em cards de revisão.

- Especificação: [`PROJETO.md`](PROJETO.md)
- Protótipo aprovado da interface: [`deixa.html`](deixa.html)
- Plano da etapa: [`docs/PLAN.md`](docs/PLAN.md) · Diário de decisões: [`docs/DECISIONS.md`](docs/DECISIONS.md)

Feito até aqui: fases **01 · Fundação e catálogo** e **02 · Leitura e marcador**, o núcleo da **03** (trilha e sessão de estudo, sem IA) e o núcleo da **04** (XP, sequência, missões e progresso calculados).

## Requisitos

Node 24, pnpm 12, Docker.

## Como subir

```bash
pnpm install
pnpm setup:env          # cria ou completa o .env com valores de desenvolvimento, sem imprimir nada
docker compose up -d    # Postgres (porta 1442) e Kokoro (porta 1881)
pnpm db:migrate         # aplica as migrações
pnpm db:seed            # perfis, obras e episódios de demonstração (pode rodar de novo)
pnpm dev                # http://localhost:1300 e http://<IP da máquina>:1300
```

Para testar pelo celular na mesma rede, abra `http://<IP da máquina>:1300` (vale para `pnpm dev` e para
`pnpm build && pnpm start`). A aplicação escuta em `0.0.0.0`; Postgres e Kokoro ficam só em `127.0.0.1`.

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

A tela de entrada pede e-mail e senha e tem "Criar conta". Ela não lista as contas existentes.

Todo o catálogo vem do TMDB: o seed cadastra as sete obras pela API (títulos em pt-BR, pôster, imagem de fundo e
imagem de cada episódio). O **texto** dos episódios do seed é um diálogo fictício (o mesmo do protótipo), nunca
legendas reais; em [`fixtures/`](fixtures/) há o par EN/PT usado. Sem credenciais do TMDB, o seed e a busca caem
num provider de demonstração, sem fotos.

`pnpm db:reset` apaga o banco de desenvolvimento e os arquivos em `data/`, migra e semeia de novo.

## O que dá para fazer

- Buscar uma série ou filme no TMDB, escolher temporada e episódio e ver pôster, sinopse e títulos em pt-BR.
- Enviar o `.srt` em inglês e, opcionalmente, em português; acompanhar o processamento até `READY`; reenviar o mesmo
  arquivo e ver a duplicidade detectada.
- Ler o episódio inteiro com a legenda EN ↔ PT alinhada por tempo, nos modos EN + PT, PT ao tocar e Só inglês.
- Marcar palavras, expressões e falas; gerar cards só para você ou para o catálogo; revisar em Revisar.
- Ouvir cada fala: o áudio é gerado no primeiro toque (Kokoro) e servido do cache depois.
- Configurar a chave do Google AI no perfil. Sem chave, as explicações dos cards são simuladas.

- Estudar: "Continuar estudando" abre a lição da cena atual da trilha, com exercícios montados das falas do
  episódio e misturados conforme o nível (significado, escuta, montar a frase, lacuna, digitação e ditado). A
  correção e o XP são calculados no servidor; repetir rende metade e para de render depois de duas repetições no dia.
- Sequência, XP do dia e da semana, mapa de dias estudados e missões são calculados dos eventos de XP, no fuso da
  conta. Tocar no XP ou na sequência abre "Quem está estudando", com nome, nível, ofensiva e XP de cada conta.
- Instalar como aplicativo (PWA): manifesto, ícones e service worker online-first. O service worker só registra em
  HTTPS ou em `localhost`; pelo IP da rede em HTTP dá para "Adicionar à tela de início", mas sem cache offline.

Conversar, percentual de nível, habilidades e erros recorrentes ainda mostram dados de demonstração.

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

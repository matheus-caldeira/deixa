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

| Variável                              | Para quê                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Conexão com o Postgres                                                                      |
| `AI_CREDENTIALS_MASTER_KEY`           | Opcional. Substitui a chave mestra do arquivo `master-key.txt` (usada em testes)            |
| `TMDB_READ_ACCESS_TOKEN`              | Token de leitura v4 do TMDB, usado no header `Authorization: Bearer`                        |
| `TMDB_API_KEY`                        | Chave v3 do TMDB, usada só como alternativa se o token for recusado                         |
| `OPENSUBTITLES_API_KEY`               | Chave da API do OpenSubtitles; vazia = fonte de legendas de demonstração                    |
| `OPENSUBTITLES_USERNAME`              | Opcional: usuário para login antes do download                                              |
| `OPENSUBTITLES_PASSWORD`              | Opcional: senha desse usuário                                                               |
| `SUBTITLE_DOWNLOADS_PER_USER_PER_DAY` | Teto de downloads de legenda por usuário em 24 horas (padrão 10)                            |
| `KOKORO_URL`                          | Endereço do Kokoro; vazio = áudio silencioso                                                |
| `DATA_DIR`                            | Diretório das legendas e dos áudios (padrão `data`, fora do git)                            |
| `GEMINI_API_KEY`                      | Chave Gemini do servidor: monta as trilhas e serve de reserva para quem não cadastrou a sua |
| `GEMINI_MODEL`                        | Modelo do Gemini (padrão `gemini-2.5-flash`)                                                |
| `SESSION_COOKIE_SECURE`               | `true` por padrão; `false` permite entrar por HTTP na rede interna                          |
| `DEV_SHORTCUTS`                       | `true` mostra os perfis de seed na tela de entrada e o atalho de arquivos de exemplo        |

### Credenciais do TMDB

As credenciais do TMDB ficam **só no `.env`**, nas variáveis `TMDB_READ_ACCESS_TOKEN` e `TMDB_API_KEY`. O
`pnpm setup:env` não as preenche: coloque-as você. Elas são lidas apenas no servidor, nunca vão para o bundle do
cliente (`pnpm test:bundle` confere) e nunca aparecem em log. Sem elas, a busca de obras usa um provider de
demonstração com algumas obras fixas, e o provider ativo aparece no log de inicialização.

This product uses the TMDB API but is not endorsed or certified by TMDB.

### Legendas do OpenSubtitles

Na folha "Adicionar ao catálogo", o passo padrão é **Buscar legendas**: o app procura no OpenSubtitles as
legendas em inglês e português do episódio e só baixa quando você confirma. O envio manual de `.srt` continua
no link logo abaixo. Detalhes em [docs/STAGE-2-SUBTITLES.md](docs/STAGE-2-SUBTITLES.md).

- **Cota:** a conta do servidor tem um número de downloads por dia (a tela mostra quanto resta e quando
  renova). Além disso, cada usuário pode baixar até `SUBTITLE_DOWNLOADS_PER_USER_PER_DAY` legendas em 24 horas.
- **Sem a chave** (`OPENSUBTITLES_API_KEY` vazia), o app usa uma fonte de demonstração com as legendas fictícias
  de `fixtures/`. Para forçar essa fonte, deixe a variável vazia e reinicie; o log de inicialização mostra
  `subtitles: "fake"`.
- As credenciais são lidas só no servidor e nunca vão para o navegador nem para o log.

## Perfis de seed

Todos com a mesma senha de desenvolvimento: **`deixa1234`**

| Perfil  | E-mail                  | Nível | Obra atual            |
| ------- | ----------------------- | ----- | --------------------- |
| Ana     | `ana@deixa.example`     | A1    | Friends               |
| Matheus | `matheus@deixa.example` | B1    | How I Met Your Mother |
| Lucas   | `lucas@deixa.example`   | C1    | Ted Lasso             |

A tela de entrada pede e-mail e senha e tem "Criar conta". Ela não lista as contas existentes.

Todo o catálogo vem do TMDB: o seed cadastra as sete obras pela API (títulos em pt-BR, pôster, imagem de fundo e
imagem de cada episódio). O **texto** dos episódios do seed vem de 8 diálogos fictícios originais em
[`fixtures/dialogues/`](fixtures/dialogues/), nunca de legendas reais; as trilhas deles em A1, B1 e C1 estão em
[`fixtures/plans/`](fixtures/plans/). O seed é fixo e não chama a IA. Sem credenciais do TMDB, o seed e a busca caem
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

- Trilha por IA: para cada episódio e nível, o Gemini divide as falas em blocos, dá título a cada um e cria as
  questões, mais um desafio final do episódio inteiro. A trilha é montada em segundo plano e avisada pelo sino. É
  preciso 70% de acerto para concluir um bloco; só acertos rendem XP e todo erro vira card de revisão.
- Cards em segundo plano: "Gerar cards" não trava a tela; dá para continuar lendo e abrir o resultado pelo sino.
- Revisar: quando a fila acaba, "Antecipar próxima revisão" traz os 10 cartões que venceriam primeiro (até 5 vezes por
  dia, com espera que cresce 1 hora a cada uso).
- Conversar: escolha um tema ou escreva um assunto e converse livremente com o tutor, por texto ou áudio. Ele corrige
  cada mensagem na hora e o botão de alvo avalia a conversa inteira. As correções entram na revisão.
- Explorar: botão "+" ao lado do título e seletor com todas as temporadas da obra.

Percentual de nível, habilidades e erros recorrentes ainda mostram dados de demonstração.

### Sobre a chave Gemini

No plano gratuito do Google AI a cota é de cerca de 20 requisições por dia por modelo. Quando a cota do modelo
principal acaba, o app tenta `gemini-flash-latest` e `gemini-2.5-flash-lite`; se todas acabarem, avisa e não trava.
As trilhas dos episódios do seed já vêm prontas em `fixtures/plans/` e não gastam cota. Sem nenhuma chave, trilhas,
cards e tutor funcionam em modo simulado.

O microfone do tutor só funciona em HTTPS ou em `localhost` (restrição do navegador).

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

## Chaves de API e chave mestra

- Cada conta cadastra as próprias chaves de Gemini, TMDB e OpenSubtitles no perfil. A chave do usuário sempre
  vence; sem ela, vale a chave global (definida pelo administrador no perfil ou, por enquanto, no `.env`).
- A primeira conta criada é a administradora.
- As chaves ficam cifradas no banco com a chave mestra guardada em `master-key.txt`, na raiz do projeto. O
  arquivo é criado sozinho na primeira execução e fica fora do git. Se ele for trocado ou apagado, as chaves
  guardadas ficam ilegíveis: o app avisa e basta cadastrá-las de novo.

## Banco de dados

O Deixa não traz banco embutido: usa um PostgreSQL seu (testado na versão 17).

- Em desenvolvimento, `DATABASE_URL` no `.env` aponta para o Postgres do `docker compose`.
- Sem `DATABASE_URL`, a primeira abertura leva a `/setup`: digite o código do arquivo `setup-code.txt`,
  escolha o Postgres encontrado ou informe o endereço, e o Deixa cria o banco e as tabelas.
- O endereço fica em `database-url.txt`. Para trocar de banco, apague esse arquivo e abra o app de novo.
- `DEIXA_CONFIG_DIR` muda a pasta desses arquivos e do `master-key.txt` (padrão: a pasta onde o app roda).

## Seed de demonstração

`pnpm db:seed` cria três perfis, sete obras com os identificadores reais do TMDB, quinze episódios com legendas
fictícias e as trilhas deles em A1, B1 e C1. Usa só os arquivos de `fixtures/`: não precisa de `.env` nem de
chave nenhuma, apenas do banco configurado (`DATABASE_URL` ou a tela `/setup`). Senha dos perfis: `deixa1234`.

## Casca nativa (em construção)

`src-tauri/` tem um app Tauri que fica na bandeja do sistema, sobe o servidor do Deixa e o abre numa janela
própria, no navegador ou por QR code no celular. Precisa do Rust instalado.

```bash
pnpm desktop:server   # gera o servidor embutido (build do Next + Node) em src-tauri/
pnpm desktop:run      # executa a casca em modo de desenvolvimento
pnpm desktop:build    # gera o aplicativo instalável em src-tauri/target/release/bundle
```

Se já houver um servidor do Deixa na porta 1300 (por exemplo, `pnpm dev`), a casca usa esse. Os dados do app
instalado (endereço do banco, chave mestra, legendas e áudio) ficam na pasta de dados do sistema, não na pasta
do projeto.

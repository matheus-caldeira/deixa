# Fixtures

Par de legendas de exemplo com **diálogo fictício** (o mesmo do protótipo), nunca legenda real de série.

| Arquivo | Conteúdo |
| ------- | -------- |
| `sample.en.srt` | 23 falas em inglês, em quatro cenas |
| `sample.pt-BR.srt` | 22 falas em português |
| `sample.es.srt` | tradução fictícia em espanhol |
| `sample.en.txt` | transcrição fictícia do mesmo diálogo, com nomes de personagem, rubricas e duas falas mais longas que a legenda (2 e 8) |

A legenda em português está levemente desalinhada de propósito, para exercitar o alinhamento por tempo:

- atraso fixo de 400 ms, mais uma variação pequena por fala;
- a fala 2 em inglês foi dividida em duas em português (1:N);
- as falas 7 e 8 em inglês viraram uma só em português (N:1);
- a fala 22 em inglês ("Promise?") não existe em português (sem par, tradução por IA).

Resultado esperado do alinhamento: 22 de 23 falas com par (96%).

## Diálogos de teste (`dialogues/`)

Oito pares EN/PT com **diálogos fictícios originais**, gerados uma única vez por IA para este projeto (personagens e
situações inventados, sem relação com obras existentes) e guardados aqui como dados fixos. O seed distribui os
oito entre os episódios de demonstração, para que as atividades de cada episódio sejam diferentes.

Cada diálogo tem 4 cenas de 6 falas. A legenda em português tem atraso fixo e variação pequena por fala; nos
diálogos de número par, uma fala da última cena não existe em português (fala sem par).

`index.json` lista os arquivos e a quantidade de falas.

## Trilhas fixas (`plans/`)

Uma trilha por diálogo e por nível (A1, B1 e C1), gerada uma única vez por IA (`pnpm fixtures:plans`) e
guardada aqui. O seed grava essas trilhas sem chamar a IA.

## Catálogo fixo (`catalog.json`)

As sete obras de demonstração com o **identificador real do TMDB**, título, ano, caminhos de pôster e de imagem,
temporadas e títulos dos episódios usados pelo seed. Gerado uma única vez com `pnpm fixtures:catalog` (precisa
das credenciais do TMDB) e versionado, para que `pnpm db:seed` rode sem rede e sem chave.

O arquivo guarda só dados de identificação. As sinopses são textos curtos escritos para este projeto, não as
do TMDB, e as legendas dos episódios continuam sendo os diálogos fictícios acima.


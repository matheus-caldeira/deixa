---
title: "ADR 0017: Postgres embutido na instalação local"
updated: 2026-10-13
source: conversa de 13/10/2026 e docs/HANDOFF.md §3.3 A
status: aceita
---

# ADR 0017: Postgres embutido na instalação local

## Contexto

Instalar o app e sair usando exige um banco sem configuração. O Postgres externo continua certo para o banco
remoto na nuvem ou na rede da casa, mas obriga quem só quer estudar a instalar e configurar um servidor.
O PGlite foi medido e descartado pela memória (picos de 0,9 a 1,2 GB). O SQLite seria o mais leve, mas o
Drizzle não abstrai o dialeto: seriam dois schemas, dezenove repositórios adaptados, conversão de `jsonb` e
datas e toda migração futura em dobro.

## Decisão

O assistente de configuração oferece duas saídas: **instalar um Postgres só para o Deixa** (recomendado) ou
**usar um Postgres que já existe**. A primeira baixa os binários oficiais empacotados pelo projeto zonky no
Maven Central (Postgres 17.6, cerca de 15 a 30 MB por plataforma, com SHA-256 fixado no código), extrai com o
`tar` do sistema, roda `initdb` com usuário e senha próprios, sobe o `postgres` como processo filho só em
`127.0.0.1` numa porta livre entre 1443 e 1499, cria o banco e grava a conexão em `database-url.txt` como
qualquer outra. Tudo fica em `<pasta de configuração>/postgres/` (`binaries/`, `data/`, `embedded.json`).

Em toda inicialização e em toda conferência do estado do banco, o servidor sobe o Postgres embutido se ele
estiver configurado e parado. `SIGTERM` e `SIGINT` param o Postgres antes de sair; a casca Tauri, que encerra
o Node à força, lê o `postmaster.pid` e encerra o Postgres também.

## Consequências

- Nada muda em schema, migrações, repositórios ou testes: é o mesmo Postgres.
- Cerca de 130 MB em disco depois de extraído e cerca de 45 MB de memória com o banco parado.
- Os binários não vêm no instalador: a primeira abertura precisa de internet para baixar uma vez.
- Dependência do `tar` do sistema (macOS e Windows 10+ trazem; no Linux precisa de `xz`).
- No Windows o Postgres se recusa a rodar como Administrador; o app precisa rodar como usuário comum.
- Uma versão nova do Postgres entra trocando a constante e os hashes; a pasta `binaries/<versão>/` separa
  as versões, e a atualização dos dados (`pg_upgrade`) fica para quando for preciso.

## Alternativas descartadas

- PGlite: memória (ver acima).
- SQLite: custo de duas versões de tudo que toca o banco.
- Binários dentro do instalador: o do Windows passaria de 28 MB para perto de 90 MB; pode voltar à mesa.
- Pacotes npm `@embedded-postgres/*`: os tarballs do npm perdem os links simbólicos das bibliotecas e o
  `initdb` não abre; os jars do Maven preservam.

---
title: Conformidade
updated: 2026-10-10
source: PROJETO.md §5, §6, §7, §10
---

# Conformidade

## Direitos de legendas e roteiros

- Legendas e roteiros de obras reais têm direitos autorais. O repositório não carrega esse material: seeds,
  fixtures e testes usam diálogos fictícios.
- Arquivos enviados pelos usuários ficam em `data/`, fora do git.
- O catálogo compartilhado não deve tornar públicos arquivos sem autorização. Antes de abrir para terceiros,
  revisar os direitos de redistribuição, com atenção à leitura do episódio inteiro, que exibe a legenda completa.
- Busca de transcrição por IA: só fontes com permissão, origem guardada em `source_url`, roteiro completo nunca
  exibido publicamente, trechos não conferidos marcados como "não verificado".

## TMDB

- A API identifica obras; não fornece legendas.
- Atribuição obrigatória na interface: o nome TMDB e o aviso "This product uses the TMDB API but is not endorsed
  or certified by TMDB."
- Credenciais só no servidor.

## Dados pessoais

- Conta: nome, e-mail e hash de senha. Nada além do necessário.
- Progresso, marcações, cards e revisões são individuais e nunca aparecem para outra conta.
- Marcações só entram em contagem anônima quando o usuário escolhe "Para o catálogo", e a contagem só aparece a
  partir de um mínimo, para não identificar ninguém.

## Chave de IA do usuário

- Cifrada com AES-256-GCM; a chave mestra fica em variável de ambiente.
- Nunca em texto puro, log, URL, resposta de API ou `localStorage`.
- O usuário pode testar, trocar e remover. A interface avisa que o uso pode gerar cobrança na conta Google dele.

## Segredos

- Só em variáveis de ambiente, validadas por Zod. `.env*` fora do git, com exceção do `.env.example`, que lista
  os nomes sem valores.

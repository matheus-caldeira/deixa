---
title: Índice do .contexts
updated: 2026-10-10
source: PROJETO.md (visão e especificação do MVP) e deixa.html (protótipo aprovado)
---

# .contexts — fonte da verdade

Este diretório guarda o conhecimento do produto (negócio, produto e engenharia). Ele é a **fonte da verdade**.
O `.claude/` apenas **ativa** esse conhecimento (rules sempre-ativas ou por caminho, skills sob demanda, agents,
hooks) e referencia `.contexts/` em vez de duplicar conteúdo.

O produto é o **Deixa** (nome provisório): plataforma para aprender inglês a partir das séries e filmes que a
pessoa já assiste. A especificação completa está em `PROJETO.md`, na raiz; em caso de dúvida, ela manda.

## Mapa das pastas

| Pasta          | Conteúdo                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `business/`    | `vision.md` (problema, valor, fases), `brand.md` (nome, logotipo, cor), `glossary.md` (vocabulário único), `compliance.md` (direitos, segredos, IA)                                                             |
| `product/`     | `persona.md` (quem usa), `tone-of-voice.md` (como o produto fala), `design-system.md` (tokens, tipografia, componentes), `product-scope.md` (entregas)                                                          |
| `engineering/` | `architecture/`, `decisions/` (ADRs a partir de 0001 e `journal.md`, o diário de decisões), `development.md` (como rodar, testar e empacotar), `rules/` (invariantes de código), `stacks/` (uma por tecnologia) |

Fora daqui: `.superpowers/planning/PLAN.md` (tarefas da etapa em curso, local). O diário de decisões
(`engineering/decisions/journal.md`) guarda as escolhas feitas durante a execução, com data, motivo e alternativa
descartada; decisão que vira regra permanente ganha um ADR.

## Convenção de front-matter

Todo arquivo `.md` abre com:

```yaml
---
title: Nome do documento
updated: 2026-10-10 # data da última revisão de conteúdo
source: PROJETO.md §x # de onde o conteúdo deriva
---
```

Documentos de stack acrescentam `package:`, `version:` e `docs:`.

## Regras de manutenção

1. **Atualize `.contexts/` primeiro, depois o ativador.** Mudou uma regra de negócio ou de código? Edite o
   documento aqui; só então ajuste a rule, skill ou agent correspondente em `.claude/`.
2. Referencie outro documento com `@.contexts/<pasta>/<arquivo>.md`.
3. Use os termos do [glossário](business/glossary.md); não crie sinônimos.
4. Português do Brasil com acentuação correta; identificadores de código em inglês.
5. Tecnologia fora da stack só pode ser citada como alternativa rejeitada.

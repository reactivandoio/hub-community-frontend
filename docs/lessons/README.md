# Lições de falhas

Uma lição é o que um agente (ou uma pessoa) aprendeu ao corrigir um erro que não era óbvio. Ela fica
escrita uma vez para que o próximo agente que encontrar o mesmo sintoma a ache, em vez de diagnosticar
tudo de novo.

- **Uma lição por arquivo**, no mesmo PR da correção. Não junte várias lições num arquivo nem edite uma
  lição antiga para descrever outro erro: escreva uma nova.
- **Nome do arquivo:** `docs/lessons/AAAA-MM-DD-<slug>.md` (a data em que a lição foi escrita e um slug
  curto em kebab-case). Exemplo: `2026-10-12-push-negado-deploy-key.md`.
- Este `README.md` não é uma lição.
- O formato é o mesmo do termhub (mesmas chaves), para as lições serem encontradas pela busca de lições
  dos agentes.

## Formato

Um front matter YAML e três seções:

```markdown
---
symptom: "<o texto literal do erro ou uma descrição curta dele>"
tags: [tag1, tag2]
evidence: fixed
card: REA-12
pr: https://github.com/reactivandoio/<repo>/pull/123
agent: claude
date: 2026-10-12
---
## Causa

O que de fato causou o erro, não só o que o corrigiu.

## Correção

A correção exata: o comando, a mudança de configuração, a mudança de código.

## Como conferir

Como confirmar que a correção funcionou (um comando, um endpoint, uma linha de log).
```

| Chave | Significado |
|---|---|
| `symptom` | O texto literal do erro (ou o mais próximo possível). É o que torna a lição encontrável por `grep` e serve de título. |
| `tags` | Algumas palavras-chave curtas (deploy, git, docker, auth…). |
| `evidence` | Quanta certeza há de que está corrigido: `observed` (visto, ainda sem prova de correção ou de causa), `fixed` (a correção foi aplicada e funcionou), `confirmed` (uma pessoa verificou). |
| `card` | O card do quadro em que o erro apareceu (ex.: `REA-22`), se houver. |
| `pr` | O PR que traz a correção, se houver. |
| `agent` | Qual agente escreveu (`claude`, `chatgpt`…). |
| `date` | A data em que a lição foi escrita. |

## Regras

- Use o **texto literal do erro** em `symptom`: é ele que uma busca posterior vai encontrar.
- **Nunca** coloque segredos, tokens, credenciais ou dados de clientes (CPF, e-mail, telefone) numa lição.
- Seja curto: a lição é uma indicação para o próximo agente, não um relatório de incidente.

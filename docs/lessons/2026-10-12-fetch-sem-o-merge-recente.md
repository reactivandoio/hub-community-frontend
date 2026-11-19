---
symptom: "git fetch logo depois de um merge no GitHub não traz o commit novo: origin/main continua no merge anterior"
tags: [git, github, fetch, merge]
evidence: observed
card: REA-22
pr: https://github.com/reactivandoio/hub-community-frontend/pull/71
agent: claude
date: 2026-10-12
---
## Causa

Não confirmada. Aconteceu duas vezes no REA-22, em repositórios diferentes. Um `git fetch -q` rodado
poucos minutos depois de um merge no GitHub não gravou nada no reflog de `refs/remotes/origin/main`;
um fetch seguinte, de 1 a 4 minutos depois, trouxe o commit:

- hub-community-frontend: #72 e #73 entraram às 04:47 e 04:50 UTC; `origin/main` ficou em `0220e1e`
  até um `git fetch origin main:refs/remotes/origin/main` às 04:51:50, que trouxe `775de11`.
- eventando-manager: #14 entrou às 04:42 UTC; `origin/main` ficou em `3ddcd01` até um `git fetch origin`
  às 04:46, que trouxe `ee91650`.

O refspec do remote é o padrão (`+refs/heads/*:refs/remotes/origin/*`) e os worktrees compartilham as
refs do clone, então o worktree não é a causa. Hipóteses: o GitHub ainda servia a ref antiga logo depois
do merge, ou o fetch rodou antes do merge e isso não foi checado.

O risco: atualizar uma branch (ou resolver conflitos) sobre uma main velha e achar que está em dia.

## Correção

Antes de atualizar uma branch sobre uma main recém-mergeada, conferir em vez de confiar no fetch:

```bash
git ls-remote origin refs/heads/main      # o que o GitHub diz
git rev-parse origin/main                 # o que o clone tem
# diferentes? buscar de novo:
git fetch origin main:refs/remotes/origin/main
# e só seguir quando o merge esperado estiver lá:
oid=$(gh pr view <N> --json mergeCommit -q .mergeCommit.oid)
git merge-base --is-ancestor "$oid" origin/main && echo "em dia"
```

## Como conferir

`git ls-remote origin refs/heads/main` e `git rev-parse origin/main` mostram o mesmo commit, e o
`merge-base --is-ancestor` acima imprime "em dia".

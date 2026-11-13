---
symptom: "ERROR: Permission to reactivandoio/<repo>.git denied to deploy key"
tags: [git, github, push, jarvis]
evidence: fixed
card: REA-22
pr: https://github.com/reactivandoio/hub-community-backend/pull/20
agent: claude
date: 2026-10-12
---
## Causa

Na máquina jarvis, os clones dos repositórios do Hub Community usam o remote SSH
(`git@github.com:reactivandoio/<repo>.git`), e a chave SSH da máquina é uma deploy key só de leitura.
`git fetch` funciona; `git push` é recusado. O `gh` está logado (conta com escopo `repo`), mas o
protocolo do git configurado no `gh` é `ssh`, então ele não entra no caminho do push.

## Correção

Fazer o push por HTTPS usando a credencial do `gh`, sem mudar o remote:

```bash
git -c credential.helper='!gh auth git-credential' \
  push -u https://github.com/reactivandoio/<repo>.git <branch>
gh pr create --repo reactivandoio/<repo> --head <branch> --base main ...
```

Como o push não foi para `origin`, o `gh pr create` precisa de `--repo` e `--head`.

## Como conferir

`git ls-remote https://github.com/reactivandoio/<repo>.git refs/heads/<branch>` mostra o mesmo commit
que `git rev-parse HEAD`.

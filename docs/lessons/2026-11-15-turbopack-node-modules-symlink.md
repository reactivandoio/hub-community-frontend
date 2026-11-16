---
symptom: "Error [TurbopackInternalError]: Symlink node_modules is invalid, it points out of the filesystem root"
tags: [build, turbopack, worktree, node_modules, pnpm]
evidence: fixed
card: REA-50
agent: claude
date: 2026-11-15
---
## Causa

Num worktree novo, o `node_modules` era um link simbólico para o `node_modules` de outro worktree
(`ln -s ../hub-community-frontend-rea-26/node_modules node_modules`), para não instalar tudo de novo.
O Vitest funciona assim, mas o `pnpm build` (Next 16 com Turbopack) recusa um `node_modules` que aponta
para fora da raiz do projeto e para com essa mensagem de pânico. Não é erro do código.

## Correção

Apagar o link e instalar as dependências de verdade no worktree. Com a store do pnpm já cheia, é rápido:

```bash
rm node_modules && pnpm install --frozen-lockfile --prefer-offline
```

## Como conferir

`pnpm build` termina com `✓ Compiled successfully` e lista as rotas.

#!/bin/bash
# Apaga secrets aposentados do Environment "production" deste repositório no GitHub e
# dispara o deploy de env (deploy-env.yml, modo apply), que tira as mesmas variáveis do
# .env do servidor e refaz o build.
#
# Uso: ./env-remove-from-github.sh NOME [NOME...]      (ex.: NEXT_PUBLIC_ADMIN_PASSWORD)
#      ./env-remove-from-github.sh --sem-deploy NOME   só apaga o secret
#
# Só aceita nomes listados em .github/env-removed na main: assim o deploy não aborta pela
# variável que continua no .env do servidor (env-swap.sh deixa a variável sair). Não imprime valores.
set -euo pipefail

cd "$(dirname "$0")"
ENVIRONMENT="${GH_ENVIRONMENT:-production}"
DEPLOY=1
if [ "${1:-}" = "--sem-deploy" ]; then DEPLOY=0; shift; fi
[ "$#" -gt 0 ] || { echo "Uso: $0 [--sem-deploy] NOME [NOME...]" >&2; exit 1; }

command -v gh >/dev/null || { echo "gh não encontrado no PATH." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh não está autenticado: rode gh auth login." >&2; exit 1; }
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# A lista que vale é a da main (é ela que o deploy usa), não a da cópia local.
REMOVED=$(gh api "repos/$REPO/contents/.github/env-removed?ref=main" -H "Accept: application/vnd.github.raw" 2>/dev/null \
  | grep -E '^[A-Za-z_][A-Za-z0-9_]*$' || true)
EXISTING=$(gh secret list --env "$ENVIRONMENT" -R "$REPO" --json name -q '.[].name')

for name in "$@"; do
  printf '%s' "$name" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || { echo "Nome inválido: $name" >&2; exit 1; }
  if ! printf '%s\n' "$REMOVED" | grep -qx "$name"; then
    echo "$name não está em .github/env-removed na main: o deploy abortaria. Liste-o lá, faça o merge e rode de novo." >&2
    exit 1
  fi
done

echo "Apagando de $REPO, Environment $ENVIRONMENT:"
for name in "$@"; do
  if printf '%s\n' "$EXISTING" | grep -qx "$name"; then
    gh secret delete "$name" --env "$ENVIRONMENT" -R "$REPO" >/dev/null
    echo "  $name: apagado"
  else
    echo "  $name: já não existia"
  fi
done

if [ "$DEPLOY" = 1 ]; then
  gh workflow run deploy-env.yml -R "$REPO" --ref main -f mode=apply >/dev/null
  echo "Deploy de env disparado (tira a variável do .env do servidor e refaz o build)."
  echo "Acompanhe: gh run list -R $REPO --workflow deploy-env.yml --limit 1"
fi

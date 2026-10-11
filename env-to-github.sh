#!/bin/bash
# Grava as variáveis de .env.temp como secrets do Environment "production" deste
# repositório no GitHub, que o workflow .github/workflows/deploy-env.yml usa para montar
# o .env do servidor.
#
# Uso: cole as variáveis atuais do servidor em .env.temp (na raiz, ignorado pelo git) e
# rode ./env-to-github.sh. Cada valor vai para o gh pelo stdin, exatamente como está
# depois do "=" (com aspas, se houver), para o .env remontado ficar igual ao original.
# Só os nomes aparecem na saída.
set -euo pipefail

cd "$(dirname "$0")"
FILE="${1:-.env.temp}"
ENVIRONMENT="${GH_ENVIRONMENT:-production}"

command -v gh >/dev/null || { echo "gh não encontrado no PATH." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh não está autenticado: rode gh auth login." >&2; exit 1; }
[ -f "$FILE" ] || { echo "Não achei $FILE. Cole nele as variáveis atuais e rode de novo." >&2; exit 1; }
if git ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
  echo "$FILE está rastreado pelo git. Tire-o do repositório antes de continuar." >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Confere o arquivo inteiro antes de gravar qualquer coisa.
errors=0
n=0
while IFS= read -r line || [ -n "$line" ]; do
  n=$((n + 1))
  line=${line%$'\r'}
  line="${line#"${line%%[![:space:]]*}"}"
  case "$line" in '' | '#'*) continue ;; esac
  line=${line#export }
  case "$line" in *=*) ;; *) echo "Linha $n: sem '='." >&2; errors=$((errors + 1)); continue ;; esac
  key=${line%%=*}
  value=${line#*=}
  if ! printf '%s' "$key" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "Linha $n: nome de variável inválido." >&2; errors=$((errors + 1)); continue
  fi
  case "$key" in
    GITHUB_* | github_*) echo "Linha $n: $key começa com GITHUB_, que o GitHub não aceita como secret." >&2; errors=$((errors + 1)); continue ;;
  esac
  for q in '"' "'"; do
    case "$value" in
      "$q"*)
        if [ "${#value}" -lt 2 ] || [ "${value%"$q"}" = "$value" ]; then
          echo "Linha $n ($key): aspas sem fechar no fim da linha (valor em várias linhas ou comentário depois das aspas não são suportados)." >&2; errors=$((errors + 1))
        fi ;;
    esac
  done
done < "$FILE"
[ "$errors" -eq 0 ] || { echo "Nada foi gravado: corrija as $errors linha(s) acima." >&2; exit 1; }

gh api -X PUT "repos/$REPO/environments/$ENVIRONMENT" >/dev/null

echo "Gravando em $REPO, Environment $ENVIRONMENT:"
count=0
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  line="${line#"${line%%[![:space:]]*}"}"
  case "$line" in '' | '#'*) continue ;; esac
  line=${line#export }
  key=${line%%=*}
  value=${line#*=}
  # O GitHub não aceita secret vazio; "" no .env é o mesmo valor vazio.
  [ -n "$value" ] || value='""'
  if ! printf '%s' "$value" | gh secret set "$key" --env "$ENVIRONMENT" -R "$REPO" >/dev/null 2>&1; then
    echo "  $key: falhou ao gravar" >&2
    exit 1
  fi
  echo "  $key"
  count=$((count + 1))
done < "$FILE"
value=""

echo "$count variável(is) gravada(s)."
echo "Agora apague o arquivo com as variáveis: rm $(pwd)/$FILE"

#!/bin/bash
# Roda no servidor, chamado pelo .github/workflows/deploy-env.yml (ssh ... bash -s).
#
#   env-swap.sh compare <dir> [arquivo]  compara <arquivo>.next (montado dos secrets do
#                                        GitHub) com o <arquivo> atual e apaga o .next;
#                                        não troca nada.
#   env-swap.sh apply <dir> [arquivo]    guarda o atual em <arquivo>.bak-<data>, põe o
#                                        .next no lugar e roda make update.
#
# Nunca imprime valores: só nomes de variáveis e o resultado da comparação.
set -euo pipefail

MODE="${1:?modo: compare ou apply}"
DIR="${2:?diretório do projeto}"
ENV_FILE="${3:-.env}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

cd "$DIR"
NEXT="$ENV_FILE.next"
[ -f "$NEXT" ] || { echo "Não achei $DIR/$NEXT." >&2; exit 1; }
chmod 600 "$NEXT"

swapped=0
cleanup() { [ "$swapped" = 1 ] || rm -f "$NEXT"; }
trap cleanup EXIT

if command -v sha256sum >/dev/null; then hash() { sha256sum | cut -d' ' -f1; }; else hash() { shasum -a 256 | cut -d' ' -f1; }; fi

KEY_RE='^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*='
keys() { [ -f "$1" ] || return 0; grep -E "$KEY_RE" "$1" | sed -E 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/' | sort -u; }
# Hash do último valor da chave, como no dotenv (vale a última ocorrência).
value_hash() {
  grep -E "^[[:space:]]*(export[[:space:]]+)?$2=" "$1" | tail -n 1 \
    | sed -E "s/^[[:space:]]*(export[[:space:]]+)?$2=//" | tr -d '\r' | hash
}

current_keys=$(keys "$ENV_FILE")
next_keys=$(keys "$NEXT")
missing=$(comm -23 <(printf '%s\n' "$current_keys" | sed '/^$/d') <(printf '%s\n' "$next_keys" | sed '/^$/d'))

case "$MODE" in
  compare)
    [ -f "$ENV_FILE" ] || echo "Não existe $ENV_FILE em $DIR: todas as variáveis aparecem como novas."
    same=0; diff=0; new=0; miss=0
    for key in $(printf '%s\n%s\n' "$current_keys" "$next_keys" | sed '/^$/d' | sort -u); do
      in_cur=$(printf '%s\n' "$current_keys" | grep -qx "$key" && echo 1 || echo 0)
      in_next=$(printf '%s\n' "$next_keys" | grep -qx "$key" && echo 1 || echo 0)
      if [ "$in_cur" = 1 ] && [ "$in_next" = 1 ]; then
        if [ "$(value_hash "$ENV_FILE" "$key")" = "$(value_hash "$NEXT" "$key")" ]; then
          echo "  igual      $key"; same=$((same + 1))
        else
          echo "  diferente  $key"; diff=$((diff + 1))
        fi
      elif [ "$in_cur" = 1 ]; then
        echo "  faltando   $key (está no servidor, não no GitHub)"; miss=$((miss + 1))
      else
        echo "  novo       $key (está no GitHub, não no servidor)"; new=$((new + 1))
      fi
    done
    echo "Resumo: $same igual(is), $diff diferente(s), $miss faltando no GitHub, $new novo(s)."
    echo "Nada foi trocado no servidor."
    ;;
  apply)
    if [ -n "$missing" ]; then
      echo "Abortado: estas variáveis estão no $ENV_FILE do servidor e não no GitHub:" >&2
      printf '  %s\n' $missing >&2
      echo "Grave-as com ./env-to-github.sh e rode de novo. Nada foi trocado." >&2
      exit 1
    fi
    backup=""
    if [ -f "$ENV_FILE" ]; then
      backup="$ENV_FILE.bak-$(date +%Y%m%d%H%M%S)"
      cp -p "$ENV_FILE" "$backup"
      chmod 600 "$backup"
      ls -1t "$ENV_FILE".bak-* 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | while IFS= read -r old; do rm -f "$old"; done
    fi
    mv -f "$NEXT" "$ENV_FILE"
    swapped=1
    echo "$ENV_FILE trocado${backup:+ (anterior em $backup)}."
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    if [ -s "$NVM_DIR/nvm.sh" ]; then set +u; . "$NVM_DIR/nvm.sh"; set -u; fi
    if ! make update; then
      echo "make update falhou. O $ENV_FILE novo já está no lugar." >&2
      [ -n "$backup" ] && echo "Para voltar: cd $DIR && cp $backup $ENV_FILE && make update" >&2
      exit 1
    fi
    ;;
  *) echo "Modo inválido: $MODE (use compare ou apply)." >&2; exit 1 ;;
esac

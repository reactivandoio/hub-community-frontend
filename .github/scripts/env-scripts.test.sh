#!/bin/bash
# Testes do env-to-github.sh, do env-swap.sh e do passo que monta o .env no deploy-env.yml.
# Usam um gh e um make falsos; nada sai da máquina. Rodar da raiz: bash .github/scripts/env-scripts.test.sh
# Precisa de: bash, git, jq, ruby (para ler o passo do workflow).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fails=0
ok() { echo "ok   - $1"; }
ko() { echo "FAIL - $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

# ---------- gh e make falsos ----------
mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<'SH'
#!/bin/bash
echo "$*" >> "$GH_LOG/args"
case "$1 $2" in
  "auth status") exit "${FAKE_GH_AUTH:-0}" ;;
  "repo view") echo "acme/app" ;;
  "api -X") echo "{}" ;;
  "secret set") cat > "$GH_LOG/secret-$3" ;;
esac
SH
cat > "$WORK/bin/make" <<'SH'
#!/bin/bash
echo "make $*" >> "$MAKE_LOG"
exit "${FAKE_MAKE_EXIT:-0}"
SH
chmod +x "$WORK/bin/gh" "$WORK/bin/make"
export PATH="$WORK/bin:$PATH"

new_repo() {
  local d="$WORK/repo-$1"
  mkdir -p "$d" && git -C "$d" init -q && cp "$ROOT/env-to-github.sh" "$d/" && printf '.env.temp\n' > "$d/.gitignore"
  mkdir -p "$d/gh"
  echo "$d"
}

# ---------- env-to-github.sh ----------
R=$(new_repo ok); export GH_LOG="$R/gh"
printf '# comentário\n\n  export A=1\nB="x y # não é comentário"\nC=\nD=crlf\r\nE=a=b\nSEGREDO=super-secreto-123\n' > "$R/.env.temp"
OUT=$("$R/env-to-github.sh" 2>&1); RC=$?
check "grava e sai com 0" '[ $RC -eq 0 ]'
check "imprime só os nomes" 'printf "%s" "$OUT" | grep -qx "  A" && printf "%s" "$OUT" | grep -qx "  SEGREDO"'
check "não imprime valores" '! printf "%s" "$OUT" | grep -q "super-secreto-123\|x y\|crlf"'
check "valor não vai em argumento do gh" '! grep -q "super-secreto-123" "$GH_LOG/args"'
check "valor vai pelo stdin, exato" '[ "$(cat "$GH_LOG/secret-SEGREDO")" = "super-secreto-123" ]'
check "aspas preservadas" "[ \"\$(cat \"\$GH_LOG/secret-B\")\" = '\"x y # não é comentário\"' ]"
check "vazio vira \"\"" "[ \"\$(cat \"\$GH_LOG/secret-C\")\" = '\"\"' ]"
check "CR do fim de linha removido" '[ "$(cat "$GH_LOG/secret-D")" = "crlf" ]'
check "valor com = mantido" '[ "$(cat "$GH_LOG/secret-E")" = "a=b" ]'
check "export removido do nome" '[ -f "$GH_LOG/secret-A" ] && [ "$(cat "$GH_LOG/secret-A")" = "1" ]'
check "comentário e linha vazia ignorados" '[ "$(ls "$GH_LOG" | grep -c "^secret-")" -eq 6 ]'
check "usa o Environment production" 'grep -q "secret set SEGREDO --env production -R acme/app" "$GH_LOG/args"'
check "avisa para apagar o .env.temp" 'printf "%s" "$OUT" | grep -q "rm .*\.env\.temp"'

R=$(new_repo bad); export GH_LOG="$R/gh"
printf 'A=1\nsem igual\n9X=2\nM="começa e não fecha\n' > "$R/.env.temp"
OUT=$("$R/env-to-github.sh" 2>&1); RC=$?
check "linha inválida: sai com erro" '[ $RC -ne 0 ]'
check "linha inválida: nada gravado" '! ls "$GH_LOG" | grep -q "^secret-"'
check "linha inválida: aponta as linhas sem mostrar o conteúdo" 'printf "%s" "$OUT" | grep -q "Linha 2" && printf "%s" "$OUT" | grep -q "Linha 3" && printf "%s" "$OUT" | grep -q "Linha 4" && ! printf "%s" "$OUT" | grep -q "sem igual"'

R=$(new_repo noauth); export GH_LOG="$R/gh"
printf 'A=1\n' > "$R/.env.temp"
OUT=$(FAKE_GH_AUTH=1 "$R/env-to-github.sh" 2>&1); RC=$?
check "gh sem login: falha" '[ $RC -ne 0 ] && printf "%s" "$OUT" | grep -q "não está autenticado"'

R=$(new_repo tracked); export GH_LOG="$R/gh"
printf 'A=1\n' > "$R/.env.temp"; : > "$R/.gitignore"; git -C "$R" add -f .env.temp
OUT=$("$R/env-to-github.sh" 2>&1); RC=$?
check ".env.temp rastreado: falha sem gravar" '[ $RC -ne 0 ] && ! ls "$GH_LOG" | grep -q "^secret-"'

R=$(new_repo missing); export GH_LOG="$R/gh"
OUT=$("$R/env-to-github.sh" 2>&1); RC=$?
check "sem .env.temp: falha" '[ $RC -ne 0 ]'

# ---------- env-swap.sh ----------
SWAP="$ROOT/.github/scripts/env-swap.sh"
export MAKE_LOG="$WORK/make.log"
# Sem nvm de verdade no teste (o nvm.sh desta máquina pode travar fora de um shell interativo).
export NVM_DIR="$WORK/sem-nvm"
S="$WORK/srv"; mkdir -p "$S"
setup_srv() {
  rm -rf "$S"; mkdir -p "$S"; : > "$MAKE_LOG"
  printf 'A=1\nB="dois"\nSO_SERVIDOR=x\n' > "$S/.env"
  printf 'A=1\nB="outro"\nSO_SERVIDOR=x\nNOVA=y\n' > "$S/.env.next"
}

setup_srv
OUT=$(bash "$SWAP" compare "$S" .env 2>&1); RC=$?
check "compare: sai com 0" '[ $RC -eq 0 ]'
check "compare: igual/diferente/novo por nome" 'printf "%s" "$OUT" | grep -q "igual *A" && printf "%s" "$OUT" | grep -q "diferente *B" && printf "%s" "$OUT" | grep -q "novo *NOVA"'
check "compare: não imprime valores" '! printf "%s" "$OUT" | grep -q "dois\|outro"'
check "compare: não troca o .env" '[ "$(cat "$S/.env")" = "$(printf "A=1\nB=\"dois\"\nSO_SERVIDOR=x")" ]'
check "compare: apaga o .env.next" '[ ! -e "$S/.env.next" ]'
check "compare: não roda make" '[ ! -s "$MAKE_LOG" ]'

setup_srv
printf 'A=1\n' > "$S/.env.next"
OUT=$(bash "$SWAP" apply "$S" .env 2>&1); RC=$?
check "apply com variável faltando: aborta" '[ $RC -ne 0 ] && printf "%s" "$OUT" | grep -q "SO_SERVIDOR"'
check "apply com variável faltando: .env intacto e .next apagado" 'grep -q "dois" "$S/.env" && [ ! -e "$S/.env.next" ] && [ ! -s "$MAKE_LOG" ]'

setup_srv
OUT=$(bash "$SWAP" apply "$S" .env 2>&1); RC=$?
check "apply: troca, guarda backup e roda make update" '[ $RC -eq 0 ] && grep -q "outro" "$S/.env" && ls "$S"/.env.bak-* >/dev/null 2>&1 && grep -q "dois" "$S"/.env.bak-* && grep -qx "make update" "$MAKE_LOG"'
check "apply: arquivos com permissão 600" '[ "$(stat -f %Lp "$S/.env" 2>/dev/null || stat -c %a "$S/.env")" = 600 ]'

setup_srv
for i in 1 2 3 4 5 6 7; do : > "$S/.env.bak-2026010100000$i"; done
bash "$SWAP" apply "$S" .env >/dev/null 2>&1
check "apply: mantém só os 5 backups mais novos" '[ "$(ls "$S"/.env.bak-* | wc -l | tr -d " ")" -eq 5 ]'

setup_srv
OUT=$(FAKE_MAKE_EXIT=2 bash "$SWAP" apply "$S" .env 2>&1); RC=$?
check "apply com make falhando: sai com erro e diz como voltar" '[ $RC -ne 0 ] && printf "%s" "$OUT" | grep -q "Para voltar"'

# ---------- passo "Montar o .env" do workflow ----------
STEP=$(ruby -ryaml -e 'puts YAML.load_file(ARGV[0])["jobs"]["deploy"]["steps"].find { |s| s["name"].start_with?("Montar") }["run"]' "$ROOT/.github/workflows/deploy-env.yml")
export RUNNER_TEMP="$WORK/runner"; mkdir -p "$RUNNER_TEMP"
export ALL_SECRETS='{"github_token":"ghs_x","SSH_HOST":"h","SSH_PRIVATE_KEY":"k","A":"1","B":"\"x y\"","OPAPINGOU_API_KEY":"opk_test_abc"}'
OUT=$(bash -c "$STEP" 2>&1); RC=$?
check "workflow: monta o .env" '[ $RC -eq 0 ] && grep -qx "A=1" "$RUNNER_TEMP/app.env" && grep -qx "B=\"x y\"" "$RUNNER_TEMP/app.env" && grep -qx "OPAPINGOU_API_KEY=opk_test_abc" "$RUNNER_TEMP/app.env"'
check "workflow: tira SSH_* e github_token do .env" '! grep -qi "^ssh_\|^github_token" "$RUNNER_TEMP/app.env"'
check "workflow: log só com nomes" '! printf "%s" "$OUT" | grep -q "opk_test_abc\|x y"'

echo
[ "$fails" -eq 0 ] && echo "Todos os testes passaram." || { echo "$fails teste(s) falharam."; exit 1; }

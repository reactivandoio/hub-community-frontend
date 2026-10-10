# REA-6 — Inscrição paga com Opa Pingou e cupom: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** inscrição paga em evento do Hub Community cobrada pelo Opa Pingou (Pix ou link de
pagamento), confirmada só depois de reconsultar a cobrança, com cupom de desconto e CPF na
inscrição.

**Architecture:** o Eventando Manager (Strapi 4) calcula o preço, reserva a vaga e o uso do cupom
numa transação com trava, cria a cobrança (a chave `opk_` fica só nele) e guarda os eventos de
webhook. O BFF (Express + Apollo) recebe o webhook, valida a assinatura, grava o evento no
Eventando, responde 2xx e processa depois (reconsulta → transição → e-mail). O frontend (Next.js)
mostra Pix/link, cupom, CPF e a aba de cupons do admin.

**Tech Stack:** Strapi 4.25 + MySQL (knex) + axios, `node --test` (Eventando, sem dependência
nova); Express 4 + Apollo 4 + Vitest (BFF); Next 16 + Apollo Client + Vitest + pnpm (frontend).

**Spec:** `docs/superpowers/specs/2026-10-10-pagamento-opa-pingou-design.md` (a §0 prevalece).

## Global Constraints

- Valores sempre em centavos inteiros; `amountCents` > 0; arredondamento do **valor final** para
  baixo.
- `validity: FIFTEEN_MIN`; sem `bankAccountId`; `kind` `PIX_QR` ou `PAYMENT_LINK`.
- `Idempotency-Key = signup-payment-<paymentId>-v<n>`, gravada antes da chamada.
- Erros do Opa Pingou tratados pelo `code`; `requestId` no log; 429 → recuo crescente (1 s, 2 s,
  4 s, máx. 3 tentativas); 409/400 de idempotência → sem repetição, `alert()`.
- `OPAPINGOU_ENABLED=false` por padrão no Eventando e no BFF.
- Segredos (`opk_…`, `whsec_…`) e CPF nunca em código, log, mensagem de erro, PR, spec ou resposta
  pública.
- Webhook: HMAC-SHA256 hex minúsculo de `"<t>.<corpo bruto>"`, tempo constante, janela 300 s.
- Eventos tratados: `charge.paid`, `charge.expired`, `charge.canceled`, `payment.confirmed`,
  `payment.refunded`, `payment.charged_back`; `ping` → 200; demais → 200 ignorado.
- Cupom: um evento; código único por evento; percentual 1–100 ou fixo; meia **ou** cupom, o maior
  (empate = meia, cupom não consumido); um cupom por evento por CPF; datas vazias = período do
  lote; tipo e valor travam após o primeiro uso; só admin cria.
- Mínimo de cobrança configurável por provedor (`OPAPINGOU_MIN_CHARGE_CENTS`,
  `PIXAI_MIN_CHARGE_CENTS`, padrão 1); abaixo dele sobe para o mínimo e avisa.
- CPF obrigatório em toda inscrição nova (gratuita ou paga), validado no servidor, guardado em
  texto puro em `Signup.cpf` com `private: true`; nunca em rota pública, log ou e-mail.
- Pix pago depois de vencer é honrado, mesmo passando 1 da lotação ou do limite do cupom.
- Nenhuma cobrança real, merge ou deploy sem ok explícito do Pedro.

## Review Focus

1. Duas inscrições simultâneas na última vaga ou no último uso do cupom → exatamente uma passa
   (Task E5, teste de concorrência contra MySQL).
2. Webhook com corpo reformatado por algum middleware (JSON reserializado) → a assinatura falha;
   a rota precisa do corpo cru antes do `bodyParser.json()` (Task B3, teste com corpo com espaços
   e acentos).
3. `charge.expired` chegando depois de `charge.paid` → o pagamento continua `CONFIRMED`
   (Task E4, teste de transição fora de ordem).
4. Timeout na criação da cobrança seguido de nova tentativa da pessoa → mesma cobrança, não duas
   (Task E3, teste de replay com a mesma chave).
5. CPF com máscara, com espaços ou com dígito errado → normaliza ou recusa, sem ecoar o valor na
   mensagem (Task E1, testes de `cpf.js`).

---

## Repositório `reactivandoio/eventando-manager`

Branch `REA-6-opapingou` a partir de `origin/main`. PR em rascunho. Testes: `node --test test/`
(script `"test": "node --test test/"` no `package.json`).

### Task E1: módulos puros — CPF, preço e cupom

**Files:**
- Create: `src/utils/cpf.js`, `src/utils/pricing.js`
- Test: `test/cpf.test.js`, `test/pricing.test.js`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `normalizeCpf(value: string): string | null` (11 dígitos válidos ou `null`)
  - `price({ baseCents, coupon, isStudent, studentEligible, minChargeCents }) →
    { originalCents, discountKind: 'coupon'|'student'|null, discountCents, finalCents,
      minApplied: boolean, couponConsumed: boolean }`
  - `couponWindow(coupon, batch) → { startsAt: Date|null, endsAt: Date|null }`

- [ ] **Step 1: testes de CPF**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCpf } = require('../src/utils/cpf');

test('aceita CPF válido com ou sem máscara', () => {
  assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
  assert.equal(normalizeCpf(' 52998224725 '), '52998224725');
});
test('recusa dígito verificador errado, tamanho errado e repetidos', () => {
  assert.equal(normalizeCpf('529.982.247-24'), null);
  assert.equal(normalizeCpf('5299822472'), null);
  assert.equal(normalizeCpf('111.111.111-11'), null);
  assert.equal(normalizeCpf(null), null);
});
```

- [ ] **Step 2:** `node --test test/cpf.test.js` → FAIL (módulo não existe).
- [ ] **Step 3: implementação**

```js
const digit = (digits, len) => {
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += Number(digits[i]) * (len + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
};

const normalizeCpf = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return null;
  if (digit(digits, 9) !== Number(digits[9])) return null;
  if (digit(digits, 10) !== Number(digits[10])) return null;
  return digits;
};

module.exports = { normalizeCpf };
```

- [ ] **Step 4:** `node --test test/cpf.test.js` → PASS.
- [ ] **Step 5: testes de preço**

```js
const { price } = require('../src/utils/pricing');
const pct = (p) => ({ discount_type: 'percentage', discount_percentage: p });
const fixed = (c) => ({ discount_type: 'fixed', discount_value_cents: c });

test('percentual arredonda o valor final para baixo', () => {
  const r = price({ baseCents: 2999, coupon: pct(15), minChargeCents: 1 });
  assert.deepEqual([r.finalCents, r.discountKind, r.couponConsumed], [2549, 'coupon', true]);
});
test('fixo maior que o preço zera', () => {
  assert.equal(price({ baseCents: 1000, coupon: fixed(5000), minChargeCents: 1 }).finalCents, 0);
});
test('meia e cupom: vale o maior desconto, nunca os dois', () => {
  const r = price({ baseCents: 10000, coupon: pct(60), isStudent: true, studentEligible: true, minChargeCents: 1 });
  assert.deepEqual([r.finalCents, r.discountKind], [4000, 'coupon']);
});
test('empate meia × cupom: meia, cupom não consumido', () => {
  const r = price({ baseCents: 10000, coupon: pct(50), isStudent: true, studentEligible: true, minChargeCents: 1 });
  assert.deepEqual([r.finalCents, r.discountKind, r.couponConsumed], [5000, 'student', false]);
});
test('abaixo do mínimo sobe para o mínimo e marca o aviso', () => {
  const r = price({ baseCents: 1000, coupon: fixed(950), minChargeCents: 100 });
  assert.deepEqual([r.finalCents, r.minApplied], [100, true]);
});
test('zero não aplica mínimo (inscrição sem cobrança)', () => {
  const r = price({ baseCents: 1000, coupon: pct(100), minChargeCents: 100 });
  assert.deepEqual([r.finalCents, r.minApplied], [0, false]);
});
test('sem cupom e sem meia, preço cheio', () => {
  assert.equal(price({ baseCents: 5000, minChargeCents: 1 }).finalCents, 5000);
});
```

- [ ] **Step 6:** rodar → FAIL.
- [ ] **Step 7: implementação**

```js
const afterCoupon = (base, coupon) => {
  if (!coupon) return null;
  if (coupon.discount_type === 'fixed') return Math.max(0, base - Number(coupon.discount_value_cents));
  return Math.floor((base * (100 - Number(coupon.discount_percentage))) / 100);
};

const price = ({ baseCents, coupon = null, isStudent = false, studentEligible = false, minChargeCents = 1 }) => {
  const base = Number(baseCents) || 0;
  const withStudent = isStudent && studentEligible ? Math.floor(base / 2) : null;
  const withCoupon = afterCoupon(base, coupon);
  let finalCents = base;
  let discountKind = null;
  if (withStudent !== null && (withCoupon === null || withStudent <= withCoupon)) {
    finalCents = withStudent; discountKind = 'student';
  } else if (withCoupon !== null) {
    finalCents = withCoupon; discountKind = 'coupon';
  }
  const minApplied = finalCents > 0 && finalCents < minChargeCents;
  if (minApplied) finalCents = minChargeCents;
  return {
    originalCents: base, discountKind, discountCents: base - finalCents,
    finalCents, minApplied, couponConsumed: discountKind === 'coupon',
  };
};

const couponWindow = (coupon, batch) => ({
  startsAt: coupon.starts_at ? new Date(coupon.starts_at) : batch?.valid_from ? new Date(batch.valid_from) : null,
  endsAt: coupon.expires_at ? new Date(coupon.expires_at) : batch?.valid_until ? new Date(batch.valid_until) : null,
});

module.exports = { price, couponWindow };
```

- [ ] **Step 8:** `yarn test` → PASS. Commit `feat(REA-6): pure CPF, pricing and coupon window`.

### Task E2: schema (Coupon, Payment, Signup, Event, eventos do Opa Pingou)

**Files:**
- Modify: `src/api/coupon/content-types/coupon/schema.json`,
  `src/api/payment/content-types/payment/schema.json`,
  `src/api/signup/content-types/signup/schema.json`,
  `src/api/event/content-types/event/schema.json`
- Create: `src/api/opapingou-event/` (content-type, controller, routes, service)

**Mudanças:**
- Coupon: `code` perde `unique` (unicidade por evento conferida na Task E6);
  `discount_type` enum `percentage|fixed` default `percentage`; `discount_percentage` deixa de
  ser `required` (validado por tipo); `discount_value_cents` biginteger; `starts_at` datetime;
  `batches` manyToMany `api::batch.batch`.
- Payment: status ganha `EXPIRED`; `provider` string; `kind` enum `PIX_QR|PAYMENT_LINK`;
  `provider_charge_id` string; `provider_txid` string; `provider_idempotency_key` string;
  `attempt` integer default 1; `pix_br_code` text; `expires_at`, `expired_at` datetime;
  `discount_kind` enum `coupon|student`; `discount_cents` biginteger; `min_charge_applied`
  boolean.
- Signup: `cpf` string `private: true`.
- Event: `payment_provider` enum `pixai|opapingou` default `pixai`.
- `opapingou-event`: `event_id` string unique required; `type` string; `test_mode` boolean;
  `charge_id` string; `payload` json; `status` enum `pending|processed|ignored|failed` default
  `pending`; `attempts` integer default 0; `last_error` string; `processed_at` datetime.

- [ ] **Step 1:** editar os schemas.
- [ ] **Step 2:** `docker compose up -d` e `yarn develop`; conferir no log que o Strapi sincronizou
  as tabelas sem erro e que cupons e pagamentos existentes continuam abrindo no admin.
- [ ] **Step 3:** commit `feat(REA-6): schema for Opa Pingou payments, coupons and signup CPF`.

### Task E3: datasource do Opa Pingou

**Files:**
- Create: `src/datasources/opapingou/index.js`, `src/datasources/opapingou/errors.js`
- Test: `test/opapingou-datasource.test.js`

**Interfaces:**
- Produces: `createOpaPingou({ baseUrl, apiKey, http = axios, sleep, log }) →
  { me(), createCharge({ amountCents, validity, description, kind, idempotencyKey }),
    getCharge(id) }`; erros lançados como `OpaPingouError { status, code, requestId, retryable }`
  (sem a chave e sem o corpo).

- [ ] **Step 1: testes** (o `http` é um dublê que devolve respostas em fila):

```js
test('cria cobrança com Idempotency-Key e corpo estrito', async () => { /* confere headers e body sem bankAccountId */ });
test('replay: 201 com Idempotent-Replayed devolve a mesma cobrança', async () => { /* replayed: true */ });
test('409 IDEMPOTENCY_KEY_REUSED não repete e chama alert', async () => { /* 1 chamada só */ });
test('400 IDEMPOTENCY_KEY_REQUIRED não repete e chama alert', async () => {});
test('401 vira OpaPingouError UNAUTHENTICATED sem repetir', async () => {});
test('429 espera 1s, 2s e repete; desiste após 3', async () => { /* sleep registrado [1000,2000,4000] */ });
test('timeout de rede repete com a mesma chave', async () => {});
test('log tem code e requestId, nunca a chave', async () => { /* procura opk_ nas linhas */ });
```

- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar com `axios.request({ validateStatus: () => true, timeout: 15000 })`,
  mapear `application/problem+json` para `OpaPingouError`, repetir só em 429, 5xx e erro de rede
  (mesma `Idempotency-Key`), `Retry-After` respeitado se vier.
- [ ] **Step 4:** rodar → PASS. Commit.

### Task E4: transições de status

**Files:**
- Create: `src/utils/payment-transitions.js`
- Test: `test/payment-transitions.test.js`

**Interfaces:**
- Produces: `targetFor(chargeStatus) → 'CONFIRMED'|'EXPIRED'|'CANCELED'|null` e
  `allowedFrom(target) → string[]` (`CONFIRMED` ← `PEDING_PAYMENT|EXPIRED|CANCELED`;
  `EXPIRED|CANCELED` ← `PEDING_PAYMENT`).

- [ ] **Step 1: testes:** `PAID→CONFIRMED`, `PENDING→null`, `expired` depois de `CONFIRMED` não
  sai de `CONFIRMED`, `paid` depois de `EXPIRED` confirma.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit.

### Task E5: `customCreate` com trava, cupom, CPF e Opa Pingou

**Files:**
- Modify: `src/api/signup/controllers/signup.js`
- Create: `src/api/signup/services/reserve.js` (transação), `test/concurrency/signup-race.js`

**Interfaces:**
- Consumes: `price`, `couponWindow`, `normalizeCpf`, `createOpaPingou`.
- Produces: resposta de `POST /api/signup/:id` com `payment_provider`, `kind`, `pix_br_code`,
  `payment_link`, `expires_at`, `value`, `original_value`, `discount_kind`,
  `min_charge_applied`, `is_free`, `payment_id` — sem `cpf`.

Passos do fluxo (com `OPAPINGOU_ENABLED` e `event.payment_provider === 'opapingou'`; senão o
caminho PixAI de hoje, com o mesmo `price`):
1. `normalizeCpf(body.cpf)` — obrigatório em toda inscrição, inclusive gratuita e PixAI; ausente
   ou inválido → 400 "Informe um CPF válido." (sem ecoar o valor).
2. `strapi.db.transaction(async ({ trx }) => { … })`, travando nesta ordem para não haver
   deadlock: `events` → `batches` → `coupons`, cada uma com
   `strapi.db.connection('<tabela>').transacting(trx).where({ id }).forUpdate().first()`.
3. Expira pendentes vencidos do evento (`PEDING_PAYMENT`, `provider='opapingou'`,
   `expires_at < agora` → `EXPIRED`, `expired_at`).
4. Confere vagas do lote e do evento, janela e limite do cupom e "um cupom por CPF no evento"
   contando `CONFIRMED` + `PEDING_PAYMENT` no prazo.
5. Inscrição repetida: pendente válido → devolve o mesmo pagamento; `EXPIRED|CANCELED` → nova
   tentativa (`attempt + 1`) na mesma inscrição; `CONFIRMED` → "Você já está inscrito".
6. Grava o Payment `PEDING_PAYMENT` com `provider_idempotency_key =
   signup-payment-<id>-v<attempt>` (ou `CONFIRMED` se `finalCents === 0`) e o Signup com `cpf`;
   fim da transação.
7. Fora da transação: `createCharge`; sucesso → grava `provider_charge_id`, `provider_txid`,
   `pix_br_code`, `payment_link`, `expires_at`; falha definitiva → `CANCELED` (vaga e cupom
   voltam) e 400 com mensagem amigável; `PAYMENT_LINK_UNAVAILABLE` → 400 "Link indisponível,
   pague por Pix".

- [ ] **Step 1:** escrever `test/concurrency/signup-race.js`: sobe contra o MySQL do
  `docker-compose.yml`, cria evento com 1 vaga e cupom `max_uses=1`, dispara 10 `POST` simultâneos
  com o Opa Pingou simulado (`OPAPINGOU_API_URL` apontando para um servidor local de teste) e
  espera exatamente 1 aceito.
- [ ] **Step 2:** rodar → FAIL (hoje passam vários).
- [ ] **Step 3:** implementar o fluxo acima. Conferir se o `strapi.db.query` dentro do callback usa
  a transação (Strapi 4.25); se não usar, fazer as escritas com `.transacting(trx)` no knex.
- [ ] **Step 4:** rodar → exatamente 1 aceito. `yarn test` → PASS.
- [ ] **Step 5:** commit `feat(REA-6): paid signup through Opa Pingou with locked capacity and coupons`.

### Task E6: rotas de cupom, eventos do Opa Pingou e proteção das rotas abertas

**Files:**
- Create: `src/api/coupon/routes/01-coupon.js` (`POST /coupon/preview`),
  `src/api/coupon/content-types/coupon/lifecycles.js` (código único por evento; tipo/valor
  travados com uso), `src/api/opapingou-event/routes/01-opapingou-event.js`,
  `src/api/opapingou-event/services/process.js`
- Modify: `src/api/payment/routes/01-payments.js` (tira `auth: false` das três rotas),
  `src/datasources/pixai/index.js` (log sem `config`)
- Test: `test/coupon-lifecycles.test.js`, `test/opapingou-process.test.js`

**Rotas (todas com token de integração):**
- `POST /api/coupon/preview` `{ event_id, batch_id, code, is_student }` → resultado de `price` +
  mensagens.
- `POST /api/opapingou/events` `{ event_id, type, test_mode, charge_id, payload }` → insere;
  `event_id` repetido → `{ duplicate: true }`.
- `POST /api/opapingou/events/:eventId/process` → reconsulta (`charge.*`, `payment.confirmed` com
  id de cobrança), aplica a transição com `updateMany`, devolve `{ transitioned, status,
  payment: { id, value, signup: { id, name, email }, event: { id, uuid, slug } } }`;
  `payment.refunded|charged_back` → `ignored` com `alert`.
- `GET /api/opapingou/events/pending?olderThanSeconds=60` → ids para a varredura.

- [ ] **Step 1: testes:** código repetido no mesmo evento recusado e em outro evento aceito; troca
  de tipo/valor com uso recusada; processar duas vezes → `transitioned` só na primeira;
  `expired` depois de `paid` → continua `CONFIRMED`; cobrança desconhecida → `ignored`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** commit.

### Task E7: backfill do CPF das inscrições antigas

**Files:**
- Create: `scripts/backfill-signup-cpf.js`, `src/utils/cpf-backfill.js`
- Test: `test/cpf-backfill.test.js`

**Interfaces:** `planBackfill(signups, cpfByEmail) → { updates: [{ id, cpf }], skipped: {
noMatch, invalid, alreadySet } }` (puro; `cpfByEmail` vem da conta do Hub e do `sw-form`, pela
mesma regra do `withCpf` do BFF — a conta primeiro).

- [ ] **Step 1: testes:** só preenche `cpf` vazio; e-mail comparado sem caixa e sem espaços; CPF
  inválido é pulado; conta do Hub vence o `sw-form`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** o script roda por padrão em simulação (imprime só contagens, nunca CPF);
  `--apply` grava. Rodar `--apply` só com ok do Pedro. Commit.

### Task E8: secret e deploy

**Files:**
- Create: `scripts/opapingou-secrets.sh` (cópia revisada do script que o Pedro roda; entrada
  oculta, stdin para o `gh`), `.github/workflows/sync-secrets.yml` (`workflow_dispatch`: SSH ao
  servidor e grava `OPAPINGOU_API_KEY` no `.env` lendo do stdin, `umask 077`, sem `pm2 restart`
  automático)
- Modify: `.env.example` (nomes das variáveis, sem valores)

- [ ] **Step 1:** testar o script contra um servidor local e um `gh` falso (feito em 2026-10-10:
  nenhuma das duas credenciais apareceu na saída nem em argumentos de comando).
- [ ] **Step 2:** commit. Rodar o workflow só com ok do Pedro (é deploy).

---

## Repositório `reactivandoio/hub-community-bff`

Branch `REA-6-opapingou` empilhada sobre `fix/fase-1-auth` (PR #33), porque cupom e pagamentos do
admin precisam de `requireAdmin`. PR em rascunho. Testes: `yarn test` (Vitest).

### Task B1: assinatura

**Files:**
- Create: `src/services/opapingou/signature.js`
- Test: `src/services/opapingou/signature.test.js`

**Interfaces:** `verifyOpaSignature({ rawBody: Buffer, header: string, secret: string, nowS:
number, toleranceS = 300 }) → { ok: true } | { ok: false, reason: 'missing'|'malformed'|'stale'|'mismatch' }`

- [ ] **Step 1: testes**

```js
import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { verifyOpaSignature } from './signature';

const secret = 'whsec_test';
const body = Buffer.from('{"id":"e1", "type":"charge.paid","nome":"João"}');
const sign = (t, b = body) => crypto.createHmac('sha256', secret).update(`${t}.${b}`).digest('hex');

describe('verifyOpaSignature', () => {
  it('aceita assinatura válida', () => {
    expect(verifyOpaSignature({ rawBody: body, header: `t=1000,v1=${sign(1000)}`, secret, nowS: 1100 }).ok).toBe(true);
  });
  it('aceita quando um dos vários v1 confere', () => {
    expect(verifyOpaSignature({ rawBody: body, header: `t=1000,v1=${'0'.repeat(64)},v1=${sign(1000)}`, secret, nowS: 1000 }).ok).toBe(true);
  });
  it('recusa corpo adulterado', () => {
    expect(verifyOpaSignature({ rawBody: Buffer.from('{}'), header: `t=1000,v1=${sign(1000)}`, secret, nowS: 1000 }).reason).toBe('mismatch');
  });
  it('recusa timestamp fora de 300 s', () => {
    expect(verifyOpaSignature({ rawBody: body, header: `t=1000,v1=${sign(1000)}`, secret, nowS: 1301 }).reason).toBe('stale');
  });
  it('recusa header ausente ou malformado', () => {
    expect(verifyOpaSignature({ rawBody: body, header: undefined, secret, nowS: 1000 }).reason).toBe('missing');
    expect(verifyOpaSignature({ rawBody: body, header: 'v1=abc', secret, nowS: 1000 }).reason).toBe('malformed');
  });
});
```

- [ ] **Step 2:** `yarn test signature` → FAIL.
- [ ] **Step 3: implementação**

```js
import crypto from 'crypto';

export const verifyOpaSignature = ({ rawBody, header, secret, nowS, toleranceS = 300 }) => {
  if (!header) return { ok: false, reason: 'missing' };
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const v1s = parts.filter(([k, v]) => k === 'v1' && /^[0-9a-f]{64}$/.test(v || '')).map(([, v]) => v);
  if (!Number.isInteger(t) || v1s.length === 0) return { ok: false, reason: 'malformed' };
  if (Math.abs(nowS - t) > toleranceS) return { ok: false, reason: 'stale' };
  const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const match = v1s.some((v) => crypto.timingSafeEqual(Buffer.from(v, 'hex'), expected));
  return match ? { ok: true } : { ok: false, reason: 'mismatch' };
};
```

- [ ] **Step 4:** PASS. Commit.

### Task B2: handler do webhook e processamento

**Files:**
- Create: `src/services/opapingou/webhook.js`, `src/services/opapingou/process.js`,
  `src/dataSources/eventando-manager/opapingou/index.js`
- Test: `src/services/opapingou/webhook.test.js`, `src/services/opapingou/process.test.js`

**Interfaces:**
- `handleOpaWebhook({ rawBody, headers, env, nowS, store, schedule }) → { status, body }`:
  flag desligada → 404; assinatura inválida → 401; `ping`/tipo ignorado → 200; `testMode` em
  produção → 200 ignorado; `store.save(event)` ok ou `duplicate` → 200 e `schedule(eventId)`;
  falha ao gravar → 500.
- `processEvent(eventId, { eventando, sendConfirmation, alert })`: chama `process`; se
  `transitioned && status === 'CONFIRMED'` → `sendSignupConfirmation(..., { isPaid: true })`.

- [ ] **Step 1: testes:** 401 não grava; ping 200; duplicado 200 sem novo `schedule`; fora de ordem
  (paid processado, depois expired) → um e-mail só; erro do Eventando → 500; `testMode` em
  produção ignorado; refund → `alert` sem processar.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit.

### Task B3: rota Express, varredura e e-mail

**Files:**
- Modify: `src/index.js` (`app.post('/webhooks/opapingou', express.raw({ type: '*/*', limit:
  '1mb' }), …)` antes do `app.use('/', …, bodyParser.json(), expressMiddleware…)`; `setInterval`
  de 60 s que pede `pending` e chama `processEvent`), `src/services/email/signup-confirmation.js`
  (`isPaid` → ingresso), `src/resolvers/Event/index.js` (`signupToEvent` não manda e-mail na hora
  para pago no Opa Pingou)
- Test: `src/__tests__/opapingou-route.test.js` (sobe o app Express em porta efêmera e manda o
  corpo com espaços e acentos)

- [ ] **Step 1–4:** teste da rota com corpo cru → FAIL → implementar → PASS. Commit.

### Task B4: GraphQL de pagamento e cupom

**Files:**
- Modify: `src/types/Event.graphql`, `src/types/Coupon.graphql`, `src/resolvers/Event/index.js`,
  `src/resolvers/Coupon/index.js`, `src/dataSources/eventando-manager/coupons/index.js`
- Test: `src/resolvers/Coupon/index.test.js`, `src/resolvers/Event/payments.test.js`

**Schema:**

```graphql
type SignupPaymentStatus { signup_id: ID! status: String! provider: String kind: String
  expires_at: String confirmed_at: String pix_br_code: String payment_link: String value: Float
  refund_support: RefundSupport }
type RefundSupport { text: String whatsapp: String }
type EventPaymentSettings { payment_provider: String }
type EventPayment { email: String! name: String status: String! value: Float expires_at: String }
type CouponPreview { valid: Boolean! message: String discount_kind: String final_value: Float
  original_value: Float min_charge_applied: Boolean }
extend type Query {
  signupPaymentStatus(signupId: ID!): SignupPaymentStatus
  eventPaymentSettings(eventId: ID!): EventPaymentSettings   # requireAdmin
  eventPayments(slugOrId: String!): [EventPayment!]!          # requireAdmin
  eventCoupons(eventId: ID!): [Coupon!]!                      # requireAdmin, com uses
  previewCoupon(eventSlug: String!, batchId: ID!, code: String!, isStudent: Boolean): CouponPreview
}
# Coupon ganha discount_type, discount_value_cents, starts_at, batches, uses
# SignupInput ganha cpf: String e kind: String (PIX_QR | PAYMENT_LINK)
```

- `validateCoupon` passa a delegar a `previewCoupon` (mantido por compatibilidade).
- `eventSignups` e `isUserSignedUp`: inscrição paga só conta com `CONFIRMED`.
- `signupToEvent` repassa `cpf`; `manualSignup` (REA-4) grava no `Signup.cpf` o CPF que já coleta.
- Nenhum resolver devolve CPF.

- [ ] **Step 1–4:** testes dos resolvers (admin exigido, preview vindo do Eventando, pendente não é
  inscrito) → FAIL → implementar → PASS. Commit.

### Task B5: segredo no deploy

**Files:**
- Modify: `.github/workflows/deploy-prod.yml` (passo que grava `OPAPINGOU_WEBHOOK_SECRET` no
  `.env` do servidor pelo stdin do `ssh`, antes do `make update`), `.env.example`

- [ ] Commit. Rodar só com ok do Pedro.

---

## Repositório `reactivandoio/hub-community-frontend` (PR #59)

Testes: `pnpm test`, `pnpm build`.

### Task F1: Pix ou link

**Files:** `src/components/signup-pix-payment.tsx`, `src/app/events/[id]/signup/page.tsx`,
`src/lib/queries.ts`, testes em `src/components/__tests__/`

- Escolha "Pix" ou "Link de pagamento (cartão)"; o link abre em nova aba e o passo segue
  consultando o status a cada 4 s; prazo de 15 min; sem `paymentLink` → opção some.
- Texto de reembolso vindo de `refund_support` (sem número configurado, não mostra).
- [ ] Testes → implementar → PASS. Commit.

### Task F2: cupom e CPF na inscrição

**Files:** `src/app/events/[id]/signup/page.tsx`, `src/lib/cpf.ts` (máscara só de exibição),
`src/lib/queries.ts`, testes

- Preço final, desconto aplicado ("meia-entrada" ou "cupom") e aviso de mínimo vêm de
  `previewCoupon`; o navegador não calcula.
- Campo CPF obrigatório em toda inscrição (gratuita ou paga), com máscara; a validação de verdade
  é a do servidor; erro do servidor aparece no campo.
- [ ] Testes → implementar → PASS. Commit.

### Task F3: aba Cupons no admin

**Files:** `src/app/admin/events/[id]/page.tsx`, `src/components/admin/coupons-tab.tsx`,
`src/components/admin/coupon-form-dialog.tsx`, testes

- Lista: código, tipo, valor, validade, usos/limite, lotes, ativo. Criar/editar: fixo digitado em
  reais e gravado em centavos (`src/lib/money.ts`); tipo e valor desabilitados com uso.
- [ ] Testes → implementar → PASS. Commit.

---

## Roteiro manual (só com ok do Pedro)

1. Flag ligada só no ambiente do teste; evento com lote de R$ 1,00.
2. Inscrição com Pix → pagar → webhook `charge.paid` → status `CONFIRMED` → e-mail com ingresso.
3. Inscrição sem pagar → após 15 min `charge.expired` → vaga liberada.
4. Reenviar um evento (`/v1/webhook-deliveries/{id}/redeliver`) → nada muda, nenhum e-mail novo.
5. Link de pagamento, se houver conta Mercado Pago conectada.

## Ordem

E1 → E2 → E3 → E4 → E5 → E6 → E7 → B1 → B2 → B3 → B4 → F1 → F2 → F3 → E8/B5 (deploy, com ok).

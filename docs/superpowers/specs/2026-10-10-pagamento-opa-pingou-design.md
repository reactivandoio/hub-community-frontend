# REA-6 — Inscrição paga com o Opa Pingou (Pix): desenho

Data: 2026-10-10. Status: frontend implementado neste PR; Eventando Manager e BFF especificados
abaixo e ainda por implementar (esta aba só escreve no hub-community-frontend).

> Correção do primeiro levantamento: a conclusão "o Opa Pingou não tem API de comerciante" veio
> de um checkout local parado em `973e2d2`. A `origin/main` (tag de produção `v1.1.0`, a0a1e60)
> já tem API REST com chave, idempotência e webhooks assinados. Lição registrada no termhub.

## 1. Contrato real do Opa Pingou (origin/main = v1.1.0)

Fonte: `opapingou/monorepo` em `origin/main` — `apps/api/src/rest/v1/*`,
`apps/api/src/outbound-webhooks/*`, `packages/core/src/api/*`, docs em
`apps/web/src/content/api-docs*.ts` (página `/docs`). O mesmo contrato que o docverse usa
(o repositório do docverse fica no jarvis e não está acessível desta máquina).

- **Base:** `https://api.opapingou.com.br` (marcada "provisória" na doc), rotas em `/v1`.
- **Chave:** `Authorization: Bearer opk_live_…` | `opk_test_…` (criada em `/app/chaves` ou no app,
  mostrada uma vez). Escopos usados: `charges:write`, `charges:read` (+ `webhooks:write` se o
  endpoint for registrado pela API). Chave `opk_test_` só enxerga contas `testMode` (sandbox do
  provedor) e só recebe webhooks delas — é o ambiente de teste.
- **Criar cobrança:** `POST /v1/charges`, header `Idempotency-Key` obrigatório (24 h por chave;
  mesmo corpo → mesma cobrança com `Idempotent-Replayed: true`; corpo diferente → 409).
  Corpo estrito: `{ amountCents, validity: FIFTEEN_MIN|ONE_HOUR|ONE_DAY|SEVEN_DAYS,
  description? (≤140), kind?: PIX_QR|PAYMENT_LINK, bankAccountId? }`.
  Resposta 201 `ChargeResource { id, status: PENDING|PAID|EXPIRED|CANCELED, amountCents,
  brCode (Pix copia-e-cola), paymentLink, expiresAt, paidAt, bankAccount{…testMode}, … }`.
  Não há referência externa/metadata nem dados do pagador: o vínculo é o `id` da cobrança, que
  o Hub guarda.
- **Consultar:** `GET /v1/charges/{id}` → mesmo `ChargeResource`.
- **Webhook de saída:** registrado por empresa (`POST /v1/webhook-endpoints` ou tela
  `/app/webhooks`), só https público. Eventos usados: `charge.paid`, `charge.expired`,
  `charge.canceled` (+ `ping`). Corpo `{ id, type, occurredAt, testMode, data: { type: 'charge',
  object: ChargeResource } }`. Headers `Opa-Event-Id` (= `id`), `Opa-Event-Type`,
  `Opa-Signature: t=<unix s>,v1=<hex HMAC-SHA256(secret, "<t>.<corpo cru>")>` (pode trazer
  vários `v1`), tolerância 300 s, segredo `whsec_…` mostrado uma vez. Sucesso = 2xx em 10 s;
  8 tentativas em ~45 h; reenvio manual em `/v1/webhook-deliveries/{id}/redeliver`.
- **Não existe por REST:** cancelar, estornar, simular pagamento. Simulação só pela mutation
  GraphQL `simulateChargePayment` (JWT de usuário) ou pelo sandbox do provedor.
- **Conta que recebe:** roteamento automático entre as contas da empresa no escopo da chave;
  `bankAccountId` fixa a conta. Recomendação: chave restrita a uma conta.

## 2. Onde a inscrição paga vive hoje

Eventando Manager (Strapi 4, `reactivando/eventando-manager`): Event → Product → Batch
(`value` em centavos) e Signup 1:1 Payment (`status` `PEDING_PAYMENT|CANCELED|CONFIRMED|REFUND`).
`POST /api/signup/:eventId` (`signup.customCreate`) valida lote/estoque/vagas/cupom, cria a
cobrança no PixAI e o Payment pendente. O BFF chama isso em `signupToEvent`.

## 3. Desenho

```
Participante → Front (/events/[id]/signup) → BFF signupToEvent → Eventando customCreate
                                                         └─ POST /v1/charges (opk_… só no Eventando)
Opa Pingou ──webhook──▶ BFF POST /webhooks/opapingou (verifica Opa-Signature, corpo cru)
                         └─▶ Eventando POST /api/payment/opapingou/sync {charge_id}
                               └─ GET /v1/charges/{id} (fonte da verdade) → transição atômica
                         └─ se transicionou para CONFIRMED: e-mail "Inscrição confirmada" com ingresso
Front (passo Pix) ── polling 4 s ──▶ BFF signupPaymentStatus(signupId)
```

Por que o webhook entra pelo BFF e a cobrança nasce no Eventando: o Eventando tem o modelo e
a contagem de vagas; o BFF tem Express (rotas REST já existem, ex. `/upload`) e o e-mail de
confirmação do Hub (`sendSignupConfirmation`, com QR do ingresso). O Eventando reconsulta a
cobrança antes de confirmar, então nem um webhook forjado que passasse a assinatura confirmaria
algo que o Opa Pingou não marcou como `PAID`.

### 3.1 Eventando Manager

Schema:
- `Event.payment_provider`: enum `pixai|opapingou`, default `pixai` (eventos atuais não mudam).
- `Payment`: `status` ganha `EXPIRED`; novos `provider` (string), `provider_charge_id` (string),
  `pix_br_code` (text), `expires_at` (datetime), `expired_at` (datetime).

`src/datasources/opapingou/index.js` (axios, env abaixo): `createCharge({ amountCents,
description, idempotencyKey })` → `POST /v1/charges` com `validity = OPAPINGOU_CHARGE_VALIDITY`
(default `ONE_HOUR`), `kind: 'PIX_QR'`, `bankAccountId = OPAPINGOU_BANK_ACCOUNT_ID` se houver;
`getCharge(id)`. Erros `problem+json` viram mensagem amigável.

`signup.customCreate`, quando `event.payment_provider === 'opapingou'` e valor > 0:
1. Antes de contar estoque/vagas: marca como `EXPIRED` (+`expired_at`) os `PEDING_PAYMENT` com
   `provider='opapingou'` e `expires_at < agora` — a vaga volta (a contagem já usa só
   `CONFIRMED|PEDING_PAYMENT`).
2. Inscrição duplicada: se a inscrição existente tem pagamento `PEDING_PAYMENT` ainda válido,
   devolve o mesmo pagamento (a pessoa reabre o Pix); se `EXPIRED|CANCELED`, cria um novo
   pagamento e religa a mesma inscrição; se `CONFIRMED`, mantém "Você já está inscrito".
3. `payment_identification = randomUUID()`; `createCharge` com `Idempotency-Key =
   payment_identification`; `description = "Inscrição <evento> - <nome>"` (cortada em 140).
4. Payment `{ provider:'opapingou', provider_charge_id, pix_br_code: brCode, payment_link,
   expires_at, status:'PEDING_PAYMENT' }`.
5. Resposta acrescenta `payment_provider`, `pix_br_code`, `expires_at`, `value` (centavos).

`POST /api/payment/opapingou/sync` (auth padrão = token de integração do BFF), corpo
`{ charge_id }`: grava o recebido em `PaymentIntegration`, acha o Payment por
`provider_charge_id` (404 se não for nosso), faz `getCharge`, mapeia
`PAID→CONFIRMED`, `EXPIRED→EXPIRED`, `CANCELED→CANCELED`, `PENDING→(nada)` e aplica com
`updateMany({ where: { id, status: { $in: origens } } })`:
- `CONFIRMED` a partir de `PEDING_PAYMENT|EXPIRED|CANCELED` (Pix pago depois de expirar é
  honrado: o dinheiro entrou; pode passar 1 da lotação — o admin vê no card de pagamentos);
- `EXPIRED|CANCELED` só a partir de `PEDING_PAYMENT`.
Responde `{ transitioned: count === 1, status, payment: { id, value, signup: { id, name, email,
phone_number }, event: { id, uuid, slug } } }`. A idempotência vem daí: webhook repetido ou
reenviado encontra o status já aplicado e devolve `transitioned: false`.

Testes: módulos puros (mapeamento de status, regras de transição, montagem do corpo da
cobrança) com `node --test` (o repositório não tem runner; sem dependência nova).

### 3.2 BFF

- `src/services/opapingou/signature.js`: `verifyOpaSignature(rawBody, header, secret, nowS)` —
  parse `t=…,v1=…` (vários `v1`), |agora − t| ≤ 300, `timingSafeEqual` do hex.
- `src/services/opapingou/webhook.js` `handleOpaWebhook({ rawBody, headers, secret,
  dataSources, sendConfirmation })` → `{ status, body }`:
  assinatura inválida/ausente → 401 (nada é tocado); `ping` ou tipo fora de
  `charge.paid|charge.expired|charge.canceled` → 200 ignorado; senão `sync(charge_id)`;
  404 do Eventando (cobrança que não é de inscrição) → 200 ignorado; erro do Eventando → 500
  (o Opa Pingou reenvia); `transitioned && status === 'CONFIRMED'` → `sendSignupConfirmation`
  com ingresso (novo parâmetro `isPaid`: `hasTicket = !online && (isFree || isPaid)`).
- `src/index.js`: `app.post('/webhooks/opapingou', express.raw({ type: '*/*', limit: '1mb' }),
  …)` registrado **antes** do `bodyParser.json()` do Apollo.
- `signupToEvent`: se `payment.payment_provider === 'opapingou'` e não é grátis, **não** manda o
  e-mail de confirmação na hora (vai no webhook). PixAI segue como hoje.
- GraphQL (o frontend deste PR já usa):
  ```graphql
  type SignupPaymentStatus { signup_id: ID! status: String! provider: String expires_at: String
    confirmed_at: String pix_br_code: String payment_link: String value: Float }
  type EventPaymentSettings { payment_provider: String }
  type EventPayment { email: String! name: String status: String! value: Float expires_at: String }
  extend type Query {
    signupPaymentStatus(signupId: ID!): SignupPaymentStatus      # público (só status/Pix)
    eventPaymentSettings(eventId: ID!): EventPaymentSettings      # admin
    eventPayments(slugOrId: String!): [EventPayment!]!            # admin
  }
  # EventSaleInput ganha: payment_provider: String  (updateEventSale grava no Event do Eventando)
  ```
- `eventSignups` (check-in, crachá, sorteio) e `isUserSignedUp`: inscrição paga só conta com
  pagamento `CONFIRMED` — pendente/expirado não é inscrito.
- Testes Vitest: assinatura (válida, adulterada, fora da janela, vários v1), handler (401,
  ping, repetido sem e-mail duplicado, 404 ignorado, 500 propaga), resolvers novos.

### 3.3 Frontend (este PR)

- **Preço em reais no admin, centavos no armazenamento** (`src/lib/money.ts`): corrige o bug em
  que o admin digitava 50 (reais) e o lote era gravado/cobrado como R$ 0,50.
- Seletor "Pagamento dos lotes pagos" (Opa Pingou / Pix Aí) na aba Produtos & Lotes; carregado
  por `eventPaymentSettings` e salvo via `updateEventSale` — fora de `updateEvent` e da query
  pública, para o site não quebrar se o frontend subir antes do BFF.
- Passo de pagamento do Opa Pingou (`SignupPixPayment`): QR gerado do `brCode`, copia-e-cola,
  valor, prazo, polling de 4 s; pago → tela de inscrição confirmada (com ingresso); expirado ou
  cancelado → "a vaga foi liberada" + "Tentar novamente". O passo do PixAI não mudou.
- A decisão grátis/pago usa o `is_free` do servidor (cupom/meia podem zerar o valor).
- Analytics do evento: card "Pagamentos" (pagos, pendentes, expirados, cancelados, total
  recebido) via `eventPayments`; não aparece em evento gratuito nem se a query falhar.

### 3.4 Cupom de desconto (regras do Pedro, 2026-10-10)

Reaproveita o `api::coupon` do Eventando, o `validateCoupon` e o CRUD do BFF e o campo de cupom
da inscrição no frontend. As regras abaixo são do Pedro; as marcadas "proposta" ainda esperam ok.

**Regras**
- Um cupom vale para **um único evento**. O código é **único por evento**, não no sistema todo
  (hoje é `unique` global; a unicidade passa a ser `(event, code)`, conferida no servidor dentro
  da mesma transação, porque o Strapi 4 não declara índice composto no schema).
- Tipo **percentual** (1–100) ou **valor fixo** (centavos). Tipo e valor **travam depois do
  primeiro uso** (o admin ainda pode desativar, mudar datas e limite).
- **Validade:** `starts_at` e `expires_at`; vazio = vale pelo período do lote (`valid_from` /
  `valid_until`).
- **Limite total** `max_uses` (vazio = ilimitado) e **um cupom por evento por CPF**.
- **Meia-entrada não soma com cupom:** aplica o **maior** dos dois descontos, nunca os dois. Empate:
  proposta = aplica a meia e não consome o cupom. A pessoa vê qual desconto foi aplicado e por quê.
- **Arredondamento:** o **valor final** arredonda para baixo (centavo inteiro):
  `final = floor(base × (100 − pct) / 100)`; fixo: `final = max(0, base − fixo)`.
- **Valor final zero:** inscrição sem cobrança, `CONFIRMED` na hora, e-mail com ingresso, uso conta.
- **Valor final abaixo do mínimo de cobrança** (e maior que zero): sobe para o mínimo, com aviso
  na tela ("valor mínimo de cobrança: R$ x"). Mínimo configurável por provedor
  (`OPAPINGOU_MIN_CHARGE_CENTS`, `PIXAI_MIN_CHARGE_CENTS`). Opa Pingou: o código (`packages/core`,
  `MIN_CHARGE_CENTS = 1`, máximo R$ 25.000,00) aceita 1 centavo, a conferir no staging. Pix Aí:
  valor não encontrado — pendente do Pedro.
- **Pix pago depois de vencer** com o cupom já esgotado: honra (pode passar 1 do limite).
- Só **admin** cria, edita e apaga cupons (`requireAdmin` do PR #33 do BFF; o PR de cupom do BFF
  vai empilhado nele ou depois do merge).

**Onde se calcula:** só no Eventando, em `src/utils/pricing.js` (puro, inteiros):
`{ originalCents, discountKind: 'coupon'|'student'|null, discountCents, minApplied, finalCents }`.
`customCreate` e a rota nova `POST /api/coupon/preview` usam o mesmo módulo; o `validateCoupon` do
BFF chama o preview; o navegador só exibe. `amountCents` enviado ao Opa Pingou = `finalCents`.

**CPF:** a inscrição do Eventando não tem CPF (ele fica na conta do Hub, por e-mail). Proposta:
quando houver cupom, o CPF passa a ser obrigatório no formulário, com dígito verificador, e o
Payment guarda só `coupon_cpf_hash` = HMAC-SHA256(CPF, segredo em env) — basta para a regra
"um por CPF" sem guardar o CPF em claro no Eventando.

**Sem corrida e sem consumo por Pix vencido:** dentro de `strapi.db.transaction`, `SELECT … FOR
UPDATE` nas linhas do cupom, do lote e do evento; expira os pendentes vencidos; conta só
`CONFIRMED` e `PEDING_PAYMENT` dentro do prazo (limite total e CPF); grava o Payment pendente com a
`Idempotency-Key`; solta a trava; só então chama o Opa Pingou. Falha definitiva → `CANCELED`, o
uso e a vaga voltam. A mesma trava cobre a contagem de vagas do lote e do evento.

**Modelo:** Coupon ganha `discount_type`, `discount_value_cents`, `starts_at`, `batches`
(manyToMany, vazio = todos); `code` deixa de ser único global. Payment ganha `discount_kind`,
`discount_cents`, `min_charge_applied`, `coupon_cpf_hash`.

**Frontend:** aba "Cupons" no admin do evento (lista com usos/limite; criar e editar com valor fixo
em reais → centavos; tipo e valor bloqueados após o primeiro uso); na inscrição, CPF quando houver
cupom, preço final, desconto aplicado e aviso de mínimo vindos do servidor.

## 4. Estados e a vaga

| Estado | Participante vê | Vaga | Admin vê |
|---|---|---|---|
| `PEDING_PAYMENT` | Pix + prazo | reservada até `expires_at` | Pagamento pendente |
| `CONFIRMED` | Inscrição confirmada + e-mail com ingresso | ocupada | Pago |
| `EXPIRED` | "O prazo do Pix acabou" + tentar de novo | liberada | Expirado |
| `CANCELED` | "Pagamento cancelado" + tentar de novo | liberada | Cancelado |
| `REFUND` | — | liberada | Reembolsado |

**Reembolso:** o Opa Pingou não tem estorno por API (só registra `payment.refunded` quando o
provedor avisa). Proposta: reembolso manual pelo banco/provedor e o admin marca o Payment como
`REFUND` no Eventando; quando o Opa Pingou expuser estorno, ouvir `payment.refunded`. Pendência.

## 5. Configuração para produção

Eventando Manager (servidor):
- `OPAPINGOU_API_URL=https://api.opapingou.com.br`
- `OPAPINGOU_API_KEY=opk_live_…` (escopos `charges:write`, `charges:read`; de preferência
  restrita à conta que recebe)
- `OPAPINGOU_CHARGE_VALIDITY=ONE_HOUR` (decisão pendente, ver §6)
- `OPAPINGOU_BANK_ACCOUNT_ID=` (opcional)

BFF:
- `OPAPINGOU_WEBHOOK_SECRET=whsec_…`

No Opa Pingou (tela `/app/webhooks` da empresa que recebe): endpoint
`https://bff.hubcommunity.io/webhooks/opapingou` com eventos `charge.paid`, `charge.expired`,
`charge.canceled`.

Teste: mesmas variáveis com `opk_test_…`, conta `testMode` e um endpoint de webhook criado com a
chave de teste (aponta para staging/túnel do BFF).

Ordem de deploy: Eventando (schema) → BFF → frontend. O frontend novo chama
`signupPaymentStatus`, `eventPaymentSettings` e `eventPayments`; só o passo Pix do Opa Pingou
depende deles, e ele só aparece depois que o Eventando devolver `payment_provider: 'opapingou'`.

## 6. Pendências / decisões do Pedro

1. Credenciais de teste: chave `opk_test_…` de uma conta `testMode` e o `whsec_…` do endpoint
   de teste (sem isso não dá para a evidência ponta a ponta exigida pelo card).
2. Conta que recebe (qual conta conectada; chave restrita a ela?).
3. Validade da cobrança/reserva da vaga: proposto `ONE_HOUR`.
4. Só Pix (`PIX_QR`) ou também link Mercado Pago (`PAYMENT_LINK`, cartão)? Proposto: só Pix.
5. Reembolso manual (acima) aceito?
6. Cupom (§3.4): valor mínimo de cobrança do Pix Aí; CPF obrigatório com cupom e guardado só como
   hash; empate meia × cupom; "um cupom por evento por CPF" = qualquer cupom do evento.

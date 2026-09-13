# Certificados de Participação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir certificados de participação em PDF por evento, com modelo configurável (patrocinadores, assinaturas, texto), auto-atendimento público, emissão em lote pelo admin (registrar / e-mail / ZIP) e verificação por código.

**Architecture:** Strapi guarda `certificate-config` (1 por evento) e `certificate` (registro emitido, código único, idempotente por CPF). O BFF expõe queries/mutations GraphQL e faz o merge de inscritos (Eventando) + presenças + pedidos legados. O Next.js renderiza o PDF com `@react-pdf/renderer` usando **um único componente** tanto no browser (preview/download) quanto em route handlers (link do e-mail, ZIP).

**Tech Stack:** Strapi 5.23.5 (TS, Yarn), Express + Apollo Server 4 (JS/babel, Yarn), Next.js 16 + React 19 (pnpm), `@react-pdf/renderer`, `jszip`, `qrcode`, Vitest nos três repos.

**Spec:** `docs/superpowers/specs/2026-09-11-certificados-design.md` (neste repo). Leia a spec antes de qualquer tarefa — o plano argumenta a partir dela.

## Global Constraints

- Três repositórios irmãos em `/Users/pedrogoiania/projects/reactivando/`: `hub-community-backend`, `hub-community-bff`, `hub-community-frontend`. Cada um é um git repo próprio. Trabalhe em branch `feat/certificados` em cada um (crie a partir de `main` se não existir).
- Package managers são estritos: backend **Yarn**, BFF **Yarn**, frontend **pnpm**. Nunca use `npm install`.
- Toda cópia visível ao usuário em **pt-BR**. Mensagens de erro do BFF em pt-BR.
- `code` do certificado: `RCT-` + 8 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem 0/O/1/I).
- `identifier` é sempre CPF **só dígitos** (11 caracteres). É a chave de idempotência `(event, identifier)`.
- Todo acesso ao Strapi passa pelo BFF com `MANAGER_TOKEN_INTEGRATION`. Nenhuma permissão nova no bootstrap do Strapi. O frontend nunca chama `manager.hubcommunity.io` direto para certificados.
- Rotas GraphQL marcadas como admin exigem `context.user` (mesmo critério das rotas admin existentes — não há RBAC).
- PDF: A4 paisagem, fonte Helvetica built-in (sem `Font.register`).
- `@react-pdf/renderer` só é importado via `next/dynamic` (browser) ou em route handlers (Node). Nunca em `layout.tsx` ou componentes compartilhados.
- Commits: conventional commits (`feat:`, `test:`, `docs:`), um por tarefa ou por passo lógico. Nunca commitar `.env`.
- Ao terminar cada tarefa, rode a suíte de testes do repo em que mexeu (`yarn vitest run` no backend, `yarn test` no BFF, `pnpm test` no frontend) — tudo deve passar.

---

## Mapa de arquivos

```
hub-community-backend/
  src/components/certificate/sponsor.json                         Task 1
  src/components/certificate/signature.json                       Task 1
  src/api/certificate-config/content-types/certificate-config/schema.json   Task 1
  src/api/certificate-config/{controllers,routes,services}/certificate-config.ts  Task 1
  src/api/event/content-types/event/schema.json                   Task 1, 2 (relações inversas)
  src/api/certificate/content-types/certificate/schema.json       Task 2
  src/api/certificate/services/certificate-helpers.ts             Task 2 (lógica pura)
  src/api/certificate/services/certificate-helpers.test.ts        Task 2
  src/api/certificate/services/certificate.ts                     Task 2 (service fino)
  src/api/certificate/{controllers,routes}/certificate.ts         Task 2
  CLAUDE.md                                                       Task 3

hub-community-bff/
  package.json (+vitest), vitest.config.js                        Task 4
  src/dataSources/manager-integration/certificates/index.js       Task 4
  src/dataSources/manager-integration/index.js                    Task 4 (registro)
  src/resolvers/Certificate/mappers.js (+ .test.js)               Task 5
  src/resolvers/Certificate/eligibility.js (+ .test.js)           Task 5
  src/types/Certificate.graphql                                   Task 6, 14
  src/resolvers/Certificate/index.js                              Task 6, 14
  src/resolvers/Certificate/candidates.js (+ .test.js)            Task 13
  src/resolvers/Certificate/email.js                              Task 14
  src/services/email/templates/certificate-issued.js              Task 14
  GRAPHQL_USAGE.md                                                Task 14

hub-community-frontend/
  package.json (+ @react-pdf/renderer, jszip, qrcode)             Task 7
  src/lib/certificate.ts (+ __tests__/certificate.test.ts)        Task 7
  src/lib/types.ts, src/lib/queries.ts                            Task 8, 15
  src/lib/certificate-qr.ts                                       Task 9
  src/components/certificate/certificate-document.tsx (+ test)    Task 9
  src/lib/certificate-server.ts                                   Task 10
  src/app/api/certificates/[code]/pdf/route.ts                    Task 10
  src/components/certificate/certificate-preview.tsx              Task 11
  src/components/certificate/certificate-card.tsx                 Task 11
  src/app/certificado/[code]/page.tsx                             Task 11
  src/app/certificado/verificar/[code]/page.tsx                   Task 11
  src/app/certificado/page.tsx                                    Task 11 (reescrita)
  src/components/admin/certificate-config-form.tsx                Task 12
  src/app/admin/events/[id]/certificados/page.tsx                 Task 12 (reescrita), 16
  src/app/api/certificates/zip/route.ts                           Task 15
  src/components/admin/certificate-issue-table.tsx                Task 16
```

Ordem: Tasks 1–3 (backend) → 4–6 (BFF, auto-atendimento) → 7–12 (frontend, auto-atendimento + aba Modelo) → 13–14 (BFF, emissão) → 15–16 (frontend, emissão).

---

# FASE 1 — Backend (`hub-community-backend`)

### Task 1: Components + content type `certificate-config`

**Files:**
- Create: `src/components/certificate/sponsor.json`
- Create: `src/components/certificate/signature.json`
- Create: `src/api/certificate-config/content-types/certificate-config/schema.json`
- Create: `src/api/certificate-config/controllers/certificate-config.ts`
- Create: `src/api/certificate-config/routes/certificate-config.ts`
- Create: `src/api/certificate-config/services/certificate-config.ts`
- Modify: `src/api/event/content-types/event/schema.json` (adicionar `certificate_config`)

**Interfaces:**
- Produces: UID `api::certificate-config.certificate-config`, REST `/api/certificate-configs` (factory). Components `certificate.sponsor` e `certificate.signature`.

- [ ] **Step 1: Criar branch**

```bash
cd /Users/pedrogoiania/projects/reactivando/hub-community-backend
git checkout main && git pull && git checkout -b feat/certificados
```

- [ ] **Step 2: Criar os components**

`src/components/certificate/sponsor.json`:
```json
{
  "collectionName": "components_certificate_sponsors",
  "info": {
    "displayName": "Sponsor",
    "description": "Patrocinador exibido no rodapé do certificado"
  },
  "options": {},
  "attributes": {
    "name": { "type": "string", "required": true },
    "logo": {
      "type": "media",
      "multiple": false,
      "required": true,
      "allowedTypes": ["images"]
    },
    "url": { "type": "string" }
  }
}
```

`src/components/certificate/signature.json`:
```json
{
  "collectionName": "components_certificate_signatures",
  "info": {
    "displayName": "Signature",
    "description": "Assinatura (nome, cargo e imagem opcional) no certificado"
  },
  "options": {},
  "attributes": {
    "name": { "type": "string", "required": true },
    "role": { "type": "string" },
    "image": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    }
  }
}
```

- [ ] **Step 3: Criar o schema de `certificate-config`**

`src/api/certificate-config/content-types/certificate-config/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "certificate_configs",
  "info": {
    "singularName": "certificate-config",
    "pluralName": "certificate-configs",
    "displayName": "Certificate Config",
    "description": "Modelo do certificado de participação de um evento"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "event": {
      "type": "relation",
      "relation": "oneToOne",
      "target": "api::event.event",
      "inversedBy": "certificate_config"
    },
    "enabled": { "type": "boolean", "default": false },
    "allow_self_request": { "type": "boolean", "default": true },
    "title": { "type": "string", "default": "Certificado de Participação" },
    "body_template": { "type": "text" },
    "workload_hours": { "type": "decimal" },
    "issuer_name": { "type": "string" },
    "primary_color": { "type": "string", "regex": "^#[0-9a-fA-F]{6}$" },
    "logo": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
    "background": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
    "sponsors": {
      "type": "component",
      "repeatable": true,
      "component": "certificate.sponsor"
    },
    "signatures": {
      "type": "component",
      "repeatable": true,
      "component": "certificate.signature",
      "max": 4
    }
  }
}
```

- [ ] **Step 4: Controller, router e service (factory)**

`src/api/certificate-config/controllers/certificate-config.ts`:
```ts
/**
 * certificate-config controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::certificate-config.certificate-config');
```

`src/api/certificate-config/routes/certificate-config.ts`:
```ts
/**
 * certificate-config router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::certificate-config.certificate-config');
```

`src/api/certificate-config/services/certificate-config.ts`:
```ts
/**
 * certificate-config service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::certificate-config.certificate-config');
```

- [ ] **Step 5: Relação inversa no Event**

Em `src/api/event/content-types/event/schema.json`, dentro de `"attributes"`, depois de `"attendances"`, adicione:
```json
    "certificate_config": {
      "type": "relation",
      "relation": "oneToOne",
      "target": "api::certificate-config.certificate-config",
      "mappedBy": "event"
    }
```
(Lembre da vírgula após o bloco `attendances`.)

- [ ] **Step 6: Gerar tipos e verificar compilação**

```bash
yarn strapi ts:generate-types
grep -n "ApiCertificateConfigCertificateConfig" types/generated/contentTypes.d.ts | head -2
grep -n "CertificateSponsor\|CertificateSignature" types/generated/components.d.ts | head -2
npx tsc --noEmit -p tsconfig.json
```
Esperado: os três `grep` acham linhas; `tsc` sem erros.

- [ ] **Step 7: Subir o Strapi e conferir o content type**

```bash
yarn develop
```
Abra `http://localhost:1337/admin` → Content-Type Builder → deve listar "Certificate Config" com os campos acima e os dois components em "certificate". Pare o servidor (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add src/components/certificate src/api/certificate-config src/api/event/content-types/event/schema.json types/generated
git commit -m "feat: add certificate-config content type with sponsor and signature components"
```

---

### Task 2: Content type `certificate` + service com código único e idempotência

**Files:**
- Create: `src/api/certificate/content-types/certificate/schema.json`
- Create: `src/api/certificate/services/certificate-helpers.ts`
- Create: `src/api/certificate/services/certificate-helpers.test.ts`
- Create: `src/api/certificate/services/certificate.ts`
- Create: `src/api/certificate/controllers/certificate.ts`
- Create: `src/api/certificate/routes/certificate.ts`
- Modify: `src/api/event/content-types/event/schema.json` (adicionar `certificates`)

**Interfaces:**
- Produces (helpers, exportados):
  - `CODE_ALPHABET: string`, `CODE_PREFIX = 'RCT-'`, `MAX_CODE_ATTEMPTS = 5`
  - `normalizeIdentifier(value: string): string` — só dígitos
  - `generateCode(random: () => number = Math.random): string` — `RCT-XXXXXXXX`
  - `findActiveCertificate(strapi, eventDocumentId: string, identifier: string): Promise<any | null>`
  - `allocateUniqueCode(strapi, random?: () => number): Promise<string>` — lança `Error('Não foi possível gerar um código único para o certificado')` após 5 colisões
- Produces (REST factory): `/api/certificates` com `create` idempotente e `delete` = soft delete (`revoked_at`).

- [ ] **Step 1: Schema do `certificate`**

`src/api/certificate/content-types/certificate/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "certificates",
  "info": {
    "singularName": "certificate",
    "pluralName": "certificates",
    "displayName": "Certificate",
    "description": "Certificado de participação emitido para uma pessoa em um evento"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "code": { "type": "string", "required": true, "unique": true },
    "event": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::event.event",
      "inversedBy": "certificates"
    },
    "users_permissions_user": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user"
    },
    "name": { "type": "string", "required": true },
    "identifier": { "type": "string", "required": true, "minLength": 11, "maxLength": 11 },
    "email": { "type": "email", "required": true },
    "source": {
      "type": "enumeration",
      "enum": ["ATTENDANCE", "SELF_REQUEST", "ADMIN"],
      "required": true
    },
    "issued_at": { "type": "datetime" },
    "sent_at": { "type": "datetime" },
    "revoked_at": { "type": "datetime" }
  }
}
```

Em `src/api/event/content-types/event/schema.json`, após `certificate_config`, adicione:
```json
    "certificates": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::certificate.certificate",
      "mappedBy": "event"
    }
```

- [ ] **Step 2: Escrever os testes dos helpers (falhando)**

`src/api/certificate/services/certificate-helpers.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import {
  CODE_ALPHABET,
  CODE_PREFIX,
  normalizeIdentifier,
  generateCode,
  findActiveCertificate,
  allocateUniqueCode,
} from './certificate-helpers';

const createMockStrapi = (findFirst = vi.fn()) => ({
  documents: vi.fn(() => ({ findFirst })),
  findFirst,
});

describe('normalizeIdentifier', () => {
  it('keeps only digits', () => {
    expect(normalizeIdentifier('123.456.789-09')).toBe('12345678909');
  });
  it('handles empty and undefined', () => {
    expect(normalizeIdentifier('')).toBe('');
    expect(normalizeIdentifier(undefined as any)).toBe('');
  });
});

describe('generateCode', () => {
  it('has prefix and 8 chars from the alphabet', () => {
    const code = generateCode();
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    const body = code.slice(CODE_PREFIX.length);
    expect(body).toHaveLength(8);
    for (const ch of body) expect(CODE_ALPHABET).toContain(ch);
  });
  it('never contains ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).not.toMatch(/[0O1I]/);
    }
  });
  it('is deterministic given the random source', () => {
    const zero = () => 0;
    expect(generateCode(zero)).toBe('RCT-AAAAAAAA');
  });
});

describe('findActiveCertificate', () => {
  it('queries by event documentId, normalized identifier and revoked_at null', async () => {
    const strapi = createMockStrapi(vi.fn().mockResolvedValue({ documentId: 'c1' }));
    const result = await findActiveCertificate(strapi, 'ev1', '123.456.789-09');
    expect(result).toEqual({ documentId: 'c1' });
    expect(strapi.documents).toHaveBeenCalledWith('api::certificate.certificate');
    expect(strapi.findFirst).toHaveBeenCalledWith({
      filters: {
        event: { documentId: { $eq: 'ev1' } },
        identifier: { $eq: '12345678909' },
        revoked_at: { $null: true },
      },
      populate: ['event'],
    });
  });
  it('returns null when nothing found', async () => {
    const strapi = createMockStrapi(vi.fn().mockResolvedValue(null));
    expect(await findActiveCertificate(strapi, 'ev1', '1')).toBeNull();
  });
});

describe('allocateUniqueCode', () => {
  it('returns the first free code', async () => {
    const strapi = createMockStrapi(vi.fn().mockResolvedValue(null));
    const code = await allocateUniqueCode(strapi, () => 0);
    expect(code).toBe('RCT-AAAAAAAA');
    expect(strapi.findFirst).toHaveBeenCalledWith({ filters: { code: { $eq: 'RCT-AAAAAAAA' } } });
  });
  it('retries on collision', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ documentId: 'taken' })
      .mockResolvedValueOnce(null);
    const strapi = createMockStrapi(findFirst);
    const code = await allocateUniqueCode(strapi);
    expect(code).toMatch(/^RCT-[A-Z2-9]{8}$/);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
  it('throws after 5 collisions', async () => {
    const strapi = createMockStrapi(vi.fn().mockResolvedValue({ documentId: 'taken' }));
    await expect(allocateUniqueCode(strapi)).rejects.toThrow(
      'Não foi possível gerar um código único para o certificado',
    );
    expect(strapi.findFirst).toHaveBeenCalledTimes(5);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
yarn vitest run src/api/certificate
```
Esperado: FAIL — `Cannot find module './certificate-helpers'`.

- [ ] **Step 4: Implementar os helpers**

`src/api/certificate/services/certificate-helpers.ts`:
```ts
/**
 * Pure helpers for the certificate service — kept separate so they can be unit tested
 * without booting Strapi.
 */

export const CODE_PREFIX = 'RCT-';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
export const MAX_CODE_ATTEMPTS = 5;

const CERTIFICATE_UID = 'api::certificate.certificate';

export function normalizeIdentifier(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function generateCode(random: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(random() * CODE_ALPHABET.length);
    body += CODE_ALPHABET[index];
  }
  return `${CODE_PREFIX}${body}`;
}

export async function findActiveCertificate(
  strapi: any,
  eventDocumentId: string,
  identifier: string,
): Promise<any | null> {
  const existing = await strapi.documents(CERTIFICATE_UID).findFirst({
    filters: {
      event: { documentId: { $eq: eventDocumentId } },
      identifier: { $eq: normalizeIdentifier(identifier) },
      revoked_at: { $null: true },
    },
    populate: ['event'],
  });
  return existing || null;
}

export async function allocateUniqueCode(
  strapi: any,
  random: () => number = Math.random,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode(random);
    const taken = await strapi.documents(CERTIFICATE_UID).findFirst({
      filters: { code: { $eq: code } },
    });
    if (!taken) return code;
  }
  throw new Error('Não foi possível gerar um código único para o certificado');
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
yarn vitest run src/api/certificate
```
Esperado: 10 testes PASS.

- [ ] **Step 6: Service, controller e router**

`src/api/certificate/services/certificate.ts`:
```ts
/**
 * certificate service
 *
 * create() is idempotent per (event, identifier): re-issuing returns the existing
 * non-revoked certificate. delete() soft-deletes via revoked_at.
 */

import { factories } from '@strapi/strapi';
import {
  allocateUniqueCode,
  findActiveCertificate,
  normalizeIdentifier,
} from './certificate-helpers';

export default factories.createCoreService('api::certificate.certificate', ({ strapi }) => ({
  async create(params: any) {
    const data = params?.data || {};
    const identifier = normalizeIdentifier(data.identifier);
    const eventDocumentId = typeof data.event === 'string' ? data.event : data.event?.documentId;

    if (!eventDocumentId) {
      throw new Error('Evento é obrigatório para emitir um certificado');
    }
    if (identifier.length !== 11) {
      throw new Error('CPF inválido: informe 11 dígitos');
    }

    const existing = await findActiveCertificate(strapi, eventDocumentId, identifier);
    if (existing) {
      return existing;
    }

    const code = await allocateUniqueCode(strapi);

    return super.create({
      ...params,
      data: {
        ...data,
        identifier,
        code,
        issued_at: data.issued_at || new Date(),
      },
    });
  },

  async delete(documentId: string, params: any) {
    return super.update(documentId, {
      ...params,
      data: {
        ...params?.data,
        revoked_at: new Date(),
      },
    });
  },
}));
```

`src/api/certificate/controllers/certificate.ts`:
```ts
/**
 * certificate controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::certificate.certificate');
```

`src/api/certificate/routes/certificate.ts`:
```ts
/**
 * certificate router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::certificate.certificate');
```

- [ ] **Step 7: Gerar tipos, compilar, testar tudo**

```bash
yarn strapi ts:generate-types
npx tsc --noEmit -p tsconfig.json
yarn vitest run
```
Esperado: sem erros de tipo; todos os testes (event + certificate) passam.

- [ ] **Step 8: Verificação manual da idempotência**

```bash
yarn develop
```
Em outro terminal, com um token de API (Settings → API Tokens, full access) e um `documentId` de evento existente:
```bash
TOKEN=<token>; EV=<eventDocumentId>
for i in 1 2; do
  curl -s -X POST http://localhost:1337/api/certificates \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"data\":{\"name\":\"Teste\",\"identifier\":\"123.456.789-09\",\"email\":\"t@t.com\",\"source\":\"ADMIN\",\"event\":\"$EV\"}}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d["code"], d["identifier"])'
done
```
Esperado: as duas linhas mostram **o mesmo** `code` e `identifier` `12345678909`. Pare o servidor.

- [ ] **Step 9: Commit**

```bash
git add src/api/certificate src/api/event/content-types/event/schema.json types/generated
git commit -m "feat: add certificate content type with unique code and idempotent issuing"
```

---

### Task 3: Atualizar `CLAUDE.md` do backend

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Atualizar a seção de estrutura e padrões**

Em `CLAUDE.md`:
1. Em "Project Structure", troque `# API modules (11 entities)` por `# API modules (22 entities)` e adicione à lista, em ordem alfabética:
```
    analytics-event/    # Tracking events
    attendance/         # Lista de presença (user × event)
    certificate/        # Issued participation certificates (unique code, idempotent per event+CPF)
    certificate-config/ # Per-event certificate template (sponsors, signatures, text)
    event-feedback/     # Post-event NPS survey
    participant/        # Legacy certificate requests (kept for data; new flow uses certificate)
    sw-form/            # Startup Weekend volunteer form
    team/               # Teams within an event (custom actions: changeLead, leaveTeam, uploadPresentation)
    vote/, voting-option/, voting-session/  # Public voting
```
2. Em "Factory Pattern", troque "No custom endpoints exist" por: "Most modules use factory defaults. Custom routes exist in `team` (`routes/01-custom-team.ts`) and `voting-session` (`getResults`)."
3. Em "Soft Deletes", adicione `Certificate` (campo `revoked_at`) à lista de entidades com soft delete.
4. Adicione uma subseção:
```markdown
### Certificate issuing
`api::certificate` `create()` is idempotent per `(event, identifier)`: it returns the
existing non-revoked certificate instead of creating a duplicate. `code` is `RCT-` + 8 chars
from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, allocated with collision retry (max 5). Pure logic
lives in `services/certificate-helpers.ts` (tested). Components: `certificate.sponsor`,
`certificate.signature`.
```
5. Em "Testing", troque "Current coverage: slug generation for events" por "Current coverage: slug generation for events; certificate code/idempotency helpers".

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update backend CLAUDE.md with certificate entities and current module list"
```

---

# FASE 2 — BFF, auto-atendimento (`hub-community-bff`)

### Task 4: Vitest no BFF + data source `certificates`

**Files:**
- Modify: `package.json` (script `test`, devDependency `vitest`)
- Create: `vitest.config.js`
- Create: `src/dataSources/manager-integration/certificates/index.js`
- Modify: `src/dataSources/manager-integration/index.js`

**Interfaces:**
- Produces (em `dataSources.managerIntegration`), todas retornam `{ data, meta }` do `createStrapiFetch` salvo indicação:
  - `findEventByDocumentId(documentId)` → `data` = evento com `location`, `communities`, `images`
  - `findCertificateConfigByEvent(eventDocumentId)` → `data` = array (0 ou 1) com `logo`, `background`, `sponsors.logo`, `signatures.image`, `event`
  - `createCertificateConfig(data)`, `updateCertificateConfig(documentId, data)`
  - `findCertificateByCode(code)` → `data` = array (0 ou 1) com `event`, `event.location`, `event.communities`
  - `findCertificateByEventAndIdentifier(eventDocumentId, identifier)` → idem, só não revogados
  - `findCertificatesByEvent(eventDocumentId)` → **array** (todas as páginas), não revogados
  - `createCertificate(data)`, `updateCertificate(documentId, data)`
  - `findAttendancesByEvent(eventDocumentId)` → **array** (todas as páginas) com `users_permissions_user`
  - `findParticipantsByEvent(eventDocumentId)` → **array** (todas as páginas)

- [ ] **Step 1: Branch e Vitest**

```bash
cd /Users/pedrogoiania/projects/reactivando/hub-community-bff
git checkout main && git pull && git checkout -b feat/certificados
yarn add -D vitest
```

Em `package.json`, troque o script `test`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

`vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
```

Confirme que roda (0 testes ainda):
```bash
yarn test
```
Esperado: "No test files found" com exit 0 (ou `--passWithNoTests`; se sair com 1, adicione `passWithNoTests: true` ao config).

- [ ] **Step 2: Data source**

`src/dataSources/manager-integration/certificates/index.js`:
```js
import managerNetworkUtils from '../../../utils/network/manager';

const { fetch, buildQuery } = managerNetworkUtils;

const PAGE_SIZE = 100;

// Walks every page of a Strapi collection and returns a flat array.
const fetchAllPages = async (buildRoute, headers) => {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const response = await fetch(buildRoute({ page, pageSize: PAGE_SIZE }), 'GET', headers);
    all = [...all, ...(response?.data || [])];
    const meta = response?.meta;
    if (meta && page < meta.pageCount) {
      page += 1;
    } else {
      hasMore = false;
    }
  }
  return all;
};

const CONFIG_POPULATE = ['logo', 'background', 'sponsors.logo', 'signatures.image', 'event'];
const CERTIFICATE_POPULATE = ['event', 'event.location', 'event.communities', 'users_permissions_user'];

const findEventByDocumentId = (documentId, headers) => {
  const query = buildQuery({}, [], {}, '', ['location', 'communities', 'images']);
  return fetch(`/events/${documentId}?${query}`, 'GET', headers);
};

const findCertificateConfigByEvent = (eventDocumentId, headers) => {
  const filters = { event: { documentId: { eq: eventDocumentId } } };
  const query = buildQuery(filters, [], { pageSize: 1 }, '', CONFIG_POPULATE);
  return fetch(`/certificate-configs?${query}`, 'GET', headers);
};

const createCertificateConfig = (data, headers) => {
  const query = buildQuery({}, [], {}, '', CONFIG_POPULATE);
  return fetch(`/certificate-configs?${query}`, 'POST', headers, { data });
};

const updateCertificateConfig = (documentId, data, headers) => {
  const query = buildQuery({}, [], {}, '', CONFIG_POPULATE);
  return fetch(`/certificate-configs/${documentId}?${query}`, 'PUT', headers, { data });
};

const findCertificateByCode = (code, headers) => {
  const filters = { code: { eq: code } };
  const query = buildQuery(filters, [], { pageSize: 1 }, '', CERTIFICATE_POPULATE);
  return fetch(`/certificates?${query}`, 'GET', headers);
};

const findCertificateByEventAndIdentifier = (eventDocumentId, identifier, headers) => {
  const filters = {
    event: { documentId: { eq: eventDocumentId } },
    identifier: { eq: identifier },
    revoked_at: { null: true },
  };
  const query = buildQuery(filters, [], { pageSize: 1 }, '', CERTIFICATE_POPULATE);
  return fetch(`/certificates?${query}`, 'GET', headers);
};

const findCertificatesByEvent = (eventDocumentId, headers) =>
  fetchAllPages((pagination) => {
    const filters = {
      event: { documentId: { eq: eventDocumentId } },
      revoked_at: { null: true },
    };
    const query = buildQuery(filters, [{ createdAt: 'desc' }], pagination, '', ['users_permissions_user']);
    return `/certificates?${query}`;
  }, headers);

const createCertificate = (data, headers) => {
  const query = buildQuery({}, [], {}, '', CERTIFICATE_POPULATE);
  return fetch(`/certificates?${query}`, 'POST', headers, { data });
};

const updateCertificate = (documentId, data, headers) => {
  const query = buildQuery({}, [], {}, '', CERTIFICATE_POPULATE);
  return fetch(`/certificates/${documentId}?${query}`, 'PUT', headers, { data });
};

const findAttendancesByEvent = (eventDocumentId, headers) =>
  fetchAllPages((pagination) => {
    const filters = { event: { documentId: { eq: eventDocumentId } } };
    const query = buildQuery(filters, [], pagination, '', ['users_permissions_user']);
    return `/attendances?${query}`;
  }, headers);

const findParticipantsByEvent = (eventDocumentId, headers) =>
  fetchAllPages((pagination) => {
    const filters = { event: { documentId: { eq: eventDocumentId } } };
    const query = buildQuery(filters, [{ createdAt: 'desc' }], pagination, '', []);
    return `/participants?${query}`;
  }, headers);

const certificates = ({ headers }) => ({
  findEventByDocumentId: (documentId) => findEventByDocumentId(documentId, headers),
  findCertificateConfigByEvent: (eventDocumentId) =>
    findCertificateConfigByEvent(eventDocumentId, headers),
  createCertificateConfig: (data) => createCertificateConfig(data, headers),
  updateCertificateConfig: (documentId, data) =>
    updateCertificateConfig(documentId, data, headers),
  findCertificateByCode: (code) => findCertificateByCode(code, headers),
  findCertificateByEventAndIdentifier: (eventDocumentId, identifier) =>
    findCertificateByEventAndIdentifier(eventDocumentId, identifier, headers),
  findCertificatesByEvent: (eventDocumentId) => findCertificatesByEvent(eventDocumentId, headers),
  createCertificate: (data) => createCertificate(data, headers),
  updateCertificate: (documentId, data) => updateCertificate(documentId, data, headers),
  findAttendancesByEvent: (eventDocumentId) => findAttendancesByEvent(eventDocumentId, headers),
  findParticipantsByEvent: (eventDocumentId) => findParticipantsByEvent(eventDocumentId, headers),
});

export default certificates;
```

- [ ] **Step 3: Registrar no `manager-integration/index.js`**

Adicione o import e o spread, seguindo o padrão do arquivo:
```js
import certificates from './certificates';
// ...
  ...attendances({ headers }),
  ...certificates({ headers }),
```

- [ ] **Step 4: Smoke test manual**

Com `.env` preenchido (`MANAGER_URL`, `MANAGER_TOKEN_INTEGRATION`) e o Strapi da Task 2 rodando:
```bash
node -e "
require('@babel/register')({ presets: ['@babel/preset-env'] });
const ds = require('./src/dataSources').default({});
ds.managerIntegration.findCertificatesByEvent('<eventDocumentId>').then(r => console.log(r.length, 'certificates'));
"
```
Esperado: imprime a contagem (1, do teste da Task 2) sem lançar. Se `@babel/register` não estiver instalado, use `yarn dev` e teste na Task 6 via GraphQL.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock vitest.config.js src/dataSources/manager-integration
git commit -m "feat: add certificates data source and vitest setup"
```

---

### Task 5: Lógica pura — `mappers.js` e `eligibility.js`

**Files:**
- Create: `src/resolvers/Certificate/mappers.js`
- Create: `src/resolvers/Certificate/mappers.test.js`
- Create: `src/resolvers/Certificate/eligibility.js`
- Create: `src/resolvers/Certificate/eligibility.test.js`

**Interfaces:**
- `mappers.js` exporta:
  - `mediaUrl(media, baseUrl = process.env.MANAGER_URL)` → `string | null`. Aceita objeto Strapi (`{ url }`), string relativa/absoluta, `null`.
  - `mapConfig(raw, baseUrl?)` → objeto `CertificateConfig` do GraphQL (`logo`/`background` como URL absoluta; `sponsors[].logo`, `signatures[].image` idem; `id = raw.documentId`). `null` → `null`.
  - `mapCertificate(raw)` → objeto `Certificate` (`event` passa adiante cru — o type `Event` já tem resolvers de campo).
  - `mediaIdFromInput(value)` → `number | null` (aceita `"12"`, `12`, `""`, `null`).
- `eligibility.js` exporta:
  - `normalizeIdentifier(value)` → só dígitos
  - `isValidCpf(value)` → boolean (dígitos verificadores; rejeita sequências iguais)
  - `hasEventEnded(event, now = new Date())` → boolean
  - `SELF_REQUEST_MESSAGES` → `{ DISABLED, NOT_ALLOWED, NOT_ENDED }`
  - `selfRequestStatus(config, event, now?)` → `{ ok: true } | { ok: false, reason, message }`
  - `findAttendanceForIdentifier(attendances, identifier)` → attendance ou `null`

- [ ] **Step 1: Testes dos mappers (falhando)**

`src/resolvers/Certificate/mappers.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { mediaUrl, mapConfig, mapCertificate, mediaIdFromInput } from './mappers';

const BASE = 'https://manager.test';

describe('mediaUrl', () => {
  it('prefixes relative strapi urls', () => {
    expect(mediaUrl({ url: '/uploads/a.png' }, BASE)).toBe('https://manager.test/uploads/a.png');
  });
  it('keeps absolute urls', () => {
    expect(mediaUrl({ url: 'https://cdn/x.png' }, BASE)).toBe('https://cdn/x.png');
  });
  it('accepts plain strings and nulls', () => {
    expect(mediaUrl('/uploads/b.png', BASE)).toBe('https://manager.test/uploads/b.png');
    expect(mediaUrl(null, BASE)).toBeNull();
    expect(mediaUrl(undefined, BASE)).toBeNull();
  });
});

describe('mapConfig', () => {
  it('returns null for null', () => {
    expect(mapConfig(null, BASE)).toBeNull();
  });
  it('maps media in nested components', () => {
    const raw = {
      documentId: 'cfg1',
      enabled: true,
      allow_self_request: false,
      title: 'T',
      body_template: 'B',
      workload_hours: 8,
      issuer_name: 'R',
      primary_color: '#10B981',
      logo: { id: 7, url: '/uploads/logo.png' },
      background: null,
      sponsors: [{ name: 'S', url: 'https://s', logo: { id: 8, url: '/uploads/s.png' } }],
      signatures: [{ name: 'A', role: 'CEO', image: null }],
    };
    expect(mapConfig(raw, BASE)).toEqual({
      id: 'cfg1',
      enabled: true,
      allow_self_request: false,
      title: 'T',
      body_template: 'B',
      workload_hours: 8,
      issuer_name: 'R',
      primary_color: '#10B981',
      logo: 'https://manager.test/uploads/logo.png',
      logo_id: '7',
      background: null,
      background_id: null,
      sponsors: [{ name: 'S', url: 'https://s', logo: 'https://manager.test/uploads/s.png', logo_id: '8' }],
      signatures: [{ name: 'A', role: 'CEO', image: null, image_id: null }],
    });
  });
  it('defaults booleans and arrays', () => {
    const mapped = mapConfig({ documentId: 'c' }, BASE);
    expect(mapped.enabled).toBe(false);
    expect(mapped.allow_self_request).toBe(true);
    expect(mapped.sponsors).toEqual([]);
    expect(mapped.signatures).toEqual([]);
  });
});

describe('mapCertificate', () => {
  it('maps fields and passes event through', () => {
    const event = { documentId: 'ev', title: 'Evento' };
    const raw = {
      documentId: 'c1', code: 'RCT-AAAAAAAA', name: 'N', identifier: '12345678909',
      email: 'e@e.com', source: 'ADMIN', issued_at: '2026-01-01', sent_at: null,
      revoked_at: null, event,
    };
    expect(mapCertificate(raw)).toEqual({
      id: 'c1', code: 'RCT-AAAAAAAA', name: 'N', identifier: '12345678909',
      email: 'e@e.com', source: 'ADMIN', issued_at: '2026-01-01', sent_at: null,
      revoked_at: null, event,
    });
  });
  it('returns null for null', () => {
    expect(mapCertificate(null)).toBeNull();
  });
});

describe('mediaIdFromInput', () => {
  it('parses numeric strings', () => {
    expect(mediaIdFromInput('12')).toBe(12);
    expect(mediaIdFromInput(12)).toBe(12);
  });
  it('returns null for empty', () => {
    expect(mediaIdFromInput('')).toBeNull();
    expect(mediaIdFromInput(null)).toBeNull();
    expect(mediaIdFromInput(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Testes de elegibilidade (falhando)**

`src/resolvers/Certificate/eligibility.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  normalizeIdentifier,
  isValidCpf,
  hasEventEnded,
  selfRequestStatus,
  SELF_REQUEST_MESSAGES,
  findAttendanceForIdentifier,
} from './eligibility';

const NOW = new Date('2026-09-11T12:00:00Z');

describe('isValidCpf', () => {
  it('accepts a valid cpf with or without mask', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });
  it('rejects wrong check digits, repeated digits and wrong length', () => {
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('1234')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('hasEventEnded', () => {
  it('is true when end_date is in the past', () => {
    expect(hasEventEnded({ end_date: '2026-09-10T00:00:00Z' }, NOW)).toBe(true);
  });
  it('is false when end_date is in the future or missing', () => {
    expect(hasEventEnded({ end_date: '2026-09-12T00:00:00Z' }, NOW)).toBe(false);
    expect(hasEventEnded({}, NOW)).toBe(false);
  });
});

describe('selfRequestStatus', () => {
  const ended = { end_date: '2026-09-01T00:00:00Z' };
  it('ok when enabled, allowed and ended', () => {
    expect(selfRequestStatus({ enabled: true, allow_self_request: true }, ended, NOW)).toEqual({ ok: true });
  });
  it('DISABLED when config missing or disabled', () => {
    expect(selfRequestStatus(null, ended, NOW)).toEqual({
      ok: false, reason: 'DISABLED', message: SELF_REQUEST_MESSAGES.DISABLED,
    });
    expect(selfRequestStatus({ enabled: false, allow_self_request: true }, ended, NOW).reason).toBe('DISABLED');
  });
  it('NOT_ALLOWED when self request is off', () => {
    expect(selfRequestStatus({ enabled: true, allow_self_request: false }, ended, NOW).reason).toBe('NOT_ALLOWED');
  });
  it('NOT_ENDED when event still running', () => {
    const running = { end_date: '2026-09-30T00:00:00Z' };
    expect(selfRequestStatus({ enabled: true, allow_self_request: true }, running, NOW).reason).toBe('NOT_ENDED');
  });
});

describe('findAttendanceForIdentifier', () => {
  const attendances = [
    { documentId: 'a1', users_permissions_user: { documentId: 'u1', cpf: '529.982.247-25' } },
    { documentId: 'a2', users_permissions_user: null },
  ];
  it('matches by normalized cpf', () => {
    expect(findAttendanceForIdentifier(attendances, '52998224725').documentId).toBe('a1');
  });
  it('returns null when absent', () => {
    expect(findAttendanceForIdentifier(attendances, '00000000000')).toBeNull();
    expect(findAttendanceForIdentifier([], '52998224725')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
yarn test
```
Esperado: FAIL — módulos `./mappers` e `./eligibility` não encontrados.

- [ ] **Step 4: Implementar `mappers.js`**

```js
// Maps raw Strapi payloads (already flattened by graphqlUtils) into the GraphQL shapes.

export const mediaUrl = (media, baseUrl = process.env.MANAGER_URL) => {
  if (!media) return null;
  const url = typeof media === 'string' ? media : media.url;
  if (!url) return null;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
};

export const mediaIdFromInput = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mediaId = (media) => (media && media.id != null ? String(media.id) : null);

export const mapConfig = (raw, baseUrl = process.env.MANAGER_URL) => {
  if (!raw) return null;
  return {
    id: raw.documentId,
    enabled: Boolean(raw.enabled),
    allow_self_request: raw.allow_self_request !== false,
    title: raw.title ?? null,
    body_template: raw.body_template ?? null,
    workload_hours: raw.workload_hours ?? null,
    issuer_name: raw.issuer_name ?? null,
    primary_color: raw.primary_color ?? null,
    logo: mediaUrl(raw.logo, baseUrl),
    logo_id: mediaId(raw.logo),
    background: mediaUrl(raw.background, baseUrl),
    background_id: mediaId(raw.background),
    sponsors: (raw.sponsors || []).map((s) => ({
      name: s.name,
      url: s.url ?? null,
      logo: mediaUrl(s.logo, baseUrl),
      logo_id: mediaId(s.logo),
    })),
    signatures: (raw.signatures || []).map((s) => ({
      name: s.name,
      role: s.role ?? null,
      image: mediaUrl(s.image, baseUrl),
      image_id: mediaId(s.image),
    })),
  };
};

export const mapCertificate = (raw) => {
  if (!raw) return null;
  return {
    id: raw.documentId,
    code: raw.code,
    name: raw.name,
    identifier: raw.identifier,
    email: raw.email,
    source: raw.source,
    issued_at: raw.issued_at ?? null,
    sent_at: raw.sent_at ?? null,
    revoked_at: raw.revoked_at ?? null,
    event: raw.event ?? null,
  };
};
```

- [ ] **Step 5: Implementar `eligibility.js`**

```js
// Pure eligibility rules for certificate self-service. No I/O here.

export const normalizeIdentifier = (value) => (value || '').replace(/\D/g, '');

export const isValidCpf = (value) => {
  const cpf = normalizeIdentifier(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (slice, factor) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i += 1) sum += Number(slice[i]) * (factor - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
};

export const hasEventEnded = (event, now = new Date()) => {
  if (!event?.end_date) return false;
  return new Date(event.end_date) <= now;
};

export const SELF_REQUEST_MESSAGES = {
  DISABLED: 'Os certificados deste evento ainda não estão disponíveis.',
  NOT_ALLOWED: 'Este evento não aceita solicitação livre de certificado. Fale com a organização.',
  NOT_ENDED: 'O certificado estará disponível após o término do evento.',
};

export const selfRequestStatus = (config, event, now = new Date()) => {
  const fail = (reason) => ({ ok: false, reason, message: SELF_REQUEST_MESSAGES[reason] });
  if (!config || !config.enabled) return fail('DISABLED');
  if (config.allow_self_request === false) return fail('NOT_ALLOWED');
  if (!hasEventEnded(event, now)) return fail('NOT_ENDED');
  return { ok: true };
};

export const findAttendanceForIdentifier = (attendances, identifier) => {
  const wanted = normalizeIdentifier(identifier);
  if (!wanted) return null;
  return (
    (attendances || []).find(
      (a) => normalizeIdentifier(a?.users_permissions_user?.cpf) === wanted,
    ) || null
  );
};
```

- [ ] **Step 6: Rodar e ver passar**

```bash
yarn test
```
Esperado: todos PASS (mappers 10, eligibility 9).

- [ ] **Step 7: Commit**

```bash
git add src/resolvers/Certificate
git commit -m "feat: add certificate mappers and eligibility rules with tests"
```

---

### Task 6: GraphQL — config, verificação, lookup e solicitação

**Files:**
- Create: `src/types/Certificate.graphql`
- Create: `src/resolvers/Certificate/index.js`

**Interfaces:**
- Consumes: data source da Task 4; `mapConfig`, `mapCertificate`, `mediaIdFromInput`, `selfRequestStatus`, `hasEventEnded`, `findAttendanceForIdentifier`, `normalizeIdentifier`, `isValidCpf` da Task 5.
- Produces (GraphQL): `certificateConfig`, `certificateByCode`, `lookupCertificate`, `upsertCertificateConfig`, `copyCertificateConfig`, `requestCertificate` conforme spec §2. Em toda a API, `eventId` é o **documentId** do evento no hub (o mesmo que `eventBySlugOrId.documentId`).
- Produces (JS, exportado de `index.js` para a Task 13): `requireUser(user)`, `loadEventAndConfig(dataSources, eventId)` → `{ event, config }` (lança se evento não existe), `buildConfigData(input)`.

- [ ] **Step 1: Schema GraphQL**

`src/types/Certificate.graphql` (a parte de emissão em lote entra na Task 13):
```graphql
# Certificate types — certificado de participação

type CertificateConfig {
  id: String
  enabled: Boolean!
  allow_self_request: Boolean!
  title: String
  body_template: String
  workload_hours: Float
  issuer_name: String
  primary_color: String
  logo: String        # URL absoluta
  logo_id: String     # id de mídia no Strapi (para re-salvar sem novo upload)
  background: String
  background_id: String
  sponsors: [Sponsor!]!
  signatures: [Signature!]!
}

type Sponsor {
  name: String!
  logo: String
  logo_id: String
  url: String
}

type Signature {
  name: String!
  role: String
  image: String
  image_id: String
}

enum CertificateSource {
  ATTENDANCE
  SELF_REQUEST
  ADMIN
}

type Certificate {
  id: String
  code: String!
  name: String!
  identifier: String!
  email: String!
  source: CertificateSource!
  issued_at: String
  sent_at: String
  revoked_at: String
  event: Event
}

type LookupResult {
  certificate: Certificate
  eligible_by_attendance: Boolean!
  self_request_allowed: Boolean!
  event_ended: Boolean!
}

input SponsorInput {
  name: String!
  logo: String!
  url: String
}

input SignatureInput {
  name: String!
  role: String
  image: String
}

input CertificateConfigInput {
  enabled: Boolean
  allow_self_request: Boolean
  title: String
  body_template: String
  workload_hours: Float
  issuer_name: String
  primary_color: String
  logo: String
  background: String
  sponsors: [SponsorInput!]
  signatures: [SignatureInput!]
}

type Query {
  certificateConfig(eventId: String!): CertificateConfig
  certificateByCode(code: String!): Certificate
  lookupCertificate(eventId: String!, identifier: String!): LookupResult!
}

type Mutation {
  upsertCertificateConfig(eventId: String!, data: CertificateConfigInput!): CertificateConfig
  copyCertificateConfig(fromEventId: String!, toEventId: String!): CertificateConfig
  requestCertificate(
    eventId: String!
    name: String!
    identifier: String!
    email: String!
    phone: String
  ): Certificate
}
```

- [ ] **Step 2: Resolvers**

`src/resolvers/Certificate/index.js`:
```js
import { mapConfig, mapCertificate, mediaIdFromInput } from './mappers';
import {
  normalizeIdentifier,
  isValidCpf,
  hasEventEnded,
  selfRequestStatus,
  findAttendanceForIdentifier,
} from './eligibility';

export const requireUser = (user) => {
  if (!user) throw new Error('Não autenticado.');
};

export const loadEventAndConfig = async (dataSources, eventId) => {
  const eventResponse = await dataSources.managerIntegration.findEventByDocumentId(eventId);
  const event = eventResponse?.data;
  if (!event) throw new Error('Evento não encontrado.');
  const configResponse = await dataSources.managerIntegration.findCertificateConfigByEvent(eventId);
  const config = configResponse?.data?.[0] || null;
  return { event, config };
};

// Turns the GraphQL input into the Strapi payload (media as numeric ids).
export const buildConfigData = (input) => {
  const data = {};
  const scalars = ['enabled', 'allow_self_request', 'title', 'body_template',
    'workload_hours', 'issuer_name', 'primary_color'];
  scalars.forEach((key) => {
    if (input[key] !== undefined) data[key] = input[key];
  });
  if (input.logo !== undefined) data.logo = mediaIdFromInput(input.logo);
  if (input.background !== undefined) data.background = mediaIdFromInput(input.background);
  if (input.sponsors !== undefined) {
    data.sponsors = input.sponsors.map((s) => ({
      name: s.name,
      url: s.url || null,
      logo: mediaIdFromInput(s.logo),
    }));
  }
  if (input.signatures !== undefined) {
    data.signatures = input.signatures.map((s) => ({
      name: s.name,
      role: s.role || null,
      image: mediaIdFromInput(s.image),
    }));
  }
  return data;
};

const upsertConfig = async (dataSources, eventId, input) => {
  const { config } = await loadEventAndConfig(dataSources, eventId);
  const data = { ...buildConfigData(input), event: eventId };
  const response = config
    ? await dataSources.managerIntegration.updateCertificateConfig(config.documentId, data)
    : await dataSources.managerIntegration.createCertificateConfig(data);
  return mapConfig(response?.data);
};

// Raw Strapi config → input shape, so it can be re-applied to another event.
const configToInput = (raw) => ({
  enabled: false, // never enable the copy automatically
  allow_self_request: raw.allow_self_request !== false,
  title: raw.title,
  body_template: raw.body_template,
  workload_hours: raw.workload_hours,
  issuer_name: raw.issuer_name,
  primary_color: raw.primary_color,
  logo: raw.logo?.id ?? null,
  background: raw.background?.id ?? null,
  sponsors: (raw.sponsors || []).map((s) => ({ name: s.name, url: s.url, logo: s.logo?.id })),
  signatures: (raw.signatures || []).map((s) => ({ name: s.name, role: s.role, image: s.image?.id })),
});

const Certificate = {
  Query: {
    certificateConfig: async (_, { eventId }, { dataSources }) => {
      const { config } = await loadEventAndConfig(dataSources, eventId);
      return mapConfig(config);
    },

    certificateByCode: async (_, { code }, { dataSources }) => {
      const response = await dataSources.managerIntegration.findCertificateByCode(code.trim().toUpperCase());
      return mapCertificate(response?.data?.[0] || null);
    },

    lookupCertificate: async (_, { eventId, identifier }, { dataSources }) => {
      const cpf = normalizeIdentifier(identifier);
      if (!isValidCpf(cpf)) throw new Error('CPF inválido.');

      const { event, config } = await loadEventAndConfig(dataSources, eventId);
      const eventEnded = hasEventEnded(event);
      const selfRequestAllowed = selfRequestStatus(config, event).ok;

      const existing = await dataSources.managerIntegration.findCertificateByEventAndIdentifier(eventId, cpf);
      const existingCertificate = existing?.data?.[0];
      if (existingCertificate) {
        return {
          certificate: mapCertificate(existingCertificate),
          eligible_by_attendance: true,
          self_request_allowed: selfRequestAllowed,
          event_ended: eventEnded,
        };
      }

      const attendances = await dataSources.managerIntegration.findAttendancesByEvent(eventId);
      const attendance = findAttendanceForIdentifier(attendances, cpf);
      const eligible = Boolean(attendance);

      let certificate = null;
      if (eligible && config?.enabled && eventEnded) {
        const user = attendance.users_permissions_user;
        const created = await dataSources.managerIntegration.createCertificate({
          event: eventId,
          name: user.name || user.username,
          identifier: cpf,
          email: user.email,
          source: 'ATTENDANCE',
          users_permissions_user: user.documentId,
        });
        certificate = mapCertificate(created?.data);
      }

      return {
        certificate,
        eligible_by_attendance: eligible,
        self_request_allowed: selfRequestAllowed,
        event_ended: eventEnded,
      };
    },
  },

  Mutation: {
    upsertCertificateConfig: async (_, { eventId, data }, { user, dataSources }) => {
      requireUser(user);
      return upsertConfig(dataSources, eventId, data);
    },

    copyCertificateConfig: async (_, { fromEventId, toEventId }, { user, dataSources }) => {
      requireUser(user);
      const { config: source } = await loadEventAndConfig(dataSources, fromEventId);
      if (!source) throw new Error('O evento de origem não tem modelo de certificado.');
      return upsertConfig(dataSources, toEventId, configToInput(source));
    },

    requestCertificate: async (_, { eventId, name, identifier, email }, { dataSources }) => {
      const cpf = normalizeIdentifier(identifier);
      if (!isValidCpf(cpf)) throw new Error('CPF inválido.');
      if (!name?.trim()) throw new Error('Nome é obrigatório.');
      if (!email?.trim()) throw new Error('E-mail é obrigatório.');

      const { event, config } = await loadEventAndConfig(dataSources, eventId);
      const status = selfRequestStatus(config, event);
      if (!status.ok) throw new Error(status.message);

      const created = await dataSources.managerIntegration.createCertificate({
        event: eventId,
        name: name.trim(),
        identifier: cpf,
        email: email.trim().toLowerCase(),
        source: 'SELF_REQUEST',
      });
      return mapCertificate(created?.data);
    },
  },
};

export default Certificate;
```

Nota: `resolvers/index.js` carrega toda pasta em `src/resolvers` e faz spread de `resolver.default` — as exportações nomeadas (`requireUser`, …) não entram no schema. O `phone` de `requestCertificate` é aceito mas não persistido (o `certificate` não tem telefone; mantido na assinatura para o form atual não quebrar).

- [ ] **Step 3: Verificar no GraphQL**

```bash
yarn dev
```
Em `http://localhost:4000/graphql` (Apollo Sandbox), com `EV` = documentId do evento usado na Task 2:

```graphql
query { certificateByCode(code: "RCT-XXXXXXXX") { code name event { title } } }
```
Esperado: o certificado da Task 2 (use o código impresso lá).

```graphql
query { lookupCertificate(eventId: "EV", identifier: "123.456.789-09") {
  certificate { code } eligible_by_attendance self_request_allowed event_ended } }
```
Esperado: devolve o certificado da Task 2 (`certificate.code` igual ao impresso lá — `123.456.789-09` tem dígitos verificadores válidos e o `identifier` coincide). Repita com `529.982.247-25`: `certificate: null`, `eligible_by_attendance: false`, `self_request_allowed: false` (config inexistente). Repita com `111.111.111-11`: erro `CPF inválido.`

Com header `authorization: Bearer <token de usuário logado no front>`:
```graphql
mutation { upsertCertificateConfig(eventId: "EV", data: { enabled: true, title: "Certificado", sponsors: [], signatures: [{ name: "Ana", role: "Organizadora" }] }) {
  id enabled title signatures { name role image } } }
```
Esperado: objeto com `enabled: true`. Sem o header: erro `Não autenticado.`

```graphql
mutation { requestCertificate(eventId: "EV", name: "Maria", identifier: "529.982.247-25", email: "m@x.com") { code source } }
```
Esperado: se o evento já terminou, `source: SELF_REQUEST` e um `code`; senão erro "O certificado estará disponível após o término do evento."

- [ ] **Step 4: Commit**

```bash
git add src/types/Certificate.graphql src/resolvers/Certificate
git commit -m "feat: add certificate config, lookup, verification and self-request GraphQL API"
```

---

# FASE 3 — Frontend, auto-atendimento + aba Modelo (`hub-community-frontend`)

### Task 7: Dependências + lógica pura `src/lib/certificate.ts`

**Files:**
- Modify: `package.json` (deps)
- Create: `src/lib/certificate.ts`
- Create: `src/lib/__tests__/certificate.test.ts`

**Interfaces:**
- Produces (todos exportados de `src/lib/certificate.ts`):
  - `PLACEHOLDERS: readonly ['nome','evento','carga_horaria','data_inicio','data_fim','local','comunidade']`, `type Placeholder`
  - `DEFAULT_TITLE = 'Certificado de Participação'`, `DEFAULT_PRIMARY_COLOR = '#10B981'`
  - `DEFAULT_BODY_TEMPLATE` (com local) e `DEFAULT_BODY_TEMPLATE_NO_LOCATION`
  - `defaultBodyTemplate(hasLocation: boolean): string`
  - `resolveTemplate(template: string, vars: Partial<Record<Placeholder, string>>): string`
  - `workloadHours(config: { workload_hours?: number | null }, event: { start_date: string; end_date: string }): number`
  - `formatHours(hours: number): string` — `8` → `"8"`, `1.5` → `"1,5"`
  - `formatDate(iso: string): string` — `dd/MM/yyyy` no fuso de São Paulo
  - `eventLocationLabel(event: CertificateEventInfo): string`
  - `buildTemplateVars(input: { config: CertificateConfigLike; event: CertificateEventInfo; name: string }): Record<Placeholder, string>`
  - `resolveBody(config, event, name): string` — escolhe template (custom ou default) e resolve
  - `certificateFileName(event: { slug?: string | null; title: string }, name: string): string` — `certificado-<slug-evento>-<slug-nome>.pdf`
  - `normalizeIdentifier(cpf: string): string`, `isValidCpf(cpf: string): boolean`, `formatCpf(digits: string): string`
  - `imageSrc(url: string | null | undefined, opts: { server: boolean }): string | undefined` — no browser, `/api/og-image?url=<encoded>`; no servidor, a URL crua
  - `verifyUrl(code: string, baseUrl?: string): string` — `${baseUrl}/certificado/verificar/${code}`
  - `interface CertificateEventInfo { title: string; slug?: string | null; start_date: string; end_date: string; is_online?: boolean | null; location?: { title?: string | null; city?: string | null } | null; communities?: { title: string }[] | null }`
  - `interface CertificateConfigLike { title?: string | null; body_template?: string | null; workload_hours?: number | null; issuer_name?: string | null; primary_color?: string | null; logo?: string | null; background?: string | null; sponsors?: { name: string; logo?: string | null; url?: string | null }[]; signatures?: { name: string; role?: string | null; image?: string | null }[] }`

- [ ] **Step 1: Branch e dependências**

```bash
cd /Users/pedrogoiania/projects/reactivando/hub-community-frontend
git checkout feat/certificados   # já existe (spec + plano)
pnpm add @react-pdf/renderer jszip qrcode
pnpm add -D @types/qrcode
```

- [ ] **Step 2: Testes (falhando)**

`src/lib/__tests__/certificate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  workloadHours,
  formatHours,
  formatDate,
  eventLocationLabel,
  buildTemplateVars,
  resolveBody,
  certificateFileName,
  normalizeIdentifier,
  isValidCpf,
  formatCpf,
  imageSrc,
  verifyUrl,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_BODY_TEMPLATE_NO_LOCATION,
} from '../certificate';

const event = {
  title: 'React Summit Goiânia',
  slug: 'react-summit-goiania',
  start_date: '2026-08-01T12:00:00.000Z',
  end_date: '2026-08-01T21:30:00.000Z',
  is_online: false,
  location: { title: 'Sebrae', city: 'Goiânia' },
  communities: [{ title: 'Reactivando' }],
};

describe('resolveTemplate', () => {
  it('replaces placeholders, tolerating inner spaces', () => {
    expect(resolveTemplate('Olá {{nome}} — {{ evento }}', { nome: 'Ana', evento: 'X' })).toBe('Olá Ana — X');
  });
  it('keeps unknown or missing placeholders literal', () => {
    expect(resolveTemplate('{{foo}} {{nome}}', {})).toBe('{{foo}} {{nome}}');
  });
});

describe('workloadHours', () => {
  it('prefers configured hours when > 0', () => {
    expect(workloadHours({ workload_hours: 6 }, event)).toBe(6);
  });
  it('derives from dates, rounding up, minimum 1', () => {
    expect(workloadHours({ workload_hours: null }, event)).toBe(10); // 9h30 → 10
    expect(workloadHours({}, { ...event, end_date: '2026-08-01T12:20:00.000Z' })).toBe(1);
  });
});

describe('formatHours / formatDate', () => {
  it('formats decimals with comma', () => {
    expect(formatHours(8)).toBe('8');
    expect(formatHours(1.5)).toBe('1,5');
  });
  it('formats dates in São Paulo timezone', () => {
    expect(formatDate('2026-08-02T01:00:00.000Z')).toBe('01/08/2026');
  });
});

describe('eventLocationLabel', () => {
  it('uses "online" for online events', () => {
    expect(eventLocationLabel({ ...event, is_online: true })).toBe('online');
  });
  it('joins title and city', () => {
    expect(eventLocationLabel(event)).toBe('Sebrae, Goiânia');
  });
  it('is empty without location', () => {
    expect(eventLocationLabel({ ...event, location: null })).toBe('');
  });
});

describe('buildTemplateVars / resolveBody', () => {
  it('builds every placeholder', () => {
    expect(buildTemplateVars({ config: { workload_hours: 8 }, event, name: 'Ana' })).toEqual({
      nome: 'Ana',
      evento: 'React Summit Goiânia',
      carga_horaria: '8',
      data_inicio: '01/08/2026',
      data_fim: '01/08/2026',
      local: 'Sebrae, Goiânia',
      comunidade: 'Reactivando',
    });
  });
  it('uses the default template with location', () => {
    expect(resolveBody({}, event, 'Ana')).toBe(
      'Certificamos que Ana participou do evento React Summit Goiânia, realizado em Sebrae, Goiânia de 01/08/2026 a 01/08/2026, com carga horária de 10 horas.',
    );
  });
  it('omits the location clause when there is none', () => {
    expect(resolveBody({}, { ...event, location: null }, 'Ana')).toBe(
      'Certificamos que Ana participou do evento React Summit Goiânia, de 01/08/2026 a 01/08/2026, com carga horária de 10 horas.',
    );
    expect(DEFAULT_BODY_TEMPLATE).toContain('{{local}}');
    expect(DEFAULT_BODY_TEMPLATE_NO_LOCATION).not.toContain('{{local}}');
  });
  it('uses the custom template when present', () => {
    expect(resolveBody({ body_template: 'X {{nome}}' }, event, 'Ana')).toBe('X Ana');
  });
});

describe('certificateFileName', () => {
  it('slugifies event and name', () => {
    expect(certificateFileName(event, 'Maria José da Silva')).toBe('certificado-react-summit-goiania-maria-jose-da-silva.pdf');
  });
  it('falls back to the title when there is no slug', () => {
    expect(certificateFileName({ title: 'Meetup #3' }, 'Ana')).toBe('certificado-meetup-3-ana.pdf');
  });
});

describe('cpf helpers', () => {
  it('normalizes, validates and formats', () => {
    expect(normalizeIdentifier('529.982.247-25')).toBe('52998224725');
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529')).toBe('529');
  });
});

describe('imageSrc / verifyUrl', () => {
  it('proxies in the browser and passes through on the server', () => {
    const url = 'https://manager.hubcommunity.io/uploads/a.png';
    expect(imageSrc(url, { server: false })).toBe(`/api/og-image?url=${encodeURIComponent(url)}`);
    expect(imageSrc(url, { server: true })).toBe(url);
    expect(imageSrc(null, { server: true })).toBeUndefined();
  });
  it('builds the verification url', () => {
    expect(verifyUrl('RCT-AAAAAAAA', 'https://hubcommunity.io')).toBe('https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
pnpm test src/lib/__tests__/certificate.test.ts
```
Esperado: FAIL — módulo `../certificate` não encontrado.

- [ ] **Step 4: Implementar `src/lib/certificate.ts`**

```ts
// Pure helpers for participation certificates. No React, no Apollo — safe in Node and browser.

export const PLACEHOLDERS = [
  'nome',
  'evento',
  'carga_horaria',
  'data_inicio',
  'data_fim',
  'local',
  'comunidade',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export const DEFAULT_TITLE = 'Certificado de Participação';
export const DEFAULT_PRIMARY_COLOR = '#10B981';
export const DEFAULT_BODY_TEMPLATE =
  'Certificamos que {{nome}} participou do evento {{evento}}, realizado em {{local}} de {{data_inicio}} a {{data_fim}}, com carga horária de {{carga_horaria}} horas.';
export const DEFAULT_BODY_TEMPLATE_NO_LOCATION =
  'Certificamos que {{nome}} participou do evento {{evento}}, de {{data_inicio}} a {{data_fim}}, com carga horária de {{carga_horaria}} horas.';

export interface CertificateEventInfo {
  title: string;
  slug?: string | null;
  start_date: string;
  end_date: string;
  is_online?: boolean | null;
  location?: { title?: string | null; city?: string | null } | null;
  communities?: { title: string }[] | null;
}

export interface CertificateConfigLike {
  title?: string | null;
  body_template?: string | null;
  workload_hours?: number | null;
  issuer_name?: string | null;
  primary_color?: string | null;
  logo?: string | null;
  background?: string | null;
  sponsors?: { name: string; logo?: string | null; url?: string | null }[];
  signatures?: { name: string; role?: string | null; image?: string | null }[];
}

export function defaultBodyTemplate(hasLocation: boolean): string {
  return hasLocation ? DEFAULT_BODY_TEMPLATE : DEFAULT_BODY_TEMPLATE_NO_LOCATION;
}

export function resolveTemplate(
  template: string,
  vars: Partial<Record<Placeholder, string>>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value === undefined ? match : value;
  });
}

export function workloadHours(
  config: { workload_hours?: number | null },
  event: { start_date: string; end_date: string },
): number {
  if (config.workload_hours && config.workload_hours > 0) return config.workload_hours;
  const ms = new Date(event.end_date).getTime() - new Date(event.start_date).getTime();
  const hours = Math.ceil(ms / 3_600_000);
  return Number.isFinite(hours) && hours > 0 ? hours : 1;
}

export function formatHours(hours: number): string {
  return String(hours).replace('.', ',');
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function eventLocationLabel(event: CertificateEventInfo): string {
  if (event.is_online) return 'online';
  const parts = [event.location?.title, event.location?.city].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.join(', ');
}

export function buildTemplateVars(input: {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  name: string;
}): Record<Placeholder, string> {
  const { config, event, name } = input;
  return {
    nome: name,
    evento: event.title,
    carga_horaria: formatHours(workloadHours(config, event)),
    data_inicio: formatDate(event.start_date),
    data_fim: formatDate(event.end_date),
    local: eventLocationLabel(event),
    comunidade: (event.communities || []).map((c) => c.title).join(', '),
  };
}

export function resolveBody(
  config: CertificateConfigLike,
  event: CertificateEventInfo,
  name: string,
): string {
  const vars = buildTemplateVars({ config, event, name });
  const template = config.body_template?.trim() || defaultBodyTemplate(Boolean(vars.local));
  return resolveTemplate(template, vars);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function certificateFileName(
  event: { slug?: string | null; title: string },
  name: string,
): string {
  const eventPart = event.slug || slugify(event.title);
  return `certificado-${eventPart}-${slugify(name)}.pdf`;
}

export function normalizeIdentifier(cpf: string): string {
  return (cpf || '').replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeIdentifier(cpf);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (factor - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(digits.slice(0, 9), 10) === Number(digits[9]) && check(digits.slice(0, 10), 11) === Number(digits[10]);
}

export function formatCpf(digits: string): string {
  const d = normalizeIdentifier(digits);
  if (d.length !== 11) return d;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function imageSrc(
  url: string | null | undefined,
  opts: { server: boolean },
): string | undefined {
  if (!url) return undefined;
  return opts.server ? url : `/api/og-image?url=${encodeURIComponent(url)}`;
}

export function verifyUrl(code: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://hubcommunity.io');
  return `${base}/certificado/verificar/${code}`;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm test src/lib/__tests__/certificate.test.ts
```
Esperado: PASS (18 testes).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/certificate.ts src/lib/__tests__/certificate.test.ts
git commit -m "feat: add certificate template helpers and pdf dependencies"
```

---

### Task 8: Tipos e queries GraphQL no frontend

**Files:**
- Modify: `src/lib/types.ts` (append)
- Modify: `src/lib/queries.ts` (append)

**Interfaces:**
- Produces (types): `CertificateSponsor`, `CertificateSignature`, `CertificateConfig`, `CertificateConfigInput`, `Certificate`, `CertificateEvent`, `LookupResult`, e os wrappers `CertificateConfigResponse`, `CertificateByCodeResponse`, `LookupCertificateResponse`, `UpsertCertificateConfigResponse`, `CopyCertificateConfigResponse`, `RequestCertificateResponse`.
- Produces (queries): `GET_CERTIFICATE_CONFIG`, `GET_CERTIFICATE_BY_CODE`, `LOOKUP_CERTIFICATE`, `UPSERT_CERTIFICATE_CONFIG`, `COPY_CERTIFICATE_CONFIG`, `REQUEST_CERTIFICATE`. Fragmento `CERTIFICATE_FIELDS`.

- [ ] **Step 1: Tipos**

Ao final de `src/lib/types.ts`:
```ts
// Certificates (certificado de participação)
export interface CertificateSponsor {
  name: string;
  logo?: string | null;
  logo_id?: string | null;
  url?: string | null;
}

export interface CertificateSignature {
  name: string;
  role?: string | null;
  image?: string | null;
  image_id?: string | null;
}

export interface CertificateConfig {
  id?: string;
  enabled: boolean;
  allow_self_request: boolean;
  title?: string | null;
  body_template?: string | null;
  workload_hours?: number | null;
  issuer_name?: string | null;
  primary_color?: string | null;
  logo?: string | null;
  logo_id?: string | null;
  background?: string | null;
  background_id?: string | null;
  sponsors: CertificateSponsor[];
  signatures: CertificateSignature[];
}

export interface CertificateConfigInput {
  enabled?: boolean;
  allow_self_request?: boolean;
  title?: string;
  body_template?: string;
  workload_hours?: number | null;
  issuer_name?: string;
  primary_color?: string;
  logo?: string | null; // Strapi media id
  background?: string | null;
  sponsors?: { name: string; logo: string; url?: string }[];
  signatures?: { name: string; role?: string; image?: string | null }[];
}

export type CertificateSource = 'ATTENDANCE' | 'SELF_REQUEST' | 'ADMIN';

export interface CertificateEvent {
  id: string;
  documentId?: string;
  slug?: string;
  title: string;
  start_date: string;
  end_date: string;
  is_online?: boolean;
  location?: EventLocation | null;
  communities?: { title: string }[];
}

export interface Certificate {
  id?: string;
  code: string;
  name: string;
  identifier: string;
  email: string;
  source: CertificateSource;
  issued_at?: string | null;
  sent_at?: string | null;
  revoked_at?: string | null;
  event?: CertificateEvent | null;
}

export interface LookupResult {
  certificate?: Certificate | null;
  eligible_by_attendance: boolean;
  self_request_allowed: boolean;
  event_ended: boolean;
}

export interface CertificateConfigResponse { certificateConfig: CertificateConfig | null }
export interface CertificateByCodeResponse { certificateByCode: Certificate | null }
export interface LookupCertificateResponse { lookupCertificate: LookupResult }
export interface UpsertCertificateConfigResponse { upsertCertificateConfig: CertificateConfig }
export interface CopyCertificateConfigResponse { copyCertificateConfig: CertificateConfig }
export interface RequestCertificateResponse { requestCertificate: Certificate }
```

- [ ] **Step 2: Queries**

Ao final de `src/lib/queries.ts`:
```ts
// Certificates (certificado de participação)
export const CERTIFICATE_FIELDS = gql`
  fragment CertificateFields on Certificate {
    id
    code
    name
    identifier
    email
    source
    issued_at
    sent_at
    revoked_at
    event {
      id
      documentId
      slug
      title
      start_date
      end_date
      is_online
      location {
        title
        city
      }
      communities {
        title
      }
    }
  }
`;

export const CERTIFICATE_CONFIG_FIELDS = gql`
  fragment CertificateConfigFields on CertificateConfig {
    id
    enabled
    allow_self_request
    title
    body_template
    workload_hours
    issuer_name
    primary_color
    logo
    logo_id
    background
    background_id
    sponsors {
      name
      logo
      logo_id
      url
    }
    signatures {
      name
      role
      image
      image_id
    }
  }
`;

export const GET_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  query GetCertificateConfig($eventId: String!) {
    certificateConfig(eventId: $eventId) {
      ...CertificateConfigFields
    }
  }
`;

export const GET_CERTIFICATE_BY_CODE = gql`
  ${CERTIFICATE_FIELDS}
  query GetCertificateByCode($code: String!) {
    certificateByCode(code: $code) {
      ...CertificateFields
    }
  }
`;

export const LOOKUP_CERTIFICATE = gql`
  ${CERTIFICATE_FIELDS}
  query LookupCertificate($eventId: String!, $identifier: String!) {
    lookupCertificate(eventId: $eventId, identifier: $identifier) {
      certificate {
        ...CertificateFields
      }
      eligible_by_attendance
      self_request_allowed
      event_ended
    }
  }
`;

export const UPSERT_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  mutation UpsertCertificateConfig($eventId: String!, $data: CertificateConfigInput!) {
    upsertCertificateConfig(eventId: $eventId, data: $data) {
      ...CertificateConfigFields
    }
  }
`;

export const COPY_CERTIFICATE_CONFIG = gql`
  ${CERTIFICATE_CONFIG_FIELDS}
  mutation CopyCertificateConfig($fromEventId: String!, $toEventId: String!) {
    copyCertificateConfig(fromEventId: $fromEventId, toEventId: $toEventId) {
      ...CertificateConfigFields
    }
  }
`;

export const REQUEST_CERTIFICATE = gql`
  ${CERTIFICATE_FIELDS}
  mutation RequestCertificate(
    $eventId: String!
    $name: String!
    $identifier: String!
    $email: String!
    $phone: String
  ) {
    requestCertificate(
      eventId: $eventId
      name: $name
      identifier: $identifier
      email: $email
      phone: $phone
    ) {
      ...CertificateFields
    }
  }
`;
```

- [ ] **Step 3: Verificar tipos e commit**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "types.ts|queries.ts" || echo "ok"
git add src/lib/types.ts src/lib/queries.ts
git commit -m "feat: add certificate GraphQL operations and types"
```

---

### Task 9: Componente `CertificateDocument` (react-pdf) + QR

**Files:**
- Create: `src/lib/certificate-qr.ts`
- Create: `src/components/certificate/certificate-document.tsx`
- Create: `src/components/certificate/__tests__/certificate-document.test.tsx`

**Interfaces:**
- Consumes: `resolveBody`, `DEFAULT_TITLE`, `DEFAULT_PRIMARY_COLOR`, `imageSrc`, `CertificateConfigLike`, `CertificateEventInfo` (Task 7).
- Produces:
  - `generateQrDataUrl(text: string): Promise<string>` (`src/lib/certificate-qr.ts`)
  - `interface CertificateDocumentProps { config: CertificateConfigLike; event: CertificateEventInfo; certificate: { code: string; name: string }; verifyUrl: string; qrDataUrl: string; server?: boolean }`
  - `CertificateDocument(props): JSX.Element` — um `<Document>` do react-pdf. Default export **e** export nomeado.

- [ ] **Step 1: QR helper**

`src/lib/certificate-qr.ts`:
```ts
import QRCode from 'qrcode';

// Works in Node and in the browser; react-pdf's <Image> accepts data URLs.
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: 'M' });
}
```

- [ ] **Step 2: Teste de render em Node (falhando)**

`src/components/certificate/__tests__/certificate-document.test.tsx`:
```tsx
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { CertificateDocument } from '../certificate-document';
import { generateQrDataUrl } from '@/lib/certificate-qr';

// 1x1 transparent PNG — keeps the test offline.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const event = {
  title: 'React Summit Goiânia',
  slug: 'react-summit-goiania',
  start_date: '2026-08-01T12:00:00.000Z',
  end_date: '2026-08-01T21:30:00.000Z',
  location: { title: 'Sebrae', city: 'Goiânia' },
  communities: [{ title: 'Reactivando' }],
};

const render = async (config: Parameters<typeof CertificateDocument>[0]['config']) => {
  const qrDataUrl = await generateQrDataUrl('https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA');
  const buffer = await renderToBuffer(
    <CertificateDocument
      config={config}
      event={event}
      certificate={{ code: 'RCT-AAAAAAAA', name: 'Ana Souza' }}
      verifyUrl="https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA"
      qrDataUrl={qrDataUrl}
      server
    />,
  );
  return buffer;
};

describe('CertificateDocument', () => {
  it('renders a PDF with the minimal config', async () => {
    const buffer = await render({});
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders with background, logo, 8 sponsors and 4 signatures', async () => {
    const buffer = await render({
      title: 'Certificado',
      issuer_name: 'Reactivando',
      primary_color: '#8B5CF6',
      logo: PNG,
      background: PNG,
      sponsors: Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, logo: PNG })),
      signatures: [
        { name: 'A', role: 'CEO', image: PNG },
        { name: 'B', role: 'CTO' },
        { name: 'C' },
        { name: 'D', role: 'Org', image: PNG },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
}, 30_000);
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
pnpm test src/components/certificate
```
Esperado: FAIL — módulo `../certificate-document` não encontrado.

- [ ] **Step 4: Implementar o componente**

`src/components/certificate/certificate-document.tsx`:
```tsx
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  resolveBody,
  imageSrc,
  DEFAULT_TITLE,
  DEFAULT_PRIMARY_COLOR,
  type CertificateConfigLike,
  type CertificateEventInfo,
} from '@/lib/certificate';

export interface CertificateDocumentProps {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  certificate: { code: string; name: string };
  verifyUrl: string;
  qrDataUrl: string;
  /** true when rendering in a route handler (images fetched directly, no proxy) */
  server?: boolean;
}

// A4 landscape: 841.89 x 595.28 pt
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    padding: 40,
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 841.89,
    height: 595.28,
  },
  content: { flex: 1, flexDirection: 'column', justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 60 },
  logo: { maxHeight: 60, maxWidth: 200, objectFit: 'contain' },
  issuer: { fontSize: 12, color: '#475569' },
  main: { alignItems: 'center', paddingHorizontal: 40 },
  title: { fontSize: 30, fontFamily: 'Helvetica-Bold', marginBottom: 18, textAlign: 'center' },
  name: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 14, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 1.6, color: '#1e293b', textAlign: 'center', maxWidth: 640 },
  sponsorsBlock: { alignItems: 'center', marginTop: 10 },
  sponsorsLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  sponsorsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  sponsorLogo: { height: 32, maxWidth: 90, objectFit: 'contain' },
  signaturesRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 10 },
  signature: { width: 150, alignItems: 'center' },
  signatureImage: { height: 40, maxWidth: 140, objectFit: 'contain', marginBottom: 4 },
  signatureSpacer: { height: 44 },
  signatureLine: { width: 140, borderTopWidth: 1, borderTopColor: '#94a3b8', marginBottom: 4 },
  signatureName: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  signatureRole: { fontSize: 9, color: '#64748b', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 8, color: '#64748b' },
  code: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 },
  qr: { width: 56, height: 56 },
});

export function CertificateDocument({
  config,
  event,
  certificate,
  verifyUrl,
  qrDataUrl,
  server = false,
}: CertificateDocumentProps) {
  const primary = config.primary_color || DEFAULT_PRIMARY_COLOR;
  const title = config.title?.trim() || DEFAULT_TITLE;
  const body = resolveBody(config, event, certificate.name);
  const src = (url?: string | null) => imageSrc(url, { server });
  const sponsors = (config.sponsors || []).filter((s) => s.logo);
  const signatures = (config.signatures || []).slice(0, 4);

  return (
    <Document title={`${title} - ${certificate.name}`} author={config.issuer_name || 'Hub Community'}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {config.background ? <Image src={src(config.background)!} style={styles.background} /> : null}

        <View style={styles.content}>
          <View style={styles.header}>
            {config.logo ? <Image src={src(config.logo)!} style={styles.logo} /> : <View />}
            {config.issuer_name ? <Text style={styles.issuer}>{config.issuer_name}</Text> : null}
          </View>

          <View style={styles.main}>
            <Text style={[styles.title, { color: primary }]}>{title}</Text>
            <Text style={styles.name}>{certificate.name}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>

          {sponsors.length > 0 ? (
            <View style={styles.sponsorsBlock}>
              <Text style={styles.sponsorsLabel}>Patrocínio</Text>
              <View style={styles.sponsorsRow}>
                {sponsors.map((s, i) => (
                  <Image key={`${s.name}-${i}`} src={src(s.logo)!} style={styles.sponsorLogo} />
                ))}
              </View>
            </View>
          ) : null}

          {signatures.length > 0 ? (
            <View style={styles.signaturesRow}>
              {signatures.map((s, i) => (
                <View key={`${s.name}-${i}`} style={styles.signature}>
                  {s.image ? (
                    <Image src={src(s.image)!} style={styles.signatureImage} />
                  ) : (
                    <View style={styles.signatureSpacer} />
                  )}
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureName}>{s.name}</Text>
                  {s.role ? <Text style={styles.signatureRole}>{s.role}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <View>
              <Text style={styles.code}>Código: {certificate.code}</Text>
              <Text style={styles.footerText}>Verifique a autenticidade em {verifyUrl}</Text>
            </View>
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default CertificateDocument;
```

- [ ] **Step 5: Rodar e ver passar**

```bash
pnpm test src/components/certificate
```
Esperado: 2 PASS. Se `renderToBuffer` reclamar de `jsdom`, confirme que a primeira linha do teste é `// @vitest-environment node`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/certificate-qr.ts src/components/certificate
git commit -m "feat: add react-pdf certificate document with sponsors, signatures and QR"
```

---

### Task 10: Render no servidor — `/api/certificates/[code]/pdf`

**Files:**
- Create: `src/lib/certificate-server.ts`
- Create: `src/app/api/certificates/[code]/pdf/route.ts`

**Interfaces:**
- Consumes: `GET_CERTIFICATE_BY_CODE`, `GET_CERTIFICATE_CONFIG` (Task 8), `CertificateDocument`, `generateQrDataUrl` (Task 9), `certificateFileName`, `verifyUrl` (Task 7).
- Produces (`src/lib/certificate-server.ts`, **só para uso em route handlers**):
  - `graphqlRequest<T>(document: DocumentNode, variables: Record<string, unknown>, authorization?: string): Promise<T>` — POST no BFF (`process.env.GRAPHQL_URL ?? NEXT_PUBLIC_GRAPHQL_URL`), lança `Error(message)` se `errors`.
  - `interface CertificateBundle { certificate: Certificate; config: CertificateConfig; event: CertificateEvent }`
  - `fetchCertificateBundle(code: string): Promise<CertificateBundle | null>` — `null` se não existe **ou** revogado
  - `renderCertificatePdf(bundle: CertificateBundle, baseUrl: string): Promise<Buffer>`
- Produces (HTTP): `GET /api/certificates/:code/pdf` → `application/pdf` (200), 404 `{ error }` se inexistente/revogado, 502 `{ error }` se o render falhar.

- [ ] **Step 1: `src/lib/certificate-server.ts`**

```ts
import React from 'react';
import { print, type DocumentNode } from 'graphql';
import { renderToBuffer } from '@react-pdf/renderer';
import { CertificateDocument } from '@/components/certificate/certificate-document';
import { generateQrDataUrl } from '@/lib/certificate-qr';
import { verifyUrl } from '@/lib/certificate';
import { GET_CERTIFICATE_BY_CODE, GET_CERTIFICATE_CONFIG } from '@/lib/queries';
import type {
  Certificate,
  CertificateByCodeResponse,
  CertificateConfig,
  CertificateConfigResponse,
  CertificateEvent,
} from '@/lib/types';

const GRAPHQL_URL =
  process.env.GRAPHQL_URL || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

export async function graphqlRequest<T>(
  document: DocumentNode,
  variables: Record<string, unknown>,
  authorization?: string,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ query: print(document), variables }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'Erro no BFF');
  }
  return json.data as T;
}

export interface CertificateBundle {
  certificate: Certificate;
  config: CertificateConfig;
  event: CertificateEvent;
}

const EMPTY_CONFIG: CertificateConfig = {
  enabled: false,
  allow_self_request: true,
  sponsors: [],
  signatures: [],
};

export async function fetchCertificateBundle(code: string): Promise<CertificateBundle | null> {
  const { certificateByCode } = await graphqlRequest<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, { code });
  if (!certificateByCode || certificateByCode.revoked_at || !certificateByCode.event) return null;

  const eventId = certificateByCode.event.documentId || certificateByCode.event.id;
  const { certificateConfig } = await graphqlRequest<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, { eventId });

  return {
    certificate: certificateByCode,
    config: certificateConfig || EMPTY_CONFIG,
    event: certificateByCode.event,
  };
}

export async function renderCertificatePdf(bundle: CertificateBundle, baseUrl: string): Promise<Buffer> {
  const url = verifyUrl(bundle.certificate.code, baseUrl);
  const qrDataUrl = await generateQrDataUrl(url);
  const element = React.createElement(CertificateDocument, {
    config: bundle.config,
    event: bundle.event,
    certificate: { code: bundle.certificate.code, name: bundle.certificate.name },
    verifyUrl: url,
    qrDataUrl,
    server: true,
  });
  return renderToBuffer(element);
}
```

- [ ] **Step 2: Route handler**

`src/app/api/certificates/[code]/pdf/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchCertificateBundle, renderCertificatePdf } from '@/lib/certificate-server';
import { certificateFileName } from '@/lib/certificate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renders a certificate PDF on the server. Stable link used in e-mails.
 * GET /api/certificates/RCT-XXXXXXXX/pdf
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let bundle;
  try {
    bundle = await fetchCertificateBundle(code.toUpperCase());
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao buscar certificado' }, { status: 502 });
  }
  if (!bundle) {
    return NextResponse.json({ error: 'Certificado não encontrado ou revogado' }, { status: 404 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const pdf = await renderCertificatePdf(bundle, baseUrl);
    const filename = certificateFileName(bundle.event, bundle.certificate.name);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    console.error('Certificate render error:', error);
    return NextResponse.json({ error: 'Não foi possível gerar o PDF. Verifique as imagens do modelo.' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verificar manualmente**

Com BFF (Task 6) e Strapi rodando e `NEXT_PUBLIC_GRAPHQL_URL` no `.env.local`:
```bash
pnpm dev
curl -s -o /tmp/cert.pdf -w "%{http_code} %{content_type}\n" http://localhost:3000/api/certificates/<code da Task 2>/pdf
head -c 4 /tmp/cert.pdf; echo
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/certificates/RCT-NAOEXISTE/pdf
```
Esperado: `200 application/pdf`, `%PDF`, e `404` com `{"error":"Certificado não encontrado ou revogado"}`. Abra `/tmp/cert.pdf` e confira título, nome, acentos, QR.

- [ ] **Step 4: Commit**

```bash
git add src/lib/certificate-server.ts "src/app/api/certificates/[code]/pdf/route.ts"
git commit -m "feat: add server-side certificate PDF route"
```

---

### Task 11: Páginas públicas — certificado, verificação e auto-atendimento

**Files:**
- Create: `src/components/certificate/certificate-preview.tsx`
- Create: `src/components/certificate/certificate-card.tsx`
- Create: `src/app/certificado/[code]/page.tsx`
- Create: `src/app/certificado/verificar/[code]/page.tsx`
- Modify: `src/app/certificado/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: queries/types (Task 8), `CertificateDocument` + `generateQrDataUrl` (Task 9), helpers (Task 7), rota PDF (Task 10).
- Produces:
  - `CertificatePreview({ config, event, certificate, height? })` — renderiza `PDFViewer`. **Importe sempre com `next/dynamic` e `ssr: false`** (o módulo importa `@react-pdf/renderer`).
  - `CertificateCard({ certificate, config?, showPreview? })` — card com dados, botão "Baixar PDF" (link para `/api/certificates/${code}/pdf`) e link de verificação; se `showPreview && config`, monta o preview.

- [ ] **Step 1: `certificate-preview.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { CertificateDocument } from '@/components/certificate/certificate-document';
import { generateQrDataUrl } from '@/lib/certificate-qr';
import { verifyUrl, type CertificateConfigLike, type CertificateEventInfo } from '@/lib/certificate';
import { Skeleton } from '@/components/ui/skeleton';

interface CertificatePreviewProps {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  certificate: { code: string; name: string };
  height?: number;
}

// Heavy module (react-pdf). Consumers must load this with next/dynamic({ ssr: false }).
export default function CertificatePreview({ config, event, certificate, height = 480 }: CertificatePreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const url = verifyUrl(certificate.code);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(url).then((data) => active && setQrDataUrl(data));
    return () => {
      active = false;
    };
  }, [url]);

  if (!qrDataUrl) return <Skeleton className="w-full" style={{ height }} />;

  return (
    <PDFViewer width="100%" height={height} showToolbar={false} className="rounded-lg border">
      <CertificateDocument
        config={config}
        event={event}
        certificate={certificate}
        verifyUrl={url}
        qrDataUrl={qrDataUrl}
      />
    </PDFViewer>
  );
}
```

- [ ] **Step 2: `certificate-card.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/certificate';
import type { Certificate, CertificateConfig } from '@/lib/types';

const CertificatePreview = dynamic(() => import('@/components/certificate/certificate-preview'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[480px]" />,
});

interface CertificateCardProps {
  certificate: Certificate;
  config?: CertificateConfig | null;
  showPreview?: boolean;
}

export function CertificateCard({ certificate, config, showPreview = false }: CertificateCardProps) {
  const event = certificate.event;
  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Award className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">{certificate.name}</CardTitle>
        {event ? (
          <p className="text-muted-foreground">
            {event.title} · {formatDate(event.start_date)}
            {formatDate(event.end_date) !== formatDate(event.start_date) ? ` a ${formatDate(event.end_date)}` : ''}
          </p>
        ) : null}
        <p className="text-xs font-mono text-muted-foreground mt-2">Código {certificate.code}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {showPreview && config && event ? (
          <CertificatePreview
            config={config}
            event={event}
            certificate={{ code: certificate.code, name: certificate.name }}
          />
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <a href={`/api/certificates/${certificate.code}/pdf`}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/certificado/verificar/${certificate.code}`}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Verificar autenticidade
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: `/certificado/[code]/page.tsx`**

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { CertificateCard } from '@/components/certificate/certificate-card';
import { Card, CardContent } from '@/components/ui/card';
import { GET_CERTIFICATE_BY_CODE, GET_CERTIFICATE_CONFIG } from '@/lib/queries';
import type { CertificateByCodeResponse, CertificateConfigResponse } from '@/lib/types';

export default function CertificadoPorCodigoPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();

  const { data, loading } = useQuery<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, {
    variables: { code },
    skip: !code,
  });
  const certificate = data?.certificateByCode;
  const eventId = certificate?.event?.documentId || certificate?.event?.id;

  const { data: configData } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
  });

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!certificate || certificate.revoked_at) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4">
        <Card className="text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Certificado não encontrado</h2>
            <p className="text-muted-foreground">
              {certificate?.revoked_at ? 'Este certificado foi revogado.' : `Nenhum certificado com o código ${code}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <CertificateCard certificate={certificate} config={configData?.certificateConfig} showPreview />
    </div>
  );
}
```

- [ ] **Step 4: `/certificado/verificar/[code]/page.tsx`**

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { GET_CERTIFICATE_BY_CODE } from '@/lib/queries';
import { formatDate } from '@/lib/certificate';
import type { CertificateByCodeResponse } from '@/lib/types';

export default function VerificarCertificadoPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const { data, loading } = useQuery<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, {
    variables: { code },
    skip: !code,
  });

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const certificate = data?.certificateByCode;
  const valid = Boolean(certificate && !certificate.revoked_at);

  return (
    <div className="container max-w-2xl mx-auto py-20 px-4">
      <Card className={`text-center ${valid ? 'border-green-500/30' : 'border-destructive/30'}`}>
        <CardContent className="pt-10 pb-8 flex flex-col items-center">
          {valid ? (
            <ShieldCheck className="w-16 h-16 text-green-500 mb-4" />
          ) : (
            <ShieldX className="w-16 h-16 text-destructive mb-4" />
          )}
          <h1 className="text-2xl font-bold mb-1">
            {valid ? 'Certificado válido' : certificate ? 'Certificado revogado' : 'Certificado não encontrado'}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mb-6">{code}</p>
          {certificate ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
              <dt className="text-muted-foreground">Participante</dt>
              <dd className="font-medium">{certificate.name}</dd>
              <dt className="text-muted-foreground">Evento</dt>
              <dd className="font-medium">{certificate.event?.title}</dd>
              <dt className="text-muted-foreground">Data do evento</dt>
              <dd>{certificate.event ? formatDate(certificate.event.start_date) : '-'}</dd>
              <dt className="text-muted-foreground">Emitido em</dt>
              <dd>{certificate.issued_at ? formatDate(certificate.issued_at) : '-'}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">Confira o código impresso no certificado e tente novamente.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Reescrever `/certificado/page.tsx`**

Substitua o arquivo inteiro:
```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { AlertCircle, Clock, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CertificateCard } from '@/components/certificate/certificate-card';
import { GET_CERTIFICATE_CONFIG, GET_EVENT_BY_SLUG_OR_ID, LOOKUP_CERTIFICATE, REQUEST_CERTIFICATE } from '@/lib/queries';
import type {
  Certificate,
  CertificateConfigResponse,
  EventResponse,
  LookupCertificateResponse,
  RequestCertificateResponse,
} from '@/lib/types';
import { formatCpf, isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import { adjustToBrazilTimezone } from '@/utils/event';

export default function CertificadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CertificadoContent />
    </Suspense>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="container max-w-2xl mx-auto py-20 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full text-center shadow-lg">
        <CardContent className="pt-10 pb-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">{icon}</div>
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          <div className="text-muted-foreground text-lg max-w-md space-y-6">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function CertificadoContent() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get('event') || '';

  const { data: eventData, loading: eventLoading } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: eventParam },
    skip: !eventParam,
  });
  const event = eventData?.eventBySlugOrId;
  const eventId = event?.documentId || event?.id;

  const { data: configData, loading: configLoading } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
  });
  const config = configData?.certificateConfig;

  const [cpf, setCpf] = useState('');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'not_found_allowed' | 'not_found_blocked'>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone_number: '' });

  const [lookup, { loading: lookingUp }] = useLazyQuery<LookupCertificateResponse>(LOOKUP_CERTIFICATE, {
    fetchPolicy: 'network-only',
  });
  const [requestCertificate, { loading: requesting }] = useMutation<RequestCertificateResponse>(REQUEST_CERTIFICATE);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidCpf(cpf)) {
      setError('CPF inválido.');
      return;
    }
    const { data, error: qError } = await lookup({ variables: { eventId, identifier: normalizeIdentifier(cpf) } });
    if (qError) {
      setError(qError.message);
      return;
    }
    const result = data?.lookupCertificate;
    if (result?.certificate) {
      setCertificate(result.certificate);
      return;
    }
    setLookupState(result?.self_request_allowed ? 'not_found_allowed' : 'not_found_blocked');
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await requestCertificate({
        variables: {
          eventId,
          name: form.name.trim(),
          identifier: normalizeIdentifier(cpf),
          email: form.email.trim(),
          phone: form.phone_number.replace(/\D/g, ''),
        },
      });
      if (data?.requestCertificate) setCertificate(data.requestCertificate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    }
  };

  if (!eventParam) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Evento não informado">
        <p>Acesse o link de certificado enviado pela organização do evento.</p>
      </Message>
    );
  }

  if (eventLoading || configLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Evento não encontrado">
        <p>Confira o link enviado pela organização.</p>
      </Message>
    );
  }

  if (event.end_date && new Date() <= adjustToBrazilTimezone(new Date(event.end_date))) {
    return (
      <Message icon={<Clock className="w-10 h-10 text-amber-500" />} title="Evento em andamento">
        <p>O certificado estará disponível após a conclusão do evento "{event.title}".</p>
        <Link href={`/events/${event.slug || eventId}`}>
          <Button size="lg" variant="outline" className="rounded-full">Voltar para o evento</Button>
        </Link>
      </Message>
    );
  }

  if (!config?.enabled) {
    return (
      <Message icon={<Clock className="w-10 h-10 text-amber-500" />} title="Certificados ainda não disponíveis">
        <p>A organização de "{event.title}" ainda não liberou os certificados. Tente novamente mais tarde.</p>
      </Message>
    );
  }

  if (certificate) {
    return (
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <CertificateCard certificate={certificate} config={config} showPreview />
      </div>
    );
  }

  if (lookupState === 'not_found_blocked') {
    return (
      <Message icon={<Search className="w-10 h-10 text-amber-500" />} title="Participação não encontrada">
        <p>Não encontramos sua participação em "{event.title}" com o CPF {formatCpf(cpf)}. Fale com a organização do evento.</p>
        <Button variant="outline" onClick={() => setLookupState('idle')}>Tentar outro CPF</Button>
      </Message>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2 pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight">Certificado de participação</CardTitle>
          <CardDescription className="text-base">{event.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center space-x-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {lookupState === 'idle' ? (
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  disabled={lookingUp}
                  className="h-12"
                  maxLength={14}
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={lookingUp}>
                {lookingUp ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                Buscar meu certificado
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Não encontramos sua presença registrada. Preencha seus dados para emitir o certificado.
              </p>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Nome completo (como sairá no certificado)</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={requesting} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">CPF</Label>
                <Input value={formatCpf(cpf)} disabled className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={requesting} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-sm font-semibold">WhatsApp</Label>
                <Input id="phone_number" type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} disabled={requesting} className="h-12" maxLength={15} />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-12" onClick={() => setLookupState('idle')} disabled={requesting}>Voltar</Button>
                <Button type="submit" className="flex-1 h-12 text-lg font-medium" disabled={requesting}>
                  {requesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Emitir certificado
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verificar no navegador**

Com Strapi + BFF + `pnpm dev`:
1. `/certificado?event=<slug de evento já encerrado com config enabled>` → digite um CPF válido sem certificado → aparece o form de solicitação → emita → card com preview e "Baixar PDF" baixa o arquivo.
2. Repita com o mesmo CPF → vai direto ao card (idempotência).
3. `/certificado/<code>` mostra o card; `/certificado/verificar/<code>` mostra "Certificado válido".
4. Desligue `allow_self_request` na config (via Strapi admin) → CPF desconhecido cai em "Participação não encontrada".
5. `/certificado` sem `?event` → "Evento não informado".

- [ ] **Step 7: Rodar testes e commit**

```bash
pnpm test
git add src/components/certificate src/app/certificado
git commit -m "feat: add public certificate lookup, download and verification pages"
```

---

### Task 12: Admin — aba "Modelo" com formulário e preview ao vivo

**Files:**
- Create: `src/components/admin/certificate-config-form.tsx`
- Modify: `src/app/admin/events/[id]/certificados/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `GET_CERTIFICATE_CONFIG`, `UPSERT_CERTIFICATE_CONFIG`, `COPY_CERTIFICATE_CONFIG`, `GET_EVENT_BY_SLUG_OR_ID` (Task 8), `CertificatePreview` (Task 11), `PLACEHOLDERS`, `DEFAULT_*`, `workloadHours` (Task 7), `ImageCropDialog` (existente), `/api/upload` (existente).
- Produces: `CertificateConfigForm({ eventId, event, initialConfig, onSaved })` e a página com `Tabs` (`modelo` agora; `emissao` na Task 16).

- [ ] **Step 1: Formulário**

`src/components/admin/certificate-config-form.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLazyQuery, useMutation } from '@apollo/client';
import * as z from 'zod';
import { Copy, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_TITLE,
  PLACEHOLDERS,
  workloadHours,
  type CertificateConfigLike,
  type CertificateEventInfo,
} from '@/lib/certificate';
import { COPY_CERTIFICATE_CONFIG, GET_EVENT_BY_SLUG_OR_ID, UPSERT_CERTIFICATE_CONFIG } from '@/lib/queries';
import type {
  CertificateConfig,
  CertificateConfigInput,
  CopyCertificateConfigResponse,
  EventResponse,
  UpsertCertificateConfigResponse,
} from '@/lib/types';

const CertificatePreview = dynamic(() => import('@/components/certificate/certificate-preview'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[420px]" />,
});

const MANAGER_URL = process.env.NEXT_PUBLIC_MANAGER_URL || 'https://manager.hubcommunity.io';

const mediaSchema = z.object({ id: z.string().nullable(), url: z.string().nullable() });
type MediaField = z.infer<typeof mediaSchema>;
const EMPTY_MEDIA: MediaField = { id: null, url: null };

const formSchema = z.object({
  enabled: z.boolean(),
  allow_self_request: z.boolean(),
  title: z.string().max(120),
  body_template: z.string().max(1000),
  workload_hours: z.string().regex(/^(\d+([.,]\d+)?)?$/, 'Use números, ex.: 8 ou 1,5'),
  issuer_name: z.string().max(80),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor em hexadecimal, ex.: #10B981'),
  logo: mediaSchema,
  background: mediaSchema,
  sponsors: z.array(
    z.object({
      name: z.string().min(1, 'Nome obrigatório'),
      url: z.string().optional(),
      logo: mediaSchema.refine((m) => Boolean(m.id), 'Logo obrigatório'),
    }),
  ),
  signatures: z
    .array(z.object({ name: z.string().min(1, 'Nome obrigatório'), role: z.string().optional(), image: mediaSchema }))
    .max(4, 'No máximo 4 assinaturas'),
});
type FormValues = z.infer<typeof formSchema>;

function toFormValues(config: CertificateConfig | null | undefined): FormValues {
  return {
    enabled: config?.enabled ?? false,
    allow_self_request: config?.allow_self_request ?? true,
    title: config?.title ?? '',
    body_template: config?.body_template ?? '',
    workload_hours: config?.workload_hours ? String(config.workload_hours).replace('.', ',') : '',
    issuer_name: config?.issuer_name ?? '',
    primary_color: config?.primary_color ?? DEFAULT_PRIMARY_COLOR,
    logo: { id: config?.logo_id ?? null, url: config?.logo ?? null },
    background: { id: config?.background_id ?? null, url: config?.background ?? null },
    sponsors: (config?.sponsors ?? []).map((s) => ({
      name: s.name,
      url: s.url ?? '',
      logo: { id: s.logo_id ?? null, url: s.logo ?? null },
    })),
    signatures: (config?.signatures ?? []).map((s) => ({
      name: s.name,
      role: s.role ?? '',
      image: { id: s.image_id ?? null, url: s.image ?? null },
    })),
  };
}

function parseHours(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toInput(values: FormValues): CertificateConfigInput {
  return {
    enabled: values.enabled,
    allow_self_request: values.allow_self_request,
    title: values.title,
    body_template: values.body_template,
    workload_hours: parseHours(values.workload_hours),
    issuer_name: values.issuer_name,
    primary_color: values.primary_color,
    logo: values.logo.id,
    background: values.background.id,
    sponsors: values.sponsors.map((s) => ({ name: s.name, url: s.url || undefined, logo: s.logo.id as string })),
    signatures: values.signatures.map((s) => ({ name: s.name, role: s.role || undefined, image: s.image.id })),
  };
}

function toPreviewConfig(values: FormValues): CertificateConfigLike {
  return {
    title: values.title,
    body_template: values.body_template,
    workload_hours: parseHours(values.workload_hours),
    issuer_name: values.issuer_name,
    primary_color: /^#[0-9a-fA-F]{6}$/.test(values.primary_color) ? values.primary_color : DEFAULT_PRIMARY_COLOR,
    logo: values.logo.url,
    background: values.background.url,
    sponsors: values.sponsors.map((s) => ({ name: s.name, url: s.url, logo: s.logo.url })),
    signatures: values.signatures.map((s) => ({ name: s.name, role: s.role, image: s.image.url })),
  };
}

async function uploadImage(file: File): Promise<MediaField> {
  const data = new FormData();
  data.append('files', file);
  const res = await fetch('/api/upload', { method: 'POST', body: data });
  if (!res.ok) throw new Error('Falha no upload da imagem.');
  const [uploaded] = await res.json();
  const url: string = uploaded.url.startsWith('http') ? uploaded.url : `${MANAGER_URL}${uploaded.url}`;
  return { id: String(uploaded.id), url };
}

// Small reusable image picker: shows the current image, uploads on change, clears on X.
function ImageField({ value, onChange, label, hint }: { value: MediaField; onChange: (m: MediaField) => void; label: string; hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload falhou', description: err instanceof Error ? err.message : 'Erro' });
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={label} className="h-14 w-24 object-contain rounded border bg-white" />
        ) : (
          <div className="h-14 w-24 rounded border border-dashed flex items-center justify-center text-muted-foreground">
            <ImagePlus className="w-5 h-5" />
          </div>
        )}
        <Input type="file" accept="image/*" className="max-w-xs" disabled={uploading} onChange={(e) => handleFile(e.target.files?.[0])} />
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {value.url ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(EMPTY_MEDIA)} aria-label="Remover imagem">
            <X className="w-4 h-4" />
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface CertificateConfigFormProps {
  eventId: string;
  event: CertificateEventInfo;
  initialConfig: CertificateConfig | null | undefined;
  onSaved: (config: CertificateConfig) => void;
}

export function CertificateConfigForm({ eventId, event, initialConfig, onSaved }: CertificateConfigFormProps) {
  const { toast } = useToast();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toFormValues(initialConfig) });
  const sponsors = useFieldArray({ control: form.control, name: 'sponsors' });
  const signatures = useFieldArray({ control: form.control, name: 'signatures' });

  useEffect(() => {
    form.reset(toFormValues(initialConfig));
  }, [initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const [upsert, { loading: saving }] = useMutation<UpsertCertificateConfigResponse>(UPSERT_CERTIFICATE_CONFIG);
  const [copyConfig, { loading: copying }] = useMutation<CopyCertificateConfigResponse>(COPY_CERTIFICATE_CONFIG);
  const [findSourceEvent] = useLazyQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID);
  const [copySource, setCopySource] = useState('');

  // Debounce a serialized snapshot: form.watch() may hand back a new object reference on
  // every render, and a string compares by value so the effect only fires on real changes.
  const watchedJson = JSON.stringify(form.watch());
  const debouncedJson = useDebounce(watchedJson, 500);
  const previewConfig = useMemo(() => toPreviewConfig(JSON.parse(debouncedJson) as FormValues), [debouncedJson]);
  const computedHours = workloadHours({ workload_hours: null }, event);

  const insertPlaceholder = (key: string) => {
    const el = document.getElementById('body_template') as HTMLTextAreaElement | null;
    const current = form.getValues('body_template');
    const pos = el?.selectionStart ?? current.length;
    const next = `${current.slice(0, pos)}{{${key}}}${current.slice(pos)}`;
    form.setValue('body_template', next, { shouldDirty: true });
    requestAnimationFrame(() => el?.focus());
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await upsert({ variables: { eventId, data: toInput(values) } });
      if (data?.upsertCertificateConfig) {
        onSaved(data.upsertCertificateConfig);
        toast({ title: 'Modelo salvo', description: 'O modelo do certificado foi atualizado.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Erro' });
    }
  };

  const handleCopy = async () => {
    if (!copySource.trim()) return;
    try {
      const { data } = await findSourceEvent({ variables: { slugOrId: copySource.trim() } });
      const fromEventId = data?.eventBySlugOrId?.documentId || data?.eventBySlugOrId?.id;
      if (!fromEventId) throw new Error('Evento de origem não encontrado.');
      const result = await copyConfig({ variables: { fromEventId, toEventId: eventId } });
      if (result.data?.copyCertificateConfig) {
        onSaved(result.data.copyCertificateConfig);
        toast({ title: 'Modelo copiado', description: `Copiado de "${data?.eventBySlugOrId?.title}". Revise e salve.` });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível copiar', description: err instanceof Error ? err.message : 'Erro' });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Certificados liberados</FormLabel>
                    <FormDescription>Permite que participantes busquem e baixem o certificado.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="allow_self_request" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Solicitação livre</FormLabel>
                    <FormDescription>Quem não está na lista de presença pode emitir informando os dados.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <div className="flex items-end gap-2 pt-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="copy-source">Copiar modelo de outro evento</Label>
                  <Input id="copy-source" placeholder="slug ou ID do evento" value={copySource} onChange={(e) => setCopySource(e.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={handleCopy} disabled={copying || !copySource.trim()}>
                  {copying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
              <CardDescription>Campos vazios usam o padrão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder={DEFAULT_TITLE} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="body_template" render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto do certificado</FormLabel>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {PLACEHOLDERS.map((p) => (
                      <Button key={p} type="button" size="sm" variant="secondary" className="h-7 text-xs font-mono" onClick={() => insertPlaceholder(p)}>
                        {`{{${p}}}`}
                      </Button>
                    ))}
                  </div>
                  <FormControl><Textarea id="body_template" rows={5} placeholder={DEFAULT_BODY_TEMPLATE} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="workload_hours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carga horária (h)</FormLabel>
                    <FormControl><Input placeholder={`${computedHours} (calculada)`} inputMode="decimal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="issuer_name" render={({ field }) => (
                  <FormItem><FormLabel>Emissor</FormLabel><FormControl><Input placeholder="Reactivando" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="primary_color" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor principal</FormLabel>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 p-1" value={field.value} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      <FormControl><Input {...field} /></FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="logo" render={({ field }) => (
                <ImageField label="Logo" value={field.value} onChange={field.onChange} hint="PNG com fundo transparente, até 200×60." />
              )} />
              <FormField control={form.control} name="background" render={({ field }) => (
                <ImageField label="Fundo (opcional)" value={field.value} onChange={field.onChange} hint="A4 paisagem (ex. 2480×1754). Sem fundo, o certificado usa branco." />
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Patrocinadores</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => sponsors.append({ name: '', url: '', logo: EMPTY_MEDIA })}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sponsors.fields.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum patrocinador.</p> : null}
              {sponsors.fields.map((item, index) => (
                <div key={item.id} className="rounded-lg border p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField control={form.control} name={`sponsors.${index}.name`} render={({ field }) => (
                      <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`sponsors.${index}.url`} render={({ field }) => (
                      <FormItem><FormLabel>Site (opcional)</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name={`sponsors.${index}.logo`} render={({ field }) => (
                    <FormItem>
                      <ImageField label="Logo" value={field.value} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => sponsors.remove(index)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remover
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Assinaturas</CardTitle>
              <Button type="button" size="sm" variant="outline" disabled={signatures.fields.length >= 4} onClick={() => signatures.append({ name: '', role: '', image: EMPTY_MEDIA })}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {signatures.fields.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma assinatura.</p> : null}
              {signatures.fields.map((item, index) => (
                <div key={item.id} className="rounded-lg border p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField control={form.control} name={`signatures.${index}.name`} render={({ field }) => (
                      <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`signatures.${index}.role`} render={({ field }) => (
                      <FormItem><FormLabel>Cargo (opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name={`signatures.${index}.image`} render={({ field }) => (
                    <ImageField label="Assinatura digitalizada (opcional)" value={field.value} onChange={field.onChange} hint="Sem imagem, o certificado mostra só a linha com nome e cargo." />
                  )} />
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => signatures.remove(index)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remover
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar modelo
          </Button>
        </form>
      </Form>

      <div className="xl:sticky xl:top-24 self-start space-y-2">
        <p className="text-sm text-muted-foreground">Pré-visualização (dados fictícios)</p>
        <CertificatePreview config={previewConfig} event={event} certificate={{ code: 'RCT-EXEMPLO1', name: 'Nome do Participante' }} height={420} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Página com abas**

Substitua `src/app/admin/events/[id]/certificados/page.tsx` inteiro:
```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { FadeIn } from '@/components/animations';
import { CertificateConfigForm } from '@/components/admin/certificate-config-form';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GET_CERTIFICATE_CONFIG, GET_EVENT_BY_SLUG_OR_ID } from '@/lib/queries';
import type { CertificateConfig, CertificateConfigResponse, EventResponse } from '@/lib/types';

export default function CertificadosAdminPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [tab, setTab] = useState('modelo');

  const { data: eventData, loading: eventLoading } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: id },
    skip: !id,
  });
  const event = eventData?.eventBySlugOrId;
  const eventId = event?.documentId || event?.id;

  const { data: configData, loading: configLoading, refetch } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
    fetchPolicy: 'network-only',
  });
  const [config, setConfig] = useState<CertificateConfig | null | undefined>(undefined);
  const effectiveConfig = config === undefined ? configData?.certificateConfig : config;

  if (eventLoading || configLoading || !event || !eventId) {
    return (
      <div className="container mx-auto py-10 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-7xl">
        <div className="flex items-center space-x-4 mb-8">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Certificados</h1>
            <p className="text-muted-foreground mt-1">{event.title}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="modelo">Modelo</TabsTrigger>
            <TabsTrigger value="emissao" disabled>Emissão (em breve)</TabsTrigger>
          </TabsList>
          <TabsContent value="modelo">
            <CertificateConfigForm
              eventId={eventId}
              event={event}
              initialConfig={effectiveConfig}
              onSaved={(saved) => {
                setConfig(saved);
                refetch();
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </FadeIn>
  );
}
```
(A aba "Emissão" é habilitada na Task 16.)

- [ ] **Step 3: Verificar no navegador**

Logado como admin, em `/admin/events/<slug>/certificados`:
1. Preview aparece à direita com "Nome do Participante" e o template padrão.
2. Digite no texto, clique num chip de placeholder — o texto recebe `{{...}}` na posição do cursor e o preview atualiza após ~0,5 s.
3. Suba um logo e um patrocinador → aparecem no preview (via `/api/og-image`).
4. Adicione 4 assinaturas → botão "Adicionar" desabilita.
5. Salve → toast "Modelo salvo"; recarregue a página → valores persistidos (incluindo imagens, sem novo upload).
6. "Copiar modelo de outro evento" com o slug de um evento que já tem modelo → form preenchido, `enabled` desligado.

- [ ] **Step 4: Testes e commit**

```bash
pnpm test
git add src/components/admin/certificate-config-form.tsx "src/app/admin/events/[id]/certificados/page.tsx"
git commit -m "feat: add admin certificate template editor with live preview"
```

---

# FASE 4 — BFF, emissão em lote (`hub-community-bff`)

### Task 13: Lógica pura — `candidates.js` (merge de inscritos, presenças e pedidos)

**Files:**
- Create: `src/resolvers/Certificate/candidates.js`
- Create: `src/resolvers/Certificate/candidates.test.js`

**Interfaces:**
- Consumes: `normalizeIdentifier` (Task 5).
- Produces:
  - `normalizeEmail(value): string`
  - `candidateKey({ identifier, email }): string | null` — CPF normalizado, senão e-mail minúsculo, senão `null`
  - `SOURCE_PRIORITY = { ATTENDANCE: 3, SIGNUP: 2, REQUEST: 1 }`
  - `buildCandidates({ signups, attendances, participants, certificates }): Candidate[]` onde `Candidate = { key, name, email, identifier, phone, sources: string[], checked_in: boolean, certificate: raw | null }`, ordenado por `name` (pt-BR, case-insensitive).

- [ ] **Step 1: Testes (falhando)**

`src/resolvers/Certificate/candidates.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildCandidates, candidateKey } from './candidates';

describe('candidateKey', () => {
  it('prefers cpf, falls back to email, else null', () => {
    expect(candidateKey({ identifier: '529.982.247-25', email: 'A@x.com' })).toBe('52998224725');
    expect(candidateKey({ identifier: '', email: ' A@X.com ' })).toBe('a@x.com');
    expect(candidateKey({})).toBeNull();
  });
});

describe('buildCandidates', () => {
  const signups = [
    { name: 'ana silva', email: 'ana@x.com', phone_number: '62999990000', cpf: '52998224725', checked_in: true },
    { name: 'Bruno', email: 'bruno@x.com', phone_number: null, checked_in: false },
    { name: 'Sem chave', email: '', cpf: '' },
  ];
  const attendances = [
    { users_permissions_user: { name: 'Ana Silva', email: 'ana.pessoal@x.com', phone: '62988880000', cpf: '529.982.247-25' } },
    { users_permissions_user: null },
  ];
  const participants = [
    { name: 'Carla', email: 'carla@x.com', identifier: '11144477735', phone_number: '62977770000' },
    { name: 'Bruno Lima', email: 'BRUNO@x.com', identifier: '', phone_number: '62966660000' },
  ];
  const certificates = [
    { code: 'RCT-AAAAAAAA', identifier: '11144477735', name: 'Carla' },
    { code: 'RCT-BBBBBBBB', identifier: '98765432100', name: 'Diego', email: 'diego@x.com', source: 'SELF_REQUEST' },
  ];

  const result = buildCandidates({ signups, attendances, participants, certificates });
  const byKey = Object.fromEntries(result.map((c) => [c.key, c]));

  it('dedupes by cpf and lets attendance data win', () => {
    const ana = byKey['52998224725'];
    expect(ana.sources).toEqual(['ATTENDANCE', 'SIGNUP']);
    expect(ana.name).toBe('Ana Silva');
    expect(ana.email).toBe('ana.pessoal@x.com');
    expect(ana.phone).toBe('62988880000');
    expect(ana.checked_in).toBe(true);
    expect(ana.certificate).toBeNull();
  });

  it('dedupes by email when there is no cpf and keeps the best name', () => {
    const bruno = byKey['bruno@x.com'];
    expect(bruno.sources).toEqual(['SIGNUP', 'REQUEST']);
    expect(bruno.name).toBe('Bruno');
    expect(bruno.identifier).toBe('');
    expect(bruno.phone).toBe('62966660000'); // signup had none, request fills the gap
    expect(bruno.checked_in).toBe(false);
  });

  it('drops rows without cpf or email', () => {
    expect(result.find((c) => c.name === 'Sem chave')).toBeUndefined();
  });

  it('attaches issued certificates by identifier', () => {
    expect(byKey['11144477735'].certificate.code).toBe('RCT-AAAAAAAA');
    expect(byKey['11144477735'].sources).toEqual(['REQUEST']);
  });

  it('includes certificates whose person is in no list', () => {
    const diego = byKey['98765432100'];
    expect(diego.sources).toEqual([]);
    expect(diego.name).toBe('Diego');
    expect(diego.certificate.code).toBe('RCT-BBBBBBBB');
  });

  it('sorts by name, case-insensitive', () => {
    expect(result.map((c) => c.name)).toEqual(['Ana Silva', 'Bruno', 'Carla', 'Diego']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
yarn test
```
Esperado: FAIL — `./candidates` não encontrado.

- [ ] **Step 3: Implementar**

`src/resolvers/Certificate/candidates.js`:
```js
// Merges the three "who was there" sources into one deduplicated list. Pure — no I/O.
import { normalizeIdentifier } from './eligibility';

export const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export const candidateKey = ({ identifier, email } = {}) =>
  normalizeIdentifier(identifier) || normalizeEmail(email) || null;

export const SOURCE_PRIORITY = { ATTENDANCE: 3, SIGNUP: 2, REQUEST: 1 };

const fromSignup = (s) => ({
  source: 'SIGNUP',
  name: s.name || '',
  email: normalizeEmail(s.email),
  identifier: normalizeIdentifier(s.cpf || s.identifier),
  phone: s.phone_number || '',
  checked_in: Boolean(s.checked_in),
});

const fromAttendance = (a) => {
  const u = a?.users_permissions_user;
  if (!u) return null;
  return {
    source: 'ATTENDANCE',
    name: u.name || u.username || '',
    email: normalizeEmail(u.email),
    identifier: normalizeIdentifier(u.cpf),
    phone: u.phone || '',
    checked_in: false,
  };
};

const fromParticipant = (p) => ({
  source: 'REQUEST',
  name: p.name || '',
  email: normalizeEmail(p.email),
  identifier: normalizeIdentifier(p.identifier),
  phone: p.phone_number || '',
  checked_in: false,
});

// Higher-priority source wins for name/email/phone; empty values never overwrite filled ones.
const merge = (existing, row) => {
  const incomingWins = SOURCE_PRIORITY[row.source] > SOURCE_PRIORITY[existing.topSource];
  const pick = (field) => {
    if (incomingWins) return row[field] || existing[field];
    return existing[field] || row[field];
  };
  return {
    ...existing,
    name: pick('name'),
    email: pick('email'),
    phone: pick('phone'),
    identifier: existing.identifier || row.identifier,
    checked_in: existing.checked_in || row.checked_in,
    sources: existing.sources.includes(row.source) ? existing.sources : [...existing.sources, row.source],
    topSource: incomingWins ? row.source : existing.topSource,
  };
};

export const buildCandidates = ({ signups = [], attendances = [], participants = [], certificates = [] }) => {
  const rows = [
    ...attendances.map(fromAttendance).filter(Boolean),
    ...signups.map(fromSignup),
    ...participants.map(fromParticipant),
  ];

  const byKey = new Map();
  rows.forEach((row) => {
    const key = candidateKey(row);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? merge(existing, row) : { key, ...row, sources: [row.source], topSource: row.source });
  });

  const certByIdentifier = new Map(
    certificates.filter((c) => c.identifier).map((c) => [normalizeIdentifier(c.identifier), c]),
  );

  const candidates = [...byKey.values()].map((c) => ({
    key: c.key,
    name: c.name,
    email: c.email,
    identifier: c.identifier,
    phone: c.phone,
    sources: [...c.sources].sort((a, b) => SOURCE_PRIORITY[b] - SOURCE_PRIORITY[a]),
    checked_in: c.checked_in,
    certificate: certByIdentifier.get(c.identifier) || null,
  }));

  const seenIdentifiers = new Set(candidates.map((c) => c.identifier).filter(Boolean));
  certificates.forEach((cert) => {
    const id = normalizeIdentifier(cert.identifier);
    if (!id || seenIdentifiers.has(id)) return;
    candidates.push({
      key: id,
      name: cert.name || '',
      email: normalizeEmail(cert.email),
      identifier: id,
      phone: '',
      sources: [],
      checked_in: false,
      certificate: cert,
    });
  });

  return candidates.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
};
```

- [ ] **Step 4: Rodar e ver passar**

```bash
yarn test
```
Esperado: todos PASS (candidates 7).

- [ ] **Step 5: Commit**

```bash
git add src/resolvers/Certificate/candidates.js src/resolvers/Certificate/candidates.test.js
git commit -m "feat: add certificate candidate merge logic with tests"
```

---

### Task 14: GraphQL — `certificateCandidates`, `issueCertificates` e e-mail

**Files:**
- Create: `src/services/email/templates/certificate-issued.js`
- Create: `src/resolvers/Certificate/email.js`
- Modify: `src/types/Certificate.graphql` (append)
- Modify: `src/resolvers/Certificate/index.js` (novos resolvers)
- Modify: `GRAPHQL_USAGE.md` (append)

**Interfaces:**
- Consumes: `buildCandidates` (Task 13); `requireUser`, `loadEventAndConfig` (Task 6); data source (Task 4); `sendEmail` (existente).
- Produces:
  - `certificateIssuedTemplate({ userName, eventTitle, certificateUrl, verifyUrl, baseUrl }): string`
  - `sendCertificateEmail({ certificate, event, baseUrl }): Promise<{ success, error? }>`
  - GraphQL: `certificateCandidates(eventId)`, `issueCertificates(eventId, entries, actions)` conforme spec §2.

- [ ] **Step 1: Template de e-mail**

`src/services/email/templates/certificate-issued.js`:
```js
/**
 * E-mail sent when a certificate is issued or re-sent.
 *
 * @param {Object} params
 * @param {string} params.userName
 * @param {string} params.eventTitle
 * @param {string} params.certificateUrl - page with preview + download
 * @param {string} params.verifyUrl - public verification page
 * @param {string} params.baseUrl
 */
export const certificateIssuedTemplate = ({
  userName,
  eventTitle,
  certificateUrl,
  verifyUrl,
  baseUrl = 'https://hubcommunity.io',
}) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu certificado — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1117;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:24px 0 32px;">
              <a href="${baseUrl}" style="font-size:24px;font-weight:700;color:#22c55e;letter-spacing:-0.5px;text-decoration:none;">🌐 Hub Community</a>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d37;">
                <tr>
                  <td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 24px;text-align:center;">
                    <div style="width:64px;height:64px;background-color:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:32px;">🎓</div>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Seu certificado está pronto!</h1>
                    <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);">Olá <strong>${userName}</strong>, obrigado por participar.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;">${eventTitle}</h2>
                    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#b0b0b0;">
                      Seu certificado de participação foi emitido. Clique abaixo para visualizar e baixar o PDF.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <a href="${certificateUrl}" style="display:inline-block;padding:14px 32px;background-color:#22c55e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:50px;">Baixar certificado →</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#888;text-align:center;">
                      Autenticidade: <a href="${verifyUrl}" style="color:#22c55e;">${verifyUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#666;">Você recebeu este e-mail porque participou do evento <strong style="color:#888;">${eventTitle}</strong>.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#555;">© ${new Date().getFullYear()} Hub Community. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
```

- [ ] **Step 2: `email.js`**

`src/resolvers/Certificate/email.js`:
```js
import { sendEmail } from '../../services/email';
import { certificateIssuedTemplate } from '../../services/email/templates/certificate-issued';

export const sendCertificateEmail = async ({ certificate, event, baseUrl }) => {
  const base = baseUrl || process.env.FRONTEND_URL || 'https://hubcommunity.io';
  const html = certificateIssuedTemplate({
    userName: certificate.name,
    eventTitle: event.title,
    certificateUrl: `${base}/certificado/${certificate.code}`,
    verifyUrl: `${base}/certificado/verificar/${certificate.code}`,
    baseUrl: base,
  });
  return sendEmail({
    to: certificate.email,
    subject: `🎓 Seu certificado — ${event.title}`,
    html,
  });
};
```

- [ ] **Step 3: Schema GraphQL (append em `src/types/Certificate.graphql`)**

```graphql
enum CandidateSource {
  SIGNUP
  ATTENDANCE
  REQUEST
}

type CertificateCandidate {
  key: String!
  name: String!
  email: String
  identifier: String
  phone: String
  sources: [CandidateSource!]!
  checked_in: Boolean
  certificate: Certificate
}

input IssueEntryInput {
  name: String!
  identifier: String!
  email: String!
}

input IssueActionsInput {
  register: Boolean!
  email: Boolean!
}

type IssueResult {
  issued: Int!
  emailed: Int!
  certificates: [Certificate!]!
  errors: [String!]!
}

extend type Query {
  certificateCandidates(eventId: String!): [CertificateCandidate!]!
}

extend type Mutation {
  issueCertificates(eventId: String!, entries: [IssueEntryInput!]!, actions: IssueActionsInput!): IssueResult!
}
```
Nota: os arquivos `.graphql` são concatenados; `type Query` já foi declarado neste arquivo, por isso `extend`.

- [ ] **Step 4: Resolvers (em `src/resolvers/Certificate/index.js`)**

Adicione os imports:
```js
import { buildCandidates } from './candidates';
import { sendCertificateEmail } from './email';
```

Adicione a função auxiliar antes de `const Certificate = {`:
```js
const BATCH_SIZE = 10;

// Signups live in Eventando Manager, keyed by the hub event's slug.
const loadEventandoSignups = async (dataSources, event) => {
  if (!event?.slug) return [];
  try {
    const response = await dataSources.eventandoIntegration.findEvents({
      filters: { or: [{ slug: { eq: event.slug } }, { uuid: { eq: event.slug } }] },
    });
    const eventandoEvent = response?.data?.[0];
    if (!eventandoEvent) return [];
    return dataSources.eventandoIntegration.findSignupsByEvent(eventandoEvent.id);
  } catch (err) {
    console.error('[certificates] Eventando unreachable, ignoring signups:', err.message);
    return [];
  }
};

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};
```

Em `Query`, adicione:
```js
    certificateCandidates: async (_, { eventId }, { user, dataSources }) => {
      requireUser(user);
      const { event } = await loadEventAndConfig(dataSources, eventId);
      const [signups, attendances, participants, certificates] = await Promise.all([
        loadEventandoSignups(dataSources, event),
        dataSources.managerIntegration.findAttendancesByEvent(eventId),
        dataSources.managerIntegration.findParticipantsByEvent(eventId),
        dataSources.managerIntegration.findCertificatesByEvent(eventId),
      ]);
      return buildCandidates({ signups, attendances, participants, certificates }).map((c) => ({
        ...c,
        certificate: mapCertificate(c.certificate ? { ...c.certificate, event } : null),
      }));
    },
```

Em `Mutation`, adicione:
```js
    issueCertificates: async (_, { eventId, entries, actions }, { user, dataSources }) => {
      requireUser(user);
      if (actions.email && !actions.register) {
        throw new Error('Enviar e-mail exige registrar o certificado.');
      }
      if (!actions.register) {
        return { issued: 0, emailed: 0, certificates: [], errors: [] };
      }

      const { event } = await loadEventAndConfig(dataSources, eventId);
      const result = { issued: 0, emailed: 0, certificates: [], errors: [] };

      const issueOne = async (entry) => {
        const cpf = normalizeIdentifier(entry.identifier);
        const label = entry.name || entry.email || cpf;
        if (!isValidCpf(cpf)) throw new Error(`${label}: CPF inválido`);
        if (!entry.email?.trim()) throw new Error(`${label}: e-mail obrigatório`);

        const created = await dataSources.managerIntegration.createCertificate({
          event: eventId,
          name: entry.name.trim(),
          identifier: cpf,
          email: entry.email.trim().toLowerCase(),
          source: 'ADMIN',
        });
        let certificate = created?.data;
        result.issued += 1;

        if (actions.email) {
          const sent = await sendCertificateEmail({ certificate, event });
          if (!sent.success) throw new Error(`${label}: falha ao enviar e-mail (${sent.error})`);
          const updated = await dataSources.managerIntegration.updateCertificate(certificate.documentId, {
            sent_at: new Date().toISOString(),
          });
          certificate = updated?.data || certificate;
          result.emailed += 1;
        }
        result.certificates.push(mapCertificate({ ...certificate, event }));
      };

      for (const batch of chunk(entries, BATCH_SIZE)) {
        const settled = await Promise.allSettled(batch.map(issueOne));
        settled.forEach((s) => {
          if (s.status === 'rejected') result.errors.push(s.reason?.message || String(s.reason));
        });
      }
      return result;
    },
```

- [ ] **Step 5: Verificar no GraphQL**

`yarn dev`, com header `authorization` de admin:
```graphql
query { certificateCandidates(eventId: "EV") { key name email identifier sources checked_in certificate { code sent_at } } }
```
Esperado: lista com inscritos do Eventando + presenças + pedidos legados, sem duplicar quem aparece em mais de uma fonte; quem já tem certificado vem com `certificate.code`.

```graphql
mutation { issueCertificates(eventId: "EV",
  entries: [{ name: "Ana Souza", identifier: "529.982.247-25", email: "<seu e-mail>" }, { name: "X", identifier: "123", email: "x@x.com" }],
  actions: { register: true, email: true }) { issued emailed errors certificates { code sent_at } } }
```
Esperado: `issued: 1`, `emailed: 1`, `errors: ["X: CPF inválido"]`, e-mail recebido com link `/certificado/<code>` funcionando. Rodar de novo devolve o mesmo `code` (idempotente) e reenvia o e-mail.

- [ ] **Step 6: Documentar em `GRAPHQL_USAGE.md`**

Adicione uma seção "Certificados" listando as queries (`certificateConfig`, `certificateByCode`, `lookupCertificate`, `certificateCandidates`) e mutations (`upsertCertificateConfig`, `copyCertificateConfig`, `requestCertificate`, `issueCertificates`) com um exemplo de cada, copiando os exemplos dos Steps 3 (Task 6) e 5 (esta Task). Marque quais exigem autenticação.

- [ ] **Step 7: Testes e commit**

```bash
yarn test
git add src/types/Certificate.graphql src/resolvers/Certificate src/services/email/templates/certificate-issued.js GRAPHQL_USAGE.md
git commit -m "feat: add certificate candidates query, batch issuing and e-mail notification"
```

---

# FASE 5 — Frontend, emissão em lote (`hub-community-frontend`)

### Task 15: Rota ZIP + queries/tipos de emissão

**Files:**
- Create: `src/app/api/certificates/zip/route.ts`
- Modify: `src/lib/types.ts` (append)
- Modify: `src/lib/queries.ts` (append)

**Interfaces:**
- Consumes: `fetchCertificateBundle`, `renderCertificatePdf` (Task 10), `certificateFileName` (Task 7).
- Produces:
  - HTTP `POST /api/certificates/zip` body `{ codes: string[] }`, header `Authorization: Bearer <auth_token>` → `application/zip` (200); 400 sem códigos ou > 500; 401 sem header; 502 se algum render falhar (com `{ error, code }`).
  - Types: `CandidateSource`, `CertificateCandidate`, `CertificateCandidatesResponse`, `IssueEntryInput`, `IssueActionsInput`, `IssueResult`, `IssueCertificatesResponse`.
  - Queries: `GET_CERTIFICATE_CANDIDATES`, `ISSUE_CERTIFICATES`.

- [ ] **Step 1: Types (append em `src/lib/types.ts`)**

```ts
export type CandidateSource = 'SIGNUP' | 'ATTENDANCE' | 'REQUEST';

export interface CertificateCandidate {
  key: string;
  name: string;
  email?: string | null;
  identifier?: string | null;
  phone?: string | null;
  sources: CandidateSource[];
  checked_in?: boolean | null;
  certificate?: Certificate | null;
}

export interface CertificateCandidatesResponse { certificateCandidates: CertificateCandidate[] }

export interface IssueEntryInput { name: string; identifier: string; email: string }
export interface IssueActionsInput { register: boolean; email: boolean }

export interface IssueResult {
  issued: number;
  emailed: number;
  certificates: Certificate[];
  errors: string[];
}

export interface IssueCertificatesResponse { issueCertificates: IssueResult }
```

- [ ] **Step 2: Queries (append em `src/lib/queries.ts`)**

```ts
export const GET_CERTIFICATE_CANDIDATES = gql`
  query GetCertificateCandidates($eventId: String!) {
    certificateCandidates(eventId: $eventId) {
      key
      name
      email
      identifier
      phone
      sources
      checked_in
      certificate {
        id
        code
        name
        source
        issued_at
        sent_at
      }
    }
  }
`;

export const ISSUE_CERTIFICATES = gql`
  mutation IssueCertificates($eventId: String!, $entries: [IssueEntryInput!]!, $actions: IssueActionsInput!) {
    issueCertificates(eventId: $eventId, entries: $entries, actions: $actions) {
      issued
      emailed
      errors
      certificates {
        code
        identifier
        sent_at
      }
    }
  }
`;
```

- [ ] **Step 3: Rota ZIP**

`src/app/api/certificates/zip/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { fetchCertificateBundle, renderCertificatePdf } from '@/lib/certificate-server';
import { certificateFileName } from '@/lib/certificate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CODES = 500;

/**
 * POST { codes: string[] } -> ZIP with one PDF per certificate.
 * Requires the admin's Authorization header (presence only: each code is unguessable
 * and already public via /certificado/[code]).
 */
export async function POST(request: NextRequest) {
  if (!request.headers.get('authorization')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let codes: string[] = [];
  try {
    const body = await request.json();
    codes = Array.isArray(body?.codes) ? body.codes.map((c: unknown) => String(c).toUpperCase()) : [];
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (codes.length === 0 || codes.length > MAX_CODES) {
    return NextResponse.json({ error: `Informe entre 1 e ${MAX_CODES} códigos` }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const code of codes) {
    try {
      const bundle = await fetchCertificateBundle(code);
      if (!bundle) continue; // revoked or unknown: skip, the UI already filtered
      const pdf = await renderCertificatePdf(bundle, baseUrl);
      let name = certificateFileName(bundle.event, bundle.certificate.name);
      if (usedNames.has(name)) name = name.replace(/\.pdf$/, `-${code}.pdf`);
      usedNames.add(name);
      zip.file(name, pdf);
    } catch (error: any) {
      console.error(`ZIP render error for ${code}:`, error);
      return NextResponse.json({ error: `Falha ao gerar o certificado ${code}`, code }, { status: 502 });
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="certificados.zip"',
      'Cache-Control': 'private, no-store',
    },
  });
}
```

- [ ] **Step 4: Verificar**

```bash
curl -s -o /tmp/certs.zip -w "%{http_code}\n" -X POST http://localhost:3000/api/certificates/zip \
  -H "Authorization: Bearer x" -H "Content-Type: application/json" \
  -d '{"codes":["<code1>","<code2>"]}'
unzip -l /tmp/certs.zip
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/certificates/zip -H "Content-Type: application/json" -d '{"codes":["A"]}'
```
Esperado: `200` e dois PDFs listados; sem header → `401`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/certificates/zip/route.ts src/lib/types.ts src/lib/queries.ts
git commit -m "feat: add certificate ZIP export route and batch issuing operations"
```

---

### Task 16: Admin — aba "Emissão"

**Files:**
- Create: `src/components/admin/certificate-issue-table.tsx`
- Modify: `src/app/admin/events/[id]/certificados/page.tsx` (habilitar a aba)

**Interfaces:**
- Consumes: `GET_CERTIFICATE_CANDIDATES`, `ISSUE_CERTIFICATES` (Task 15), rota ZIP (Task 15), `formatCpf`, `isValidCpf`, `normalizeIdentifier`, `formatDate` (Task 7).
- Produces: `CertificateIssueTable({ eventId, eventSlug })`.

- [ ] **Step 1: Componente da tabela**

`src/components/admin/certificate-issue-table.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle, Download, Loader2, Mail, Pencil, RefreshCw, Send } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { formatCpf, formatDate, isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import { GET_CERTIFICATE_CANDIDATES, ISSUE_CERTIFICATES } from '@/lib/queries';
import type { CandidateSource, CertificateCandidate, CertificateCandidatesResponse, IssueCertificatesResponse } from '@/lib/types';

const SOURCE_LABEL: Record<CandidateSource, string> = { SIGNUP: 'Inscrito', ATTENDANCE: 'Presença', REQUEST: 'Solicitação' };
type StatusFilter = 'all' | 'pending' | 'issued' | 'sent';
const ZIP_BATCH = 500;

interface RowEdit { name?: string; identifier?: string }
interface IssueOptions { register: boolean; email: boolean; zip: boolean }

interface Props {
  eventId: string;
  eventSlug: string;
}

export function CertificateIssueTable({ eventId, eventSlug }: Props) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<CertificateCandidatesResponse>(GET_CERTIFICATE_CANDIDATES, {
    variables: { eventId },
    fetchPolicy: 'network-only',
  });
  const [issue, { loading: issuing }] = useMutation<IssueCertificatesResponse>(ISSUE_CERTIFICATES);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | CandidateSource>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actions, setActions] = useState<IssueOptions>({ register: true, email: false, zip: false });
  const [zipping, setZipping] = useState(false);

  const candidates = data?.certificateCandidates ?? [];

  const effective = (c: CertificateCandidate) => ({
    name: edits[c.key]?.name ?? c.name,
    identifier: normalizeIdentifier(edits[c.key]?.identifier ?? c.identifier ?? ''),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const name = (edits[c.key]?.name ?? c.name).toLowerCase();
      if (term && !name.includes(term) && !(c.email || '').includes(term)) return false;
      if (sourceFilter !== 'all' && !c.sources.includes(sourceFilter)) return false;
      if (statusFilter === 'pending' && c.certificate) return false;
      if (statusFilter === 'issued' && !c.certificate) return false;
      if (statusFilter === 'sent' && !c.certificate?.sent_at) return false;
      return true;
    });
  }, [candidates, search, sourceFilter, statusFilter, edits]);

  const canIssue = (c: CertificateCandidate) => isValidCpf(effective(c).identifier) && Boolean(c.email);
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.key));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach((c) => next.delete(c.key));
    else filtered.forEach((c) => (canIssue(c) || c.certificate) && next.add(c.key));
    setSelected(next);
  };
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const setEdit = (key: string, patch: RowEdit) => setEdits({ ...edits, [key]: { ...edits[key], ...patch } });

  const downloadZip = async (codes: string[]) => {
    if (codes.length === 0) return;
    setZipping(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      for (let i = 0; i < codes.length; i += ZIP_BATCH) {
        const res = await fetch('/api/certificates/zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ codes: codes.slice(i, i + ZIP_BATCH) }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao gerar o ZIP');
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = codes.length > ZIP_BATCH ? `certificados-${eventSlug}-${i / ZIP_BATCH + 1}.zip` : `certificados-${eventSlug}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'ZIP falhou', description: err instanceof Error ? err.message : 'Erro' });
    } finally {
      setZipping(false);
    }
  };

  const runIssue = async (targets: CertificateCandidate[], opts: IssueOptions) => {
    const entries = targets.map((c) => ({ ...effective(c), email: (c.email || '').trim() }));
    try {
      const { data: res } = await issue({ variables: { eventId, entries, actions: { register: opts.register, email: opts.email } } });
      const result = res?.issueCertificates;
      if (!result) return;

      // BFF error strings start with the entry's name — map them back to rows.
      const nextErrors: Record<string, string> = {};
      result.errors.forEach((msg) => {
        const hit = targets.find((c) => msg.startsWith(effective(c).name));
        if (hit) nextErrors[hit.key] = msg;
      });
      setRowErrors(nextErrors);

      toast({
        title: 'Emissão concluída',
        description: `${result.issued} registrado(s), ${result.emailed} e-mail(s) enviado(s)${result.errors.length ? `, ${result.errors.length} erro(s)` : ''}.`,
        variant: result.errors.length ? 'destructive' : undefined,
      });

      if (opts.zip) await downloadZip(result.certificates.map((c) => c.code));
      setSelected(new Set());
      await refetch();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro na emissão', description: err instanceof Error ? err.message : 'Erro' });
    }
  };

  const confirmIssue = async () => {
    setDialogOpen(false);
    const targets = candidates.filter((c) => selected.has(c.key));
    if (!actions.register) {
      // ZIP only: include the rows that already have a certificate.
      const codes = targets.map((c) => c.certificate?.code).filter((code): code is string => Boolean(code));
      await downloadZip(codes);
      return;
    }
    await runIssue(targets.filter(canIssue), actions);
  };

  const exportXlsx = () => {
    const rows = filtered.map((c) => ({
      Nome: effective(c).name,
      CPF: formatCpf(effective(c).identifier),
      'E-mail': c.email || '',
      WhatsApp: c.phone || '',
      Origem: c.sources.map((s) => SOURCE_LABEL[s]).join(', '),
      'Check-in': c.checked_in ? 'Sim' : 'Não',
      Código: c.certificate?.code || '',
      'Emitido em': c.certificate?.issued_at ? formatDate(c.certificate.issued_at) : '',
      'Enviado em': c.certificate?.sent_at ? formatDate(c.certificate.sent_at) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
    XLSX.writeFile(wb, `certificados-${eventSlug}.xlsx`);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">{error.message}</div>;

  const selectedCount = selected.size;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <CardTitle>Participantes ({candidates.length})</CardTitle>
              <CardDescription>Inscritos, presenças e solicitações, sem duplicar. Selecione e emita.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}><Download className="w-4 h-4 mr-2" />XLSX</Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | CandidateSource)}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="SIGNUP">Inscritos</SelectItem>
                <SelectItem value="ATTENDANCE">Presença</SelectItem>
                <SelectItem value="REQUEST">Solicitação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Não emitidos</SelectItem>
                <SelectItem value="issued">Emitidos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" /></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum participante.</TableCell></TableRow>
                ) : filtered.map((c) => {
                  const eff = effective(c);
                  const editable = !c.certificate;
                  const cpfInvalid = Boolean(eff.identifier) && !isValidCpf(eff.identifier);
                  return (
                    <TableRow key={c.key} className={rowErrors[c.key] ? 'bg-destructive/5' : undefined}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.key)} disabled={!canIssue(c) && !c.certificate} onCheckedChange={() => toggle(c.key)} aria-label={`Selecionar ${eff.name}`} />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {editable ? (
                          <Input value={eff.name} className="h-8 min-w-48" onChange={(e) => setEdit(c.key, { name: e.target.value })} />
                        ) : eff.name}
                        {eff.name !== c.name ? <div className="text-xs text-muted-foreground">{c.name}</div> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {editable ? (
                          <Input value={formatCpf(eff.identifier)} placeholder="CPF obrigatório" className={`h-8 w-36 ${cpfInvalid ? 'border-destructive' : ''}`} onChange={(e) => setEdit(c.key, { identifier: e.target.value })} />
                        ) : formatCpf(eff.identifier)}
                      </TableCell>
                      <TableCell>{c.email || <span className="text-destructive text-xs">sem e-mail</span>}</TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {c.sources.map((s) => <Badge key={s} variant="secondary">{SOURCE_LABEL[s]}</Badge>)}
                        {c.sources.length === 0 ? <Badge variant="outline">Auto-atendimento</Badge> : null}
                      </TableCell>
                      <TableCell>{c.checked_in ? 'Sim' : '-'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {!c.certificate ? <span className="text-muted-foreground">Não emitido</span>
                          : c.certificate.sent_at ? <span className="text-green-600">Enviado {formatDate(c.certificate.sent_at)}</span>
                          : <span>Emitido {c.certificate.issued_at ? formatDate(c.certificate.issued_at) : ''}</span>}
                      </TableCell>
                      <TableCell>
                        {rowErrors[c.key] ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => runIssue([c], { register: true, email: true, zip: false })} aria-label="Tentar de novo" disabled={issuing}>
                                <AlertTriangle className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{rowErrors[c.key]}. Clique para tentar de novo.</TooltipContent>
                          </Tooltip>
                        ) : c.certificate ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => runIssue([c], { register: true, email: true, zip: false })} aria-label="Reenviar e-mail" disabled={issuing}>
                                <Mail className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reenviar e-mail</TooltipContent>
                          </Tooltip>
                        ) : <Pencil className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 ? (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-lg border bg-background p-3 shadow-lg">
          <span className="text-sm">{selectedCount} selecionado(s)</span>
          <Button onClick={() => setDialogOpen(true)} disabled={issuing || zipping}>
            {issuing || zipping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Emitir
          </Button>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir {selectedCount} certificado(s)</DialogTitle>
            <DialogDescription>Escolha o que fazer com os selecionados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.register} onCheckedChange={(v) => setActions({ ...actions, register: Boolean(v), email: Boolean(v) && actions.email })} />
              <div><Label>Registrar</Label><p className="text-xs text-muted-foreground">Cria o certificado (idempotente: quem já tem mantém o mesmo código).</p></div>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.email} onCheckedChange={(v) => setActions({ ...actions, email: Boolean(v), register: actions.register || Boolean(v) })} />
              <div><Label>Enviar e-mail</Label><p className="text-xs text-muted-foreground">Link para baixar. Reenvia para quem já recebeu.</p></div>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.zip} onCheckedChange={(v) => setActions({ ...actions, zip: Boolean(v) })} />
              <div><Label>Baixar ZIP</Label><p className="text-xs text-muted-foreground">Um PDF por pessoa. Sem "Registrar", só inclui quem já tem certificado.</p></div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmIssue} disabled={!actions.register && !actions.zip}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Habilitar a aba na página**

Em `src/app/admin/events/[id]/certificados/page.tsx`:
```tsx
import { CertificateIssueTable } from '@/components/admin/certificate-issue-table';
// ...
            <TabsTrigger value="emissao">Emissão</TabsTrigger>
// ...
          <TabsContent value="emissao">
            <CertificateIssueTable eventId={eventId} eventSlug={event.slug || eventId} />
          </TabsContent>
```
(Remova o `disabled` e o texto "(em breve)".)

- [ ] **Step 3: Verificar no navegador**

Em `/admin/events/<slug>/certificados`, aba Emissão:
1. Tabela lista inscritos + presenças + solicitações; uma pessoa em duas fontes aparece uma vez com dois badges.
2. Linha sem CPF: checkbox desabilitado até digitar um CPF válido no campo inline.
3. Edite um nome antes de emitir; o original aparece em cinza abaixo.
4. Selecione 3, **Emitir**, marque Registrar + E-mail + ZIP, confirme: toast com contagens, ZIP baixado com 3 PDFs, e-mails recebidos, status muda para "Enviado".
5. Selecione linhas já emitidas, desmarque Registrar, marque só ZIP: baixa o ZIP sem chamar a mutation.
6. Provoque um erro (e-mail inválido via Strapi admin): ícone de alerta na linha com tooltip; clique tenta de novo.
7. Filtro "Não emitidos" + "selecionar todos" seleciona só quem pode ser emitido.
8. XLSX exporta as colunas com Código/Emitido/Enviado.

- [ ] **Step 4: Testes, build e commit**

```bash
pnpm test
pnpm build
git add src/components/admin/certificate-issue-table.tsx "src/app/admin/events/[id]/certificados/page.tsx"
git commit -m "feat: add admin certificate issuing tab with e-mail and ZIP export"
```

---

## Checklist final (após a Task 16)

- [ ] Nos três repos: suíte de testes verde e branch `feat/certificados` com commits por tarefa.
- [ ] Fluxo ponta a ponta: configurar modelo, emitir pelo admin com e-mail, abrir link do e-mail, baixar PDF, ler o QR e cair na verificação.
- [ ] Fluxo público: `/certificado?event=` com CPF de quem assinou presença emite automaticamente (`source: ATTENDANCE`).
- [ ] Alterar o modelo após emissão: baixar de novo o mesmo código reflete o modelo novo (render on-demand).
- [ ] Revogar um certificado no Strapi admin (delete = `revoked_at`): verificação mostra "Revogado", rota PDF responde 404.
- [ ] Abrir PRs nos três repos, nesta ordem: backend, BFF, frontend (o frontend depende dos outros dois em produção).

# Certificado de participação em eventos

**Data:** 2026-09-11
**Status:** Aprovado, pronto para planejamento de implementação
**Repositórios:** `hub-community-backend` (Strapi), `hub-community-bff` (GraphQL),
`hub-community-frontend` (Next.js). A spec vive aqui por ser o repositório que já guarda
specs; as mudanças dos outros dois são descritas nas seções próprias.

## Problema

Hoje "certificado" é só uma fila de pedidos. A página pública `/certificado?event=<id>`
grava nome/CPF/e-mail/WhatsApp em `api::participant` chamando o Strapi direto (fora do BFF),
e a página `admin/events/[id]/certificados` lista esses pedidos e exporta XLSX. Ninguém gera
o certificado: alguém monta à mão, fora do sistema, a partir da planilha, para cada evento.

Não existe modelo, não existe código de verificação, e nada relaciona o pedido à presença
real (`api::attendance`) nem à inscrição (signups do Eventando Manager).

## Objetivos

- Modelo padrão de certificado, configurável por evento: texto, carga horária, cores, logo,
  fundo, **patrocinadores** e **assinaturas**.
- Auto-atendimento: quem participou baixa o próprio PDF sem depender da organização.
- Painel admin para emitir em lote a partir dos inscritos, com três ações escolhidas na hora:
  registrar, enviar por e-mail, baixar ZIP.
- Cada certificado tem código único e página pública de verificação (QR no PDF).
- O mesmo componente renderiza o PDF no browser (preview/download) e no servidor (e-mail/ZIP).

## Não-objetivos

- Editor de layout livre (drag & drop). O layout é fixo; só o conteúdo dos slots muda.
- Biblioteca de modelos por comunidade. A config é por evento, com "copiar de outro evento".
- Snapshot do PDF gerado. O PDF é renderizado on-demand a partir do registro + config atuais.
- RBAC no BFF. Rotas admin exigem usuário autenticado, mesmo critério das demais rotas admin.
- Certificado por palestra ou para palestrantes.
- Elegibilidade automática por check-in do Eventando. O check-in ainda tem casos manuais que
  não ficam registrados; ele aparece na tabela admin como informação, não como regra.

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Quem é elegível | Presença (`attendance`) automática **ou** solicitação livre (configurável) **ou** emissão pelo admin | Cobre o evento com lista de presença digital e o evento onde só a organização sabe quem foi |
| Onde o PDF é gerado | `@react-pdf/renderer`, um componente, browser e Node | PDF vetorial, sem headless browser, mesmo código em todo lugar |
| Escopo da config | Por evento + copiar de evento anterior | Sem CRUD de biblioteca de modelos |
| E-mail | Link para a página do certificado, sem anexo | Link continua válido se o modelo for ajustado; SMTP leve |

## Design

### 1. Modelo de dados — `hub-community-backend`

Novos components em `src/components/certificate/`:

```
sponsor.json    name (string, required) · logo (media imagem, required) · url (string)
signature.json  name (string, required) · role (string) · image (media imagem, opcional)
```

Assinatura sem `image` renderiza linha + nome + cargo.

**`api::certificate-config.certificate-config`** — uma por evento.

| campo | tipo | nota |
|---|---|---|
| `event` | oneToOne → `api::event.event`, `inversedBy: certificate_config` | |
| `enabled` | boolean, default `false` | liga o auto-atendimento público |
| `allow_self_request` | boolean, default `true` | permite solicitação livre |
| `title` | string | default "Certificado de Participação" |
| `body_template` | text | texto do corpo com placeholders (ver §3) |
| `workload_hours` | decimal | vazio = calculado das datas do evento |
| `issuer_name` | string | ex. "Reactivando" |
| `primary_color` | string | hex |
| `logo` | media single | |
| `background` | media single | opcional |
| `sponsors` | component repeatable `certificate.sponsor` | |
| `signatures` | component repeatable `certificate.signature`, `max: 4` | |

`draftAndPublish: false`, como todo o resto.

**`api::certificate.certificate`** — registro emitido. É o que dá validade e permite
verificação.

| campo | tipo | nota |
|---|---|---|
| `code` | string, unique, required | `RCT-` + 8 caracteres `[A-Z2-9]` (sem 0/O/1/I) |
| `event` | manyToOne → event, `inversedBy: certificates` | |
| `users_permissions_user` | manyToOne, opcional | preenchido quando veio de attendance |
| `name` | string, required | nome como sai impresso |
| `identifier` | string, required | CPF só dígitos |
| `email` | email, required | |
| `source` | enum `ATTENDANCE` · `SELF_REQUEST` · `ADMIN` | |
| `issued_at` | datetime | |
| `sent_at` | datetime | último e-mail enviado |
| `revoked_at` | datetime | soft delete, padrão do repo |

**Service `services/certificate.ts`:**

- `create()` normaliza `identifier` (só dígitos), gera `code` e checa colisão (regera até
  achar um livre; no máximo 5 tentativas, depois lança).
- `create()` é **idempotente por `(event, identifier)`**: se já existe um não revogado,
  devolve o existente sem criar outro. Reemitir do admin nunca duplica.
- `delete()` faz soft delete via `revoked_at`, igual a Event/Community.

`api::participant` **não muda**. É dado legado; o novo fluxo grava em `certificate`. A tabela
admin lista os `participants` antigos como mais uma origem para emissão.

**Permissões:** nenhuma nova no bootstrap. Todo acesso passa pelo BFF com
`MANAGER_TOKEN_INTEGRATION`. A página pública, que hoje bate direto no Strapi, migra para o
BFF.

**Tipos:** rodar `yarn strapi ts:generate-types` depois de criar os schemas.

### 2. API GraphQL — `hub-community-bff`

Novos: `src/types/Certificate.graphql`, `src/resolvers/Certificate/index.js`,
`src/dataSources/manager-integration/certificates/index.js` (config + certificates), tudo no
padrão de `Attendance`.

```graphql
type CertificateConfig {
  id: String
  enabled: Boolean!
  allow_self_request: Boolean!
  title: String
  body_template: String
  workload_hours: Float
  issuer_name: String
  primary_color: String
  logo: String            # URL absoluta
  background: String
  sponsors: [Sponsor]
  signatures: [Signature]
}
type Sponsor   { name: String!, logo: String!, url: String }
type Signature { name: String!, role: String, image: String }

enum CertificateSource { ATTENDANCE SELF_REQUEST ADMIN }

type Certificate {
  code: String!
  name: String!
  identifier: String!
  email: String!
  source: CertificateSource!
  issued_at: String
  sent_at: String
  revoked_at: String
  event: Event            # título, datas, local, comunidades — o que o render precisa
}

enum CandidateSource { SIGNUP ATTENDANCE REQUEST }

type CertificateCandidate {
  key: String!            # CPF normalizado; se não houver CPF, e-mail em minúsculas
  name: String!
  email: String
  identifier: String
  phone: String
  sources: [CandidateSource!]!
  checked_in: Boolean
  certificate: Certificate   # null = ainda não emitido
}

type LookupResult {
  certificate: Certificate   # existente ou recém-emitido por presença
  eligible_by_attendance: Boolean!
  self_request_allowed: Boolean!
  event_ended: Boolean!
}

input CertificateConfigInput {
  enabled: Boolean, allow_self_request: Boolean, title: String, body_template: String,
  workload_hours: Float, issuer_name: String, primary_color: String,
  logo: String, background: String,          # ids de mídia do Strapi
  sponsors: [SponsorInput], signatures: [SignatureInput]
}
input SponsorInput   { name: String!, logo: String!, url: String }
input SignatureInput { name: String!, role: String, image: String }

input IssueEntryInput { name: String!, identifier: String!, email: String! }
input IssueActionsInput { register: Boolean!, email: Boolean! }
type IssueResult {
  issued: Int!
  emailed: Int!
  certificates: [Certificate!]!   # para o front montar o ZIP
  errors: [String!]!              # "cpf 123…: SMTP timeout"
}

type Query {
  certificateConfig(eventId: String!): CertificateConfig
  certificateCandidates(eventId: String!): [CertificateCandidate!]!   # auth
  certificateByCode(code: String!): Certificate
  lookupCertificate(eventId: String!, identifier: String!): LookupResult!
}

type Mutation {
  upsertCertificateConfig(eventId: String!, data: CertificateConfigInput!): CertificateConfig   # auth
  copyCertificateConfig(fromEventId: String!, toEventId: String!): CertificateConfig           # auth
  issueCertificates(eventId: String!, entries: [IssueEntryInput!]!, actions: IssueActionsInput!): IssueResult!   # auth
  requestCertificate(eventId: String!, name: String!, identifier: String!, email: String!, phone: String): Certificate
}
```

**Resolvers — regras:**

- `certificateCandidates` faz o merge de três fontes: signups do Eventando
  (`eventandoIntegration.findSignupsByEvent`), `attendances` do hub (com
  `users_permissions_user` populado) e `participants` legados. Dedupe por `key`. Quando a
  mesma pessoa aparece em mais de uma fonte, `name`/`email`/`phone` seguem a prioridade
  ATTENDANCE > SIGNUP > REQUEST (presença tem dados confirmados pelo próprio usuário logado).
  Depois anexa o `certificate` não revogado do evento com o mesmo `identifier`.
- `lookupCertificate`: se existe certificado não revogado para `(event, identifier)`,
  devolve. Senão, se há `attendance` de um usuário com esse `cpf` no evento **e**
  `config.enabled` **e** o evento terminou, emite na hora com `source: ATTENDANCE` e devolve.
  Senão devolve só os flags.
- `requestCertificate`: recusa (erro com mensagem em pt-BR) se `!enabled`,
  `!allow_self_request` ou `end_date` no futuro. Emite com `source: SELF_REQUEST`.
- `issueCertificates`: para cada entry, `register` cria via service (idempotente). Se
  `email`, envia e atualiza `sent_at`. Processa em lotes de 10 com `Promise.allSettled`;
  falha individual vira item em `errors`, não aborta o lote. `actions.email` sem
  `actions.register` é inválido — e-mail pressupõe registro.
- `copyCertificateConfig` copia campos escalares e components; mídias são referenciadas
  pelo mesmo id (sem re-upload).
- Rotas marcadas `# auth` retornam erro "Não autenticado" quando `context.user` é nulo.

**E-mail:** `src/services/email/templates/certificate-issued.js`, mesmo formato de
`signup-confirmation.js`. Assunto "Seu certificado — {título do evento}". Corpo: nome do
evento, botão "Baixar certificado" → `${FRONTEND_URL}/certificado/${code}`, linha com o link
de verificação.

**Docs:** adicionar as queries em `GRAPHQL_USAGE.md`.

### 3. Frontend — `hub-community-frontend`

#### Componente central: `src/components/certificate/certificate-document.tsx`

Componente `@react-pdf/renderer` puro (sem Tailwind, sem hooks de app). Assinatura:

```ts
interface CertificateDocumentProps {
  config: CertificateConfig
  event: Pick<Event, 'title' | 'start_date' | 'end_date' | 'location' | 'communities'>
  certificate: Pick<Certificate, 'code' | 'name'>
  verifyUrl: string          // QR e rodapé
}
```

A4 paisagem. Camadas, de trás para frente: `background` (se houver) ou cor sólida derivada de
`primary_color`; logo no topo; `title`; corpo com placeholders resolvidos; faixa de
patrocinadores (logos com altura fixa, centralizados, até 8 por linha); assinaturas (até 4,
distribuídas igualmente, imagem opcional sobre a linha); rodapé com `code`, `issuer_name` e
QR code (gerado como data URL com `qrcode` — o `qrcode.react` existente é só para DOM).

Fonte: Helvetica (built-in do PDF, sem `Font.register`). As 14 fontes padrão usam WinAnsi,
que cobre os acentos do português; evita servir arquivos de fonte e garante render idêntico em
browser e Node.

Imagens: no Node o react-pdf baixa por URL; no browser precisa de CORS, então as URLs do
Strapi passam por `/api/og-image?url=` (proxy existente, já restringe domínio). A função
`imageSrc(url, { server })` em `lib/certificate.ts` decide.

#### Lógica pura: `src/lib/certificate.ts` (+ `__tests__/certificate.test.ts`)

```ts
export const PLACEHOLDERS = ['nome','evento','carga_horaria','data_inicio','data_fim','local','comunidade'] as const
export function resolveTemplate(template: string, vars: Record<Placeholder, string>): string
export function workloadHours(config: { workload_hours?: number | null }, event: { start_date: string; end_date: string }): number
export function certificateFileName(event: { slug?: string; title: string }, name: string): string
export function normalizeIdentifier(cpf: string): string
export function isValidCpf(cpf: string): boolean
```

- `resolveTemplate` substitui `{{chave}}` (espaços internos tolerados); chave desconhecida
  fica literal.
- `workloadHours`: usa `workload_hours` quando definido e > 0; senão
  `ceil((end - start) / 1h)`, mínimo 1.
- Datas formatadas em pt-BR (`date-fns` já existe) via `adjustToBrazilTimezone`.
- Template padrão (usado quando `body_template` está vazio):
  > Certificamos que **{{nome}}** participou do evento **{{evento}}**, realizado em
  > {{local}} de {{data_inicio}} a {{data_fim}}, com carga horária de {{carga_horaria}}
  > horas.

#### Rotas de servidor (Next route handlers)

- `GET /api/certificates/[code]/pdf` — busca `certificateByCode` + `certificateConfig` no
  BFF, `renderToBuffer(<CertificateDocument/>)`, responde `application/pdf` com
  `Content-Disposition: attachment; filename="<certificateFileName>"`. 404 se não existe ou
  revogado. É o link estável usado no e-mail.
- `POST /api/certificates/zip` — body `{ eventId, codes: string[] }`, header
  `Authorization` do admin repassado ao BFF (a validação é do BFF). Renderiza cada PDF e
  monta ZIP com `jszip`. Máximo 500 códigos por chamada; a UI fatia lotes maiores.

`@react-pdf/renderer` é carregado com `next/dynamic` só nas páginas que renderizam
certificado; no servidor, nas rotas acima.

#### Admin: `/admin/events/[id]/certificados` (substitui a página atual)

Duas abas (`Tabs` do shadcn).

**Aba Modelo.** Formulário (react-hook-form + zod, mesmo padrão de `admin/event-form.tsx`)
à esquerda, preview ao vivo (`PDFViewer`, dados fictícios "Nome do Participante") à direita;
em telas estreitas, empilhado. Campos: `enabled`, `allow_self_request`, `title`,
`body_template` (textarea com chips clicáveis que inserem `{{placeholder}}` na posição do
cursor), `workload_hours` (placeholder mostra o valor calculado), `issuer_name`,
`primary_color`, `logo` e `background` (upload via `/api/upload` reaproveitando
`image-crop-dialog`), patrocinadores (lista com adicionar/remover/reordenar, cada item com
nome, URL e upload de logo) e assinaturas (idem, máx. 4, com nome, cargo, imagem opcional).
Botão "Copiar de outro evento" recebe o slug (ou id) do evento de origem; ao confirmar
resolve o evento via `eventBySlugOrId`, chama `copyCertificateConfig` e recarrega o form
(a cópia vem com `enabled: false`). Salvar chama `upsertCertificateConfig`. O preview
é atualizado com debounce de 500 ms sobre os valores do form.

**Aba Emissão.** Tabela de `certificateCandidates`: nome (editável inline antes de emitir,
mesma interação da spec do crachá), CPF formatado, e-mail, badges de origem
(Inscrito / Presença / Solicitação), check-in, status (Não emitido · Emitido em … · Enviado em
… · Erro). Filtros: origem (multi), status, busca por nome. Checkbox por linha e "selecionar
todos os filtrados". Barra fixa com contagem e botão **Emitir**, que abre dialog com três
checkboxes — Registrar, Enviar e-mail, Baixar ZIP — onde e-mail e ZIP marcam Registrar
automaticamente. Ao confirmar: `issueCertificates` com os selecionados; se ZIP, chama
`/api/certificates/zip` com os `codes` retornados e dispara o download. Resultado num toast
(`sonner`) com contagens; `errors` viram ícone na linha com tooltip e botão "Reenviar".
Export XLSX mantido, agora com colunas de status e código.

Linha sem CPF (signup só com e-mail) pode ser emitida: o admin preenche o CPF inline; sem CPF
o botão fica desabilitado para aquela linha, porque `identifier` é a chave de idempotência.

#### Público: `/certificado?event=<slug|id>` (reescrita)

Continua bloqueada até `end_date`. Passa a bloquear também quando `!config.enabled`
(mensagem "Certificados ainda não disponíveis para este evento").

1. Campo CPF → `lookupCertificate`.
2. Se voltou `certificate`: mostra card com nome, evento, código, preview e botão **Baixar
   PDF** (link para `/api/certificates/[code]/pdf` — um único caminho de download em todo o
   site), mais link para a verificação.
3. Se não, e `self_request_allowed`: mostra o form atual (nome, CPF pré-preenchido, e-mail,
   WhatsApp) → `requestCertificate` → mesmo card de download.
4. Se não, e `!self_request_allowed`: "Não encontramos sua participação. Fale com a
   organização do evento."

O `eventId` padrão hardcoded (`q1y8wohrfis0ox81y5xr125w`) sai; sem `?event` a página mostra
erro amigável.

**`/certificado/[code]`** — página do certificado (destino do e-mail): card + preview
(`PDFViewer`) + Baixar PDF (link para `/api/certificates/[code]/pdf`). 404 amigável se
revogado.

**`/certificado/verificar/[code]`** — verificação pública: nome, evento, data, emissor,
estado Válido/Revogado. Sem download. É a URL do QR.

`src/lib/queries.ts` ganha as operações; `src/lib/types.ts` ganha `CertificateConfig`,
`Certificate`, `CertificateCandidate`, `Sponsor`, `Signature`.

### 4. Erros e casos de borda

- CPF inválido (dígitos verificadores) é rejeitado no front (`isValidCpf`) e no BFF.
- Evento sem `location` → `{{local}}` vira "online" quando `is_online`, senão string vazia e o
  template padrão omite o trecho "realizado em …".
- Config sem `logo` → cabeçalho só com `issuer_name`.
- Imagem do Strapi indisponível na hora do render → react-pdf lança; a rota responde 502 com
  mensagem; o browser mostra toast. Não há fallback silencioso (um certificado sem o logo do
  patrocinador é pior do que um erro).
- Alterar a config depois de emitido não invalida nada: o PDF é sempre render atual.
- Revogar (soft delete no Strapi admin) faz `certificateByCode` devolver `revoked_at`,
  verificação mostra "Revogado" e a rota PDF responde 404.

### 5. Testes

- **Backend** `src/api/certificate/services/certificate.test.ts` (mock strapi com `vi.fn()`,
  padrão de `event.test.ts`): formato do `code`, regeneração em colisão, falha após 5
  tentativas, idempotência por `(event, identifier)`, normalização de CPF, soft delete.
- **BFF**: adicionar Vitest (`"test": "vitest run"`) e extrair a lógica pura para
  `src/resolvers/Certificate/candidates.js` (merge/dedupe/prioridade) e
  `eligibility.js` (regras de `lookupCertificate`/`requestCertificate`), com testes ao lado.
  Resolvers ficam finos, chamando essas funções.
- **Frontend** `src/lib/__tests__/certificate.test.ts`: placeholders (chave ausente,
  espaços, desconhecida), carga horária (definida, nula, evento de 30 min), nome de arquivo,
  CPF. `src/components/certificate/__tests__/certificate-document.test.tsx`: `renderToBuffer`
  em Node gera PDF (`%PDF` no início) com e sem `background`, com 0 e 4 assinaturas, com 0 e
  8 patrocinadores.

### 6. Ordem de entrega

Cada etapa é mergeável e funciona sozinha.

1. **Backend**: components, `certificate-config`, `certificate`, service + testes, tipos gerados.
2. **BFF**: `certificateConfig`/`upsert`/`copy`, `certificateByCode`, `lookupCertificate`,
   `requestCertificate`.
3. **Frontend**: `lib/certificate.ts`, `CertificateDocument`, aba Modelo com preview,
   `/api/certificates/[code]/pdf`, páginas `/certificado`, `/certificado/[code]`,
   `/certificado/verificar/[code]`. → auto-atendimento no ar.
4. **BFF**: `certificateCandidates`, `issueCertificates`, template de e-mail, Vitest.
5. **Frontend**: aba Emissão, `/api/certificates/zip`.
6. **Docs**: `CLAUDE.md` do backend (lista de entidades e permissões está defasada — 20
   entidades, `team` já tem actions custom), `GRAPHQL_USAGE.md` do BFF.

## Arquivos

```
hub-community-backend/
  src/components/certificate/sponsor.json                     (novo)
  src/components/certificate/signature.json                   (novo)
  src/api/certificate-config/{content-types,controllers,routes,services}/  (novo, factory)
  src/api/certificate/{content-types,controllers,routes}/     (novo, factory)
  src/api/certificate/services/certificate.ts                 (novo — code, idempotência, soft delete)
  src/api/certificate/services/certificate.test.ts            (novo)
  src/api/event/content-types/event/schema.json               (+ certificate_config, certificates)
  CLAUDE.md                                                   (atualizado)

hub-community-bff/
  src/types/Certificate.graphql                               (novo)
  src/resolvers/Certificate/{index,candidates,eligibility}.js (novo) + testes
  src/dataSources/manager-integration/certificates/index.js   (novo)
  src/dataSources/manager-integration/index.js                (registra)
  src/services/email/templates/certificate-issued.js          (novo)
  package.json                                                (+ vitest)
  GRAPHQL_USAGE.md                                            (atualizado)

hub-community-frontend/
  src/lib/certificate.ts + __tests__/certificate.test.ts      (novo)
  src/components/certificate/certificate-document.tsx + __tests__/  (novo)
  src/components/admin/certificate-config-form.tsx            (novo)
  src/components/admin/certificate-issue-table.tsx            (novo)
  src/app/admin/events/[id]/certificados/page.tsx             (reescrita — abas)
  src/app/certificado/page.tsx                                (reescrita)
  src/app/certificado/[code]/page.tsx                         (novo)
  src/app/certificado/verificar/[code]/page.tsx               (novo)
  src/app/api/certificates/[code]/pdf/route.ts                (novo)
  src/app/api/certificates/zip/route.ts                       (novo)
  src/lib/queries.ts, src/lib/types.ts                        (+ operações e tipos)
  package.json                                                (+ @react-pdf/renderer, jszip, qrcode)
```

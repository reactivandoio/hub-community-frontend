# HubCommunity Frontend - Development Guide

## Project Overview
Community platform built with Next.js 16 (App Router), React 19, TypeScript 5, and Tailwind CSS 3.
UI layer uses shadcn/ui (50+ Radix UI components) with Lucide icons.

## Quick Start
```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server (default port)
pnpm build      # Build for production
pnpm start      # Start production server on port 4010
```

## Architecture

### Stack
- **Framework**: Next.js 16 with App Router (`src/app/`)
- **API**: Apollo Client v3 → GraphQL BFF (`NEXT_PUBLIC_GRAPHQL_URL`)
- **Auth**: login by a code sent to the e-mail (REA-26, no password) → JWT stored in localStorage (`auth_token`, `auth_user`)
- **Forms**: React Hook Form + Zod validation
- **Rich Text**: Tiptap editor (input), Strapi blocks renderer (output)
- **Theming**: next-themes (dark/light), CSS variables in `globals.css`

### Directory Structure
```
src/
  app/          # Next.js App Router pages and layouts
  components/
    ui/         # shadcn/ui primitives (50+ components)
    admin/      # Admin form dialogs
    ...         # Feature-specific components
  lib/          # apollo-client, firebase, queries, types, jwt, utils, analytics
  contexts/     # auth-context, filter-context, agenda-context
  hooks/        # use-auth, use-debounce, use-mobile, use-toast
  utils/        # event helpers, regionAndCities.json
```

### Key Patterns
- Use `cn()` from `src/lib/utils.ts` for className merging (clsx + tailwind-merge)
- All GraphQL operations live in `src/lib/queries.ts`
- Types in `src/lib/types.ts`
- Brand colors: Emerald Green (#10B981) primary, Purple (#8B5CF6) secondary
- CSS variables defined in `src/app/globals.css` for both light and dark themes
- **Certificates (`src/lib/certificate*.ts`, `src/components/certificate/`)** — PDFs are built with `@react-pdf/renderer`. Only `certificate-document.tsx`, `certificate-preview.tsx`, `lib/certificate-fonts.ts` and `lib/certificate-server.ts` may import it; everything else (types, forms) imports the pure `lib/certificate.ts` / `lib/certificate-fonts-meta.ts`. `CertificatePreview` (react-pdf + pdf.js canvas) must be loaded with `next/dynamic({ ssr:false })`. Server rendering lives in `/api/certificates/[code]/pdf` and `/api/certificates/zip` (they talk to the BFF via `GRAPHQL_URL`, falling back to `NEXT_PUBLIC_GRAPHQL_URL`). Cursive signature fonts are self-hosted in `public/fonts` (SIL OFL, see `OFL.txt`) and declared in both `globals.css` and `certificate-fonts-meta.ts` — keep them in sync. Docker: `make dev-front-build` / `dev-front-prod` (frontend container against the production BFF) / `dev-front-local`.
- **Certificate categories** — every certificate, request and request form carries a category
  ("Participante" by default, plus "Organizador", "Mentor"… as the event needs). `lib/certificate.ts`
  owns the comparison rule (`normalizeCategory` / `categoryKey` / `isDefaultCategory`), matching the
  BFF and the backend. The admin creates one public form per category under
  `/admin/events/[id]/certificados` → aba **Solicitações**; each form has its own link
  (`/certificado/solicitar/[slug]`), and whoever fills it lands in that category's list on the
  **Emissão** tab, picked by the "Lista" select. The default list is the only one fed by inscritos and
  presenças. `{{categoria}}` is a body-template placeholder, so one model serves every list.
- **Unlisted events** — `Event.unlisted` hides an event from the public listings (home, `/events`,
  search, community page). The BFF filters it out of the `events` query by default, so a public
  caller needs no change; an admin surface that must see them passes `include_unlisted: true`
  (`/admin/events` and the voting-session picker do). The event's own page and signup flow are never
  filtered — the direct link is the point.

- **Coupon link (REA-18)** — `/events/<slug>#cupom=CODE` fills the coupon in on signup. `lib/coupon-link.ts`
  builds and parses the fragment (any other fragment is ignored) and keeps the code per event in
  `localStorage` (`pending_coupon:<slug>`, 24 h) so it survives login and signup; `useCouponLink` reads
  it on the event page and on `/events/<slug>/signup`, and every path that leads to the signup
  (Participar, the login `redirect`) carries the fragment along. The link grants nothing: the signup
  page sends the code to the server like a typed one. The admin copies the link in the Cupons tab.

- **Rich text / descriptions (REA-14)** — descriptions (event, talk, speaker bio, community, comments)
  are markdown. `RichTextEditor` saves it as Strapi-style blocks, one `paragraph` per "\n\n" with the
  markdown inside; older records may be real Strapi blocks or plain strings. `lib/rich-text.ts`
  (`richTextToMarkdown`) turns any of these into markdown, and `components/ui/markdown-content.tsx`
  (`MarkdownContent`) renders it safely (react-markdown + GFM + line breaks, `skipHtml`, external
  links `rel="noopener noreferrer"`). `RichText`, `ExpandableRichText` and the editor's
  "Pré-visualizar" all go through it — don't render descriptions any other way.

- **Admin access (REA-10)** — `/admin`, `/badge-printer`, `/checkin` and `/sorteio` have a layout with
  `AdminGuard` (`components/admin/admin-guard.tsx`): signed in (else "Entre para continuar" + login modal on the same URL, REA-25) with the
  `admin`, `community-manager` or `event-manager` (REA-48) role, read from the BFF `adminAccess` query. Admin-only paths
  (`ADMIN_ONLY_PATHS` in `lib/admin-access.ts`: usuários, palestrantes, votações) refuse a
  community-manager, and lists are scoped with `visibleEvents` / `visibleCommunities`. Pages read the
  access with `useAdminAccess()`. This only shapes the UI: the BFF checks the role on every operation.
  There is no admin password anymore. `AuthState.isHydrated` tells when the saved session was read.

- **Login in place (REA-25)** — never send someone to the home page to log in. `useLoginPrompt().requestLogin({ reason, onSuccess })`
  (`contexts/login-prompt-context.tsx`) opens the one `AuthModal` over the current page; `useWithLogin()(action)` runs an
  action now or after the login (the action must not re-check the session). A page that needs a session renders
  `<LoginRequired>` (`components/login-required.tsx`) once `isHydrated` and signed out — it opens the modal once and keeps
  a button — and fetches nothing protected before the session. Old `?login=true&redirect=/x` links still work: the
  provider goes to `/x` and opens the modal there. `lib/login-prompt.ts` (`login_return_to`, 24 h) still lets the old
  `/email-confirmed` links send the person back after the login.

- **Login by e-mail code (REA-26)** — there is no password. `AuthModal` has two steps: e-mail → `REQUEST_LOGIN_CODE`
  (6 digits, 10 min, one a minute; the BFF answers the same whether the account exists) → code → `VERIFY_LOGIN_CODE`,
  which returns the session; a new e-mail gets its account then, and `CompleteProfileModal` asks for name, CPF, date of
  birth, WhatsApp and the 18+ declaration. Errors come with a code in `extensions` (`LOGIN_CODE_COOLDOWN` +
  `retryAfter`, `LOGIN_CODE_INVALID` + `attemptsLeft`, `LOGIN_CODE_EXPIRED`, `LOGIN_CODE_LIMIT`, `LOGIN_CODE_NOT_SENT`
  when Mailgun refused, `ACCOUNT_BLOCKED`, `RATE_LIMITED`); the modal shows the BFF's pt-BR message. `useAuth()` has
  `requestLoginCode` / `verifyLoginCode` (no signIn/signUp/forwardPassword/resetPassword). `/criar-senha` and
  `/reset-password` only redirect to `/completar-cadastro` (old e-mail links), which opens the login and then the
  profile. "Continuar com o Google" is the next step, above the e-mail.

- **Admin layout (REA-24)** — every `/admin` page is framed by `AdminShell`
  (`components/admin/admin-shell.tsx`, inside `AdminGuard` in `app/admin/layout.tsx`): collapsible
  sidebar (icons when collapsed, drawer on the phone, state in `localStorage` `admin_sidebar_open`),
  a sticky top bar with the breadcrumb, and the page below it. Pages must not add top padding
  for a navbar nor `min-h-screen`. Every admin page uses `components/admin/admin-page.tsx`:
  `AdminPage` (full width, no `container`/`max-w-*`), `AdminPageHeader` (title, description, and
  `actions`), `AdminPageLoading` / `AdminPageError` / `AdminEmpty`. Page actions ("Novo…", "Salvar…")
  are declared with `AdminPageActions` (`page-actions.tsx`) and shown in the top bar (a menu on the
  phone); a submit button there needs `form="<form id>"`. No back arrow and no event name in the
  page header: the breadcrumb and the sidebar have them. The signed-in user, theme and sign out are
  in the sidebar footer. Top bar and sidebar header share `--admin-header-height` (`HEADER_ROW`). The public floating navigation and footer are hidden there
  (`PublicOnly`), and `PageTransitionProvider` does not key `/admin` by path (it would remount the frame).
  What the sidebar and breadcrumb show is in `lib/admin-nav.ts` (pure, tested): add a new admin page
  there. Inside `/admin/events/<id>` the sidebar switches to that event (`eventNavGroups`).
  Geral / Programação / Produtos & Lotes are one form (`EventEditor`) with three URLs
  (`/admin/events/<id>`, `/programacao`, `/produtos`): it is rendered by the `(editar)` route-group
  layout so it stays mounted between them; the old `#schedule` / `#products` links redirect. Cupons is
  `/admin/events/<id>/cupons`. Links inside the shell use `GuardedLink` (`unsaved-guard.tsx`), which
  asks before leaving unsaved changes registered with `useUnsavedChanges`.

- **E-mail marketing (REA-29)** — `/admin/events/<id>/email`: convite para a base (admin only), "Convide
  alguém" and lembrete (signups), each with preview, "Enviar teste para mim" and send; history below
  with pause/resume/cancel (`components/admin/email-campaigns/`, texts in `lib/email-campaign.ts`).
  The queue lives in the BFF: campaigns use at most `EMAIL_DAILY_LIMIT - EMAIL_DAILY_RESERVE` (100 - 30 by
  default) minus every e-mail already sent that day — login codes and transactional e-mails always go first (REA-26),
  off unless `EMAIL_CAMPAIGNS_ENABLED=true`,
  `EMAIL_CAMPAIGN_REDIRECT_TO` sends everything to one test address. Every campaign e-mail links
  `/descadastro?t=` (asks for a click) and sends `List-Unsubscribe` to `POST /api/email/unsubscribe`
  (one-click, `lib/email-unsubscribe.ts`). The signup's share link is `/events/<slug>?ref=<code>`;
  `lib/share-ref.ts` keeps the code for the session and `useTracking` sends it as `metadata.ref`. The
  signup form has an optional `marketing_opt_in` checkbox (only recorded: campaigns go to everyone who
  has not unsubscribed, legitimate interest).

- **Aprovação manual (REA-34)** — in Analytics → Participantes an admin (`useAdminAccess().isAdmin`)
  approves a paid signup without a charge: "Aprovar" shows only on pending / expired / canceled rows
  (`canApproveSignup` in `lib/manual-approval.ts`; never refunded, confirmed, already approved or
  without payment). `ApproveSignupButton` (`components/admin/approve-signup-dialog.tsx`) fetches
  `SIGNUP_APPROVAL_PREVIEW` when it opens (lote/evento lotado, cupom esgotado), then runs
  `APPROVE_SIGNUP_MANUALLY` and refetches analytics + eventPayments; the person gets the normal
  confirmation e-mail. An approved signup reads "Aprovada manualmente" (`manual_approved`, tone
  `manual`), R$ 0, out of the revenue (`summarizePayments` counts it in `manual`), with "por X em
  data" in the list and "Aprovado por" / "Aprovado em" in the CSV. The BFF checks the role.

- **Maioridade (REA-36)** — the Hub is 18+ only. Every signup form has the required
  `AdultDeclaration` checkbox (`components/adult-declaration.tsx`, "Declaro que tenho 18 anos ou
  mais", never pre-checked) and sends `adult_declaration: true`: logged
  and guest event signup, the three `MANUAL_SIGNUP` forms (badge-printer live/event and the admin
  Inscrições tab; there the staff ticks "A pessoa declarou…"), both certificate forms and the
  attendance list. `CompleteProfileModal` shows it while the account never declared
  (`user.adult_declaration`, from `VERIFY_LOGIN_CODE`/`ME`) — for accounts created by a login code (REA-26) this is
  where the declaration is made. Dates of birth must be of an adult: `isAdult` /
  `ageOn` in `lib/birth-date.ts` (São Paulo calendar day, same rule as the BFF and the backend).
  The BFF refuses all of it again. `/admin/usuarios/idade` (admin only, sidebar "Idade (18+)",
  `lib/age-review.ts`): accounts without a date of birth (select up to 50 → e-mail asking for it;
  without a date 7 days after the e-mail the backend deactivates the account) and minors
  ("Desativar e avisar" → `blocked` + e-mail with the reason; signups are kept). The e-mails share the
  campaigns' daily quota; nothing runs without a click. `/completar-cadastro` is the e-mail's link
  (login, then the profile modal). Campaigns only reach adults with a date of birth.

- **Arte "Eu vou" do evento (REA-43)** — the participant's art (`/events/<slug>/arte`,
  `components/share-art/`) has two renderers per format (Stories 9:16, Feed 4:5 — 1:1 until REA-47): the default Hub
  template (`share-art-template.tsx`, html-to-image) and, when the event has one, the organizer's art:
  a background image with the photo area on top, drawn on a canvas by `drawCustomArt`
  (`lib/share-art-custom.ts`), the same function the admin preview uses. `/admin/events/<id>/arte`
  (sidebar "Arte \"Eu vou\"", admin and organizer; the BFF checks it) picks the background per format
  and the area with `ShareArtAreaEditor` (drag to move, handles to resize, arrows; "Área quadrada"),
  radius from square corners to a circle, and a live preview with a sample photo (or a local test
  photo, never uploaded). The area is stored in fractions of the background (`x`, `y`, `width`,
  `height`, `radius` 0–1; radius × half of the smaller side) — pure rules in `lib/share-art-config.ts`,
  same numbers as the BFF (`resolvers/ShareArt/rules.js`): background ratio within 1% and at least
  1080px wide, checked before the upload and again by the BFF. A format without a complete config, or
  whose background fails to load (`/api/og-image` proxy, needed for canvas pixels), keeps the default
  art. The custom art has no role/name: those steps are hidden for that format, and the photo is
  cropped to the area's ratio.
- **Arte para quem não está inscrito (REA-45)** — `Event.share_art_open` (off by default), the switch
  "Arte "Eu vou" para quem não está inscrito" in the event form (Geral, `EventForm`). Off: `/events/<slug>/arte`
  is as before (login, then signup only). On: anyone with the link gets the generator, without an
  account and without the login prompt — the art is made in the browser and nothing is saved; a
  logged-in person still gets their name filled in. Whoever is not signed up sees "Ainda não se
  inscreveu? Ver evento" above it, and the default art reads "Eu vou no" instead of "Me inscrevi no"
  (`shareArtHeadline`); the organizer's custom art (REA-43) is used as well. The event page shows
  "Gerar arte "eu vou"" under "Participar do Evento". The BFF leaves the flag untouched when an update
  does not send it.
- **Recorte do fundo da arte (REA-45)** — in `/admin/events/<id>/arte`, a background in another ratio
  opens `ShareArtBackgroundCropDialog` (react-easy-crop, ratio locked to the format, drag + zoom)
  instead of an error; "Recortar imagem de fundo" crops the current one again, from the picked
  original (or, for a saved one, its `/api/og-image` URL). The crop is scaled to exactly 1080×1920 /
  1080×1350 JPEG and uploaded already cropped; it is never enlarged — a crop under 1080 px of the
  original's width cannot be confirmed (`cropProblem`), and an image too small even at zoom 1 is
  refused before the dialog (`cropSourceProblem`). The BFF still checks the uploaded file's ratio.

- **Nome e papel na arte; Feed 4:5 (REA-47)** — per format, the organizer's art can also place the
  two texts the person already fills in the generator: the role they pick in "Seu papel no evento"
  (`SHARE_ART_ROLES`: Participante, Líder, Mentor, Voluntário, Palestrante, Organizador) and the name
  they type in "Seu nome" (up to 25 characters). Nothing is looked up: no role comes from signups,
  products or speakers. `name_text` / `role_text` are an area in fractions of the background plus
  font, size (fraction of the image width), color and alignment; null = that text is not on the
  art, and then its step is not asked. In `/admin/events/<id>/arte` the buttons Foto / Nome / Papel
  pick the area to edit in `ShareArtAreaEditor` (all areas are shown and draggable, handles only on
  the selected one) and `TextControls` sets show/hide, font (`SHARE_ART_FONTS`: Inter, Inter negrito,
  serif, serif negrito and the self-hosted cursive ones), size, color and alignment; a first
  background starts with both under the photo (`defaultTextArea`); the preview shows "Maria Silva" /
  "Participante". `drawCustomArt` draws the texts after the photo (`drawArtText`: vertically
  centered, aligned, shrunk to fit the width — `fitTextSize`), after `loadArtFonts` (a canvas only
  draws loaded fonts; Inter's hashed next/font name is read from `<body>`). The default art is as
  before. `formatInput` sends only the input's fields (Apollo's `__typename` would be refused). The
  feed is now **4:5 (1080×1350)** everywhere (default template 360×450, crop, export, "Feed (4:5)"); a
  feed background saved in 1:1 comes back as null with `retired_formats: ['feed']` — default art in
  that format and a notice in the admin until a new one is sent.

- **Organizadores, gestores e convites (REA-48)** — roles: `admin`, `community-manager` (its
  communities and their events), **`event-manager`** (only the events it manages) and `authenticated`.
  A role alone grants nothing: a community-manager needs to be in `community.organizers`, an
  event-manager in `event.managers`. `adminAccess` brings `isEventManager` and `events` (the events
  it manages); `lib/admin-access.ts` keeps an event-manager (`isOnlyEventManager`) to them —
  `eventManagerMayOpen`: no `/admin/communities`, no `/admin/events/new`, no other event (by id or
  slug) — `visibleEvents` lists its events, `mainNavItems` drops Comunidades, and the events list
  hides "Novo Evento" and "Excluir". Invites are e-mails with a link `/convite?t=` (7 days, used
  once, only for the invited e-mail; the BFF keeps just the token's hash):
  `components/admin/management-people.tsx` — `CommunityOrganizersDialog` (button "Organizadores"
  per row of `/admin/communities`, admin only) and `EventManagersCard` (section "Gestores" under the
  event form, Geral; owners invite/remove, managers only see the list). The invite becomes access on
  the next login by code of that e-mail (the BFF accepts pending invites in `verifyLoginCode`) or on
  `/convite` already logged in (`ACCEPT_MANAGEMENT_INVITE`; another account gets "foi enviado para
  m***@…", with "Entrar com outro e-mail"), and the person goes to the event (`inviteDestination`,
  `lib/management-invite.ts`). Accepting raises the role (community-manager / event-manager) and never
  lowers it; removing someone never changes their role — `/admin/usuarios` shows "Comunidades e
  eventos" per user and a warning when role and links do not match (`accessMismatch`,
  `lib/access-links.ts`); the role can be picked there too (Event Manager included).

### Provider Hierarchy (layout.tsx)
FirebaseProvider → ApolloProvider → AuthProvider → LoginPromptProvider → LogoutModalWrapper → AgendaProvider → FilterProvider → ThemeProvider → children

## Conventions

### Code Style
- Use TypeScript strict patterns; prefer interfaces over types for objects
- Use `"use client"` directive only when component needs client-side features
- Prefer shadcn/ui components over custom implementations
- Use Tailwind classes for styling; avoid inline styles
- Use `cn()` for conditional/merged class names

### Component Structure
- UI primitives go in `src/components/ui/`
- Feature components go in `src/components/` (flat or grouped by feature)
- Admin-specific components go in `src/components/admin/`
- Page components go in `src/app/` following Next.js conventions

### Animation Guidelines (feat/animations-and-loading)
This branch adds animations and loading states to the project. Follow these rules:

#### Library Choice
- **Framer Motion** (`motion/react`) is the primary animation library
- Use `tailwindcss-animate` (already installed) for simple CSS-only animations
- Use Tailwind `animate-*` classes for basic effects (pulse, spin, bounce)
- Use Framer Motion for entrance animations, page transitions, staggered lists, and gesture-based interactions

#### Animation Principles
- Keep animations subtle and fast (150-300ms for micro-interactions, 300-500ms for page transitions)
- Use `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for movement
- Respect `prefers-reduced-motion`: always wrap Framer Motion animations with reduced motion support
- Avoid layout-triggering animations (prefer `transform` and `opacity`)
- Loading skeletons should match the approximate shape of the content they replace

#### Reusable Animation Components
Place shared animation wrappers in `src/components/animations/`:
- `fade-in.tsx` - Generic fade-in wrapper
- `slide-in.tsx` - Directional slide entrance
- `stagger-container.tsx` - Stagger children animations
- `page-transition.tsx` - Page-level transition wrapper
- `skeleton-*.tsx` - Loading skeleton variants for different content types

#### Loading States
- Use skeleton components (not spinners) for content loading
- Show loading states immediately, don't wait for a delay
- Match skeleton shapes to real content layout
- Use `animate-pulse` from Tailwind for skeleton shimmer effect
- For data fetching, leverage Apollo Client's `loading` state from `useQuery`

#### Where NOT to Animate
- Form inputs (focus states are fine, but don't animate the input itself)
- Text content changes (avoid text fade-in on re-renders)
- Navigation links in the header/footer
- Any interaction that would delay user action

### Testing
- **Framework**: Vitest + React Testing Library + jsdom
- **Config**: `vitest.config.ts` at project root
- **Test location**: Colocated `__tests__/` directories next to source files
- **Commands**:
  - `pnpm test` — run all tests once
  - `pnpm test:watch` — run in watch mode
  - `pnpm test:coverage` — run with V8 coverage report
- **CI**: GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests + build on every PR to `main`
- **What to test**: Utility functions, hooks, and pure logic. Component tests use `@testing-library/react`.

### Build Notes
- Build is configured to ignore TypeScript and ESLint errors (`next.config.mjs`)
- Husky is configured for git hooks

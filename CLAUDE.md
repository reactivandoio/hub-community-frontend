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
- **Auth**: Firebase + JWT tokens stored in localStorage (`auth_token`, `auth_user`)
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

### Provider Hierarchy (layout.tsx)
FirebaseProvider → ApolloProvider → AuthProvider → LogoutModalWrapper → AgendaProvider → FilterProvider → ThemeProvider → children

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

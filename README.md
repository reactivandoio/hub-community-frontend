# Hub Community Frontend

A modern Next.js application for discovering and connecting with tech communities and events. Built with TypeScript, GraphQL, and a component-based architecture.

## Desenvolvimento em Docker

Só precisa do Docker (macOS ou Linux). A versão do Node fica no `.nvmrc`, a mesma do CI e da produção.

```bash
make dev     # sobe o frontend em http://localhost:4010, com recarga de código
make test    # testes, como no CI
make build   # build, como no CI
make lint    # lint, como no CI (lá ele não bloqueia)
make shell   # terminal dentro do container
make down    # para; make reset também apaga os volumes (node_modules e .next)
```

Na primeira vez, o `make` cria o `.env.dev` a partir do `.env.dev.example` (o `.env.dev` fica fora
do git). Dentro do container o `.env` é o `.env.dev`: o `.env` da máquina nunca é lido.

O BFF usado vem do `.env.dev` (`BFF_URL`): por padrão o BFF local (`make dev` no
hub-community-bff, porta 4001). Para usar o BFF de produção com a sua conta de verdade:
`make dev BFF=prod` (ou `make dev-front-prod`, em segundo plano).

Stack inteira (MySQL, Strapi do Hub, Eventando, BFF e frontend), com os quatro repositórios lado a
lado na mesma pasta: `make hub`. Só a API (sem o frontend), em segundo plano: `make dev-api`;
para tudo com `make dev-down`. Cada serviço usa o `.env.dev` do próprio repositório.

O deploy de produção não usa nada disso: continua com `make update` (pm2) no servidor.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Access to the GraphQL BFF server (running on port 4000)

### Installation & Development

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd hub-community-frontend
   npm install
   # or yarn install
   # or pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your GraphQL BFF URL
   NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   # or yarn dev
   # or pnpm dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Architecture

### Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **Data Fetching**: Apollo Client for GraphQL
- **State Management**: React Context + Custom Hooks
- **Form Handling**: React Hook Form + Zod validation
- **Theming**: next-themes for dark/light mode
- **Animations**: Tailwind CSS animations + Framer Motion

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── communities/        # Community listing and details
│   ├── events/           # Event listing and details
│   ├── about/            # About page
│   └── layout.tsx        # Root layout with providers
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── apollo-provider.tsx
│   ├── navigation.tsx
│   ├── footer.tsx
│   └── [feature-components]/
├── contexts/             # React Context providers
│   └── filter-context.tsx
├── hooks/                # Custom React hooks
│   ├── use-debounce.ts
│   └── use-mobile.tsx
├── lib/                  # Core utilities and configurations
│   ├── apollo-client.ts  # GraphQL client setup
│   ├── queries.ts        # GraphQL queries
│   ├── types.ts          # TypeScript type definitions
│   └── utils.ts          # Utility functions
└── utils/                # Additional utilities
    └── event.ts
```

### Key Architectural Decisions

#### 1. **Component-Based Architecture**

- Modular UI components using Radix UI primitives
- Consistent design system with shadcn/ui
- Reusable components for communities, events, and common UI patterns

#### 2. **GraphQL Integration**

- Apollo Client for efficient data fetching
- Centralized query definitions in `src/lib/queries.ts`
- Optimistic updates and error handling
- Type-safe GraphQL operations

#### 3. **State Management**

- React Context for global state (filters, theme)
- Custom hooks for reusable logic
- Local component state for UI interactions

#### 4. **Performance Optimizations**

- Next.js App Router for automatic code splitting
- Debounced search with custom hooks
- Optimized images with Next.js Image component
- Tailwind CSS for minimal bundle size

#### 5. **Developer Experience**

- TypeScript for type safety
- ESLint + Prettier for code quality
- Husky for pre-commit hooks
- Comprehensive error boundaries

## 🎨 Design System

### Color Palette

- CSS custom properties for theme consistency
- Dark/light mode support
- Semantic color naming (primary, secondary, accent, etc.)

### Component Library

- Built on Radix UI primitives
- Consistent spacing and typography
- Responsive design patterns
- Accessibility-first approach

## 📊 Data Flow

### GraphQL Schema

The application consumes data from a GraphQL BFF that provides:

- **Communities**: Tech communities with events, organizers, and tags
- **Events**: Community events with talks, speakers, and locations
- **Tags**: Categorization system for filtering

### State Management Flow

1. **Filter Context**: Manages search terms and tag filters
2. **Apollo Client**: Handles GraphQL queries and caching
3. **Component State**: Local UI state for interactions
4. **URL State**: Next.js router for navigation state

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

## 🖨️ Badge Printer — Configuração de Kiosk

A página `/badge-printer` permite gerar e imprimir crachás (100mm × 50mm) diretamente
em uma impressora térmica de etiquetas. Usando o modo **kiosk-printing** do Chrome,
a impressão é enviada direto para a impressora sem diálogo de impressão.

Testado com a impressora **4BARCODE 4B-2074A (Tomate 2074A)**.

### Pré-requisitos

- macOS com CUPS (pré-instalado)
- Impressora 4BARCODE 4B-2074A instalada e configurada
- Google Chrome
- Etiquetas 100mm × 50mm (4in × 2in)

### 1. Definir a impressora como padrão do macOS

`--kiosk-printing` sempre usa a impressora padrão do sistema.

**System Settings → Printers & Scanners → Default printer** → selecione a 4BARCODE.

### 2. Adicionar tamanho de papel `w4h2` ao PPD

O PPD padrão da impressora **não inclui** um tamanho de papel que corresponda à etiqueta
100mm × 50mm. Sem essa configuração, o Chrome usa papéis maiores (como `w2h4` ou `w4h6`)
e consome múltiplas etiquetas por impressão.

Execute este comando para adicionar o tamanho `w4h2` (4in × 2in = 288pt × 144pt):

```bash
sudo sed -i.bak \
  -e 's/^\*DefaultPageSize: w4h6/*DefaultPageSize: w4h2/' \
  -e '/^\*PageSize w2h4/i\
*PageSize w4h2/4 x 2 (4.00 in x 2.00 in): "<<\/PageSize[288 144]\/ImagingBBox null>>setpagedevice"' \
  -e 's/^\*DefaultPageRegion: w4h6/*DefaultPageRegion: w4h2/' \
  -e '/^\*PageRegion w2h4/i\
*PageRegion w4h2/4 x 2 (4.00 in x 2.00 in): "<<\/PageSize[288 144]\/ImagingBBox null>>setpagedevice"' \
  -e '/^\*ImageableArea w2h4/i\
*ImageableArea w4h2/4 x 2 (4.00 in x 2.00 in): "0 0 288 144"' \
  -e '/^\*PaperDimension w2h4/i\
*PaperDimension w4h2/4 x 2 (4.00 in x 2.00 in): "288 144"' \
  /etc/cups/ppd/_4BARCODE_4B_2074A.ppd
```

> **Nota:** O nome do arquivo PPD pode variar. Verifique com:
> `ls /etc/cups/ppd/ | grep -i barcode`

### 3. Configurar o papel padrão e reiniciar o CUPS

```bash
# Define w4h2 como padrão a nível de sistema
sudo lpadmin -p _4BARCODE_4B_2074A -o PageSize=w4h2

# Reinicia o serviço CUPS para carregar o PPD atualizado
sudo launchctl stop org.cups.cupsd && sudo launchctl start org.cups.cupsd

# Define w4h2 como padrão a nível de usuário
lpoptions -p _4BARCODE_4B_2074A -o PageSize=w4h2
sudo lpoptions -p _4BARCODE_4B_2074A -o PageSize=w4h2
```

Verificar se a configuração foi aplicada:

```bash
lpoptions -p _4BARCODE_4B_2074A | grep -o 'PageSize=[^ ]*'
# Deve exibir: PageSize=w4h2
```

### 4. Iniciar o Chrome em modo kiosk-printing

```bash
sudo /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk-printing http://localhost:3000/badge-printer
```

> **Por que `sudo`?** O Chrome com `--kiosk-printing` precisa de permissões elevadas
> para acessar as configurações de impressora a nível de sistema (definidas via `lpadmin`).

### 5. Imprimir um crachá de teste

Após preencher o formulário e clicar em **Imprimir**, o crachá deve sair em
**uma única etiqueta**, na orientação horizontal (landscape), sem diálogo de impressão.

### Como funciona (detalhes técnicos)

O CSS de impressão em `src/lib/badge-print.ts` usa:

```css
@page { size: 4in 2in; margin: 0; }
```

Isso bate exatamente com o tamanho de papel `w4h2` no PPD (288pt × 144pt), que por sua
vez bate com a etiqueta física de 100mm × 50mm. O Chrome encontra o match direto no
driver da impressora e envia o conteúdo sem rotação.

O badge é renderizado via um `<iframe>` invisível com `srcdoc`, que chama `window.print()`
automaticamente. No modo kiosk, o Chrome pula o diálogo e envia direto.

### Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| Consome 2 etiquetas | PPD sem tamanho `w4h2` | Refaça o passo 2 |
| Imprime na vertical | CUPS não reiniciado | Reinicie CUPS (passo 3) |
| Diálogo aparece | Chrome sem `--kiosk-printing` | Feche todas as janelas do Chrome e relance com a flag |
| Impressora errada | Não é a padrão do macOS | Refaça o passo 1 |
| Conteúdo cortado | Papel não configurado | Verifique com `lpoptions -p _4BARCODE_4B_2074A \| grep PageSize` |
| De cabeça pra baixo | Feed direction da impressora | Adicione `transform: rotate(180deg)` ao `.badge-container` em `badge-print.ts` |

### Restaurar PPD original

Se precisar reverter a modificação do PPD:

```bash
sudo cp /etc/cups/ppd/_4BARCODE_4B_2074A.ppd.bak /etc/cups/ppd/_4BARCODE_4B_2074A.ppd
sudo launchctl stop org.cups.cupsd && sudo launchctl start org.cups.cupsd
```

## 🌐 Environment Variables

Create a `.env` file in the root directory:

```bash
# GraphQL BFF URL
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql

# Optional: API endpoints
NEXT_PUBLIC_API_URL=https://hubcommunity-manager.8020digital.com.br/api
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

- **Netlify**: Use `npm run build` and `npm run start`
- **Docker**: Build with `docker build -t hub-community-frontend .`

## 🔗 Dependencies

### Core Dependencies

- **Next.js 15.2.4**: React framework with App Router
- **React 19**: UI library
- **TypeScript 5**: Type safety
- **Tailwind CSS**: Utility-first CSS framework
- **Apollo Client**: GraphQL client

### UI Components

- **Radix UI**: Accessible component primitives
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **Sonner**: Toast notifications

### Development Tools

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **TypeScript**: Type checking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**GraphQL Connection Error**

- Ensure the BFF server is running on port 4000
- Check your `.env` configuration
- Verify network connectivity

**Build Errors**

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

**TypeScript Errors**

- Run `npm run lint:fix` to auto-fix issues
- Check type definitions in `src/lib/types.ts`

For more detailed setup instructions, see [SETUP.md](SETUP.md).

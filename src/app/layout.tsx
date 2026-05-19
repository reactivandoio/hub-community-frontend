import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type React from 'react';
import { Toaster as SonnerToaster } from 'sonner';

import { PageTransitionProvider } from '@/components/animations';
import { ApolloProviderWrapper } from '@/components/apollo-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { FirebaseProvider } from '@/components/firebase-provider';
import { Footer } from '@/components/footer';
import { LogoutModalWrapper } from '@/components/logout-modal-wrapper';
import { Navigation } from '@/components/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AgendaProvider } from '@/contexts/agenda-context';
import { AuthProvider } from '@/contexts/auth-context';
import { FilterProvider } from '@/contexts/filter-context';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hub Community',
  description: 'A casa open source da sua comunidade',
  keywords: 'tecnologia, comunidades, eventos, programação, desenvolvimento',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/logo-square.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hub Community',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={inter.className}>
        <FirebaseProvider>
          <ApolloProviderWrapper>
            <AuthProvider>
              <LogoutModalWrapper />
              <AgendaProvider>
                <FilterProvider>
                  <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                  >
                    <Navigation />
                    <ErrorBoundary>
                      <PageTransitionProvider>
                        {children}
                      </PageTransitionProvider>
                    </ErrorBoundary>
                    <Toaster />
                    <SonnerToaster richColors position="top-right" />
                    <Footer />
                  </ThemeProvider>
                </FilterProvider>
              </AgendaProvider>
            </AuthProvider>
          </ApolloProviderWrapper>
        </FirebaseProvider>
      </body>
    </html>
  );
}

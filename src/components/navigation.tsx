'use client';

import { Calendar, Home, Info, LogIn, LogOut, Menu, Users, CalendarDays, User, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { useLoginPrompt } from '@/contexts/login-prompt-context';

const ADMIN_EMAILS = [
  'gleidson10daniel@hotmail.com',
  'fjrleao@gmail.com',
  'lucashenriqueblemos@gmail.com',
  'marcelo@softprime.com.br',
  'marcus.vinicius.marques@hotmail.com',
  'pedrogoiania95@gmail.com',
  'pedrogoiania95',
];

function NavigationContent() {
  const pathname = usePathname();
  const { isAuthenticated, user, signOut } = useAuth();
  // Old ?login=true&redirect= links are handled by the LoginPrompt provider (REA-25).
  const { requestLogin } = useLoginPrompt();
  const openLogin = () => requestLogin();

  const handleSignOut = () => {
    signOut();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Navigation - floating bottom bar */}
      <nav className="hidden md:block fixed bottom-4 left-4 right-4 z-50 pwa-bottom-offset">
        <div className="container mx-auto max-w-6xl bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-lg shadow-black/5 dark:shadow-black/20 border border-border/50 rounded-2xl px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo-horizontal-raw.png"
                alt="Hub Community"
                width={200}
                height={40}
                priority
                className="h-8 w-auto"
              />
            </Link>

            {/* Desktop Menu */}
            <div className="flex items-center space-x-8">
              <Link
                href="/"
                className={`transition-colors ${isActive('/') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
              >
                Início
              </Link>
              <Link
                href="/communities"
                className={`transition-colors ${isActive('/communities') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
              >
                Comunidades
              </Link>
              <Link
                href="/events"
                className={`transition-colors ${isActive('/events') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
              >
                Eventos
              </Link>
              <Link
                href="/about"
                className={`transition-colors ${isActive('/about') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
              >
                Sobre
              </Link>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center space-x-4">
              <ModeToggle />
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 relative">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline-block">
                        {user?.name || user?.username || 'Perfil'}
                      </span>
                      {!user?.phone && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    {user?.email && ADMIN_EMAILS.includes(user.email) && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/events" className="cursor-pointer">
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>Gerenciar Eventos</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/speakers" className="cursor-pointer">
                            <Users className="mr-2 h-4 w-4" />
                            <span>Gerenciar Palestrantes</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/voting-sessions" className="cursor-pointer">
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>Gerenciar Sessões</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-500 focus:text-red-500 cursor-pointer"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" onClick={openLogin}>
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - floating bottom icon bar */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border border-border/50 rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 safe-area-bottom pwa-bottom-offset">
        <div className="flex items-center justify-around h-14">
          <Link
            href="/"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              isActive('/') ? 'text-primary bg-primary/10' : 'text-muted-foreground'
            }`}
          >
            <Home className="h-6 w-6" />
          </Link>

          <Link
            href="/communities"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              isActive('/communities') ? 'text-primary bg-primary/10' : 'text-muted-foreground'
            }`}
          >
            <Users className="h-6 w-6" />
          </Link>

          <Link
            href="/events"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              isActive('/events') ? 'text-primary bg-primary/10' : 'text-muted-foreground'
            }`}
          >
            <CalendarDays className="h-6 w-6" />
          </Link>

          <Link
            href="/about"
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              isActive('/about') ? 'text-primary bg-primary/10' : 'text-muted-foreground'
            }`}
          >
            <Info className="h-6 w-6" />
          </Link>

          {isAuthenticated ? (
            <Link
              href="/profile"
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                isActive('/profile') ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              }`}
            >
              <User className="h-6 w-6" />
              {!user?.phone && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              aria-label="Entrar"
              className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors text-muted-foreground"
            >
              <LogIn className="h-6 w-6" />
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

export function Navigation() {
  return (
    <Suspense>
      <NavigationContent />
    </Suspense>
  );
}

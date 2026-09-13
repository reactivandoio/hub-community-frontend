'use client';

import { Cookie, Lock, BarChart3, Shield } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface CookieSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

export function CookieSettingsModal({
  open,
  onOpenChange,
  onAccept,
}: CookieSettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Configurações de Cookies
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            O Hub Community utiliza cookies e tecnologias similares para
            garantir o funcionamento da plataforma e melhorar sua experiência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Essential Cookies */}
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-emerald-500" />
                </div>
                <h4 className="font-semibold text-sm">Cookies Essenciais</h4>
              </div>
              <Badge
                variant="secondary"
                className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                Sempre Ativos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Necessários para o funcionamento básico da plataforma.
              Incluem dados de autenticação (Firebase Auth), preferência de tema
              e configurações essenciais da sessão.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Badge variant="outline" className="text-xs font-mono">
                auth_token
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                auth_user
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                theme
              </Badge>
            </div>
          </div>

          {/* Analytics Cookies */}
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </div>
                <h4 className="font-semibold text-sm">
                  Cookies de Analytics
                </h4>
              </div>
              <Badge
                variant="secondary"
                className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
              >
                Obrigatórios
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Utilizamos o <strong>Firebase Analytics</strong> e o{' '}
              <strong>Google Analytics</strong> para entender como os usuários
              interagem com a plataforma, permitindo melhorias contínuas na
              experiência. Também realizamos rastreamento interno de eventos na
              plataforma.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Badge variant="outline" className="text-xs font-mono">
                _ga
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                _gid
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                _gat
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                Firebase
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Notice */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2.5">
              <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Para utilizar o Hub Community, é necessário aceitar todos os
                cookies listados acima. Caso não concorde com o uso dessas
                tecnologias, a alternativa é não utilizar a plataforma. Para
                mais detalhes, consulte nossa{' '}
                <Link
                  href="/cookies"
                  className="text-primary hover:underline font-medium"
                >
                  Política de Cookies
                </Link>
                ,{' '}
                <Link
                  href="/privacy"
                  className="text-primary hover:underline font-medium"
                >
                  Política de Privacidade
                </Link>{' '}
                e{' '}
                <Link
                  href="/terms"
                  className="text-primary hover:underline font-medium"
                >
                  Termos de Uso
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onAccept}
            className="w-full rounded-xl font-semibold"
            size="lg"
          >
            Aceitar Todos os Cookies
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

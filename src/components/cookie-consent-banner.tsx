'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Cookie, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CookieSettingsModal } from '@/components/cookie-settings-modal';
import { Button } from '@/components/ui/button';
import { hasConsented, setConsent } from '@/lib/cookie-consent';

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Small delay to avoid layout shift on first paint
    const timer = setTimeout(() => {
      if (!hasConsented()) {
        setShowBanner(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    setConsent();
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
          >
            <div className="container mx-auto max-w-4xl">
              <div className="relative rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
                {/* Subtle gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

                <div className="relative px-6 py-5 md:px-8 md:py-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    {/* Icon + Text */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Cookie className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm mb-1">
                          Este site utiliza cookies
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                          O Hub Community utiliza cookies e tecnologias como{' '}
                          <strong>Firebase</strong> e{' '}
                          <strong>Google Analytics</strong> para melhorar sua
                          experiência e analisar o uso da plataforma. Ao
                          continuar navegando, você aceita o uso dessas
                          tecnologias. Leia nossa{' '}
                          <Link
                            href="/cookies"
                            className="text-primary hover:underline font-medium"
                          >
                            Política de Cookies
                          </Link>{' '}
                          para mais detalhes.
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2 shrink-0 ml-[52px] md:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1.5 text-xs bg-transparent"
                        onClick={handleOpenSettings}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Configurações
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl font-semibold text-xs"
                        onClick={handleAccept}
                      >
                        Aceitar e Continuar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CookieSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        onAccept={handleAccept}
      />
    </>
  );
}

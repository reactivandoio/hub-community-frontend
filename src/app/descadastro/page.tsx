'use client';

import { useMutation } from '@apollo/client';
import { CheckCircle, MailX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import { UNSUBSCRIBE_EMAIL } from '@/lib/queries';

// REA-29: the "Descadastrar" link of every campaign e-mail. Asks for a click before writing,
// so link scanners of mail providers do not unsubscribe anybody by opening the page. (Mail clients
// use the one-click POST at /api/email/unsubscribe instead.)
function UnsubscribeContent() {
  const token = useSearchParams()?.get('t') || '';
  const [unsubscribe, { data, loading, error }] = useMutation<{ unsubscribeEmail: boolean }>(UNSUBSCRIBE_EMAIL);
  const done = data?.unsubscribeEmail === true;
  const invalid = !token || data?.unsubscribeEmail === false;

  return (
    <div className="min-h-[70vh] bg-background flex items-center justify-center px-4 py-16">
      <FadeIn direction="up" duration={0.3}>
        <div className="max-w-md w-full text-center space-y-6">
          {done ? (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-primary" aria-hidden />
              <h1 className="text-2xl font-bold">Pronto, você foi descadastrado</h1>
              <p className="text-muted-foreground">
                Você não vai mais receber convites e lembretes de eventos por e-mail. Os e-mails da sua
                conta e das suas inscrições (confirmação, ingresso, certificado) continuam chegando.
              </p>
            </>
          ) : invalid ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden />
              <h1 className="text-2xl font-bold">Link inválido</h1>
              <p className="text-muted-foreground">
                Este link de descadastro não é válido. Use o link do e-mail mais recente ou escreva para
                contato@8020digital.com.br.
              </p>
            </>
          ) : (
            <>
              <MailX className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-bold">Não quer mais receber nossos e-mails?</h1>
              <p className="text-muted-foreground">
                Confirme para parar de receber convites e lembretes de eventos do Hub Community.
              </p>
              {error && <p className="text-sm text-destructive">Não foi possível descadastrar agora. Tente de novo.</p>}
              <Button onClick={() => unsubscribe({ variables: { token } }).catch(() => undefined)} disabled={loading}>
                {loading ? 'Descadastrando…' : 'Confirmar descadastro'}
              </Button>
            </>
          )}
          <p>
            <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
              Ir para o Hub Community
            </Link>
          </p>
        </div>
      </FadeIn>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}

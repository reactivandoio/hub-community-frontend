'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { QrCode } from 'lucide-react';
import { ticketUrl } from '@/lib/ticket';

interface SignupTicketQrProps {
  eventSlug: string;
  signupId: string;
}

/** The attendee's ticket: shown after signing up and on the "already signed up" page. */
export function SignupTicketQr({ eventSlug, signupId }: SignupTicketQrProps) {
  const value = ticketUrl(eventSlug, signupId);
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6" data-testid="signup-ticket-qr">
      <div className="flex items-center gap-2 justify-center mb-3">
        <QrCode className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Seu QR code de credenciamento</h3>
      </div>
      <div className="bg-white rounded-lg p-3 inline-block">
        <QRCodeCanvas value={value} size={192} level="M" includeMargin={false} aria-label="QR code da inscrição" />
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        Apresente este QR code na recepção ou no totem de credenciamento para retirar seu crachá.
      </p>
    </div>
  );
}

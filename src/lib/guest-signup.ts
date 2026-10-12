/**
 * REA-22: what the signup page says after a signup without login. The BFF decides
 * the case (`outcome`) and where the e-mail went (`confirmation_sent_to`: the
 * e-mail typed, or another account's masked as glad****@***ail.com). The person is
 * never signed in: creating the password, from the e-mail, confirms the account.
 */
export type GuestOutcome = 'NEW_ACCOUNT' | 'EXISTING_ACCOUNT' | 'CPF_OWNER' | 'ALREADY_SIGNED_UP';

export interface GuestSignupResult {
  success?: boolean | null;
  message?: string | null;
  is_free?: boolean | null;
  payment?: Record<string, unknown> | null;
  signup_id?: string | null;
  outcome?: GuestOutcome | string | null;
  confirmation_sent_to?: string | null;
}

export interface GuestNotice {
  title: string;
  body: string;
  /** The person's own signup: ticket QR, calendar and the rest of the success screen. */
  ownSignup: boolean;
}

export const CERTIFICATE_NOTE =
  'Para receber o certificado do evento, conclua seu cadastro criando sua senha pelo link do e-mail.';

/** Where the page goes next: the Pix step only for the person's own paid signup. */
export function guestNextStep(result: GuestSignupResult): 'payment' | 'success' {
  const own = result.outcome !== 'CPF_OWNER' && result.outcome !== 'ALREADY_SIGNED_UP';
  return own && result.is_free === false && result.payment ? 'payment' : 'success';
}

export function guestNotice(result: GuestSignupResult, typedEmail: string): GuestNotice {
  const sentTo = result.confirmation_sent_to || typedEmail;
  switch (result.outcome) {
    case 'CPF_OWNER':
      return {
        title: 'Inscrição feita na conta deste CPF',
        body:
          result.message ||
          `Este CPF já tem cadastro. A inscrição foi feita nessa conta e a confirmação foi enviada para ${sentTo}.`,
        ownSignup: false,
      };
    case 'ALREADY_SIGNED_UP':
      return {
        title: 'Este CPF já está inscrito',
        body: result.message || `Enviamos de novo a confirmação para ${sentTo}.`,
        ownSignup: false,
      };
    case 'EXISTING_ACCOUNT':
      return {
        title: 'Inscrição Confirmada! 🎉',
        body: `Enviamos a confirmação para ${sentTo}. Verifique também a caixa de spam.`,
        ownSignup: true,
      };
    default:
      return {
        title: 'Inscrição Confirmada! 🎉',
        body: `Enviamos seu ingresso e o link para criar sua senha para ${sentTo}. Verifique também a caixa de spam.`,
        ownSignup: true,
      };
  }
}

/** `?pagamento=<signup id>` from the "Finalize sua inscrição" e-mail: digits only. */
export function paymentParam(value: string | null | undefined): string | null {
  const id = String(value || '').trim();
  return /^[1-9]\d{0,11}$/.test(id) ? id : null;
}

import { redirect } from 'next/navigation';

/**
 * REA-26: there is no password any more (login by a code sent to the e-mail). Links of old e-mails
 * ("Crie sua senha", "Recuperar senha") land on the complete-registration page, which opens the
 * login and then asks for whatever the profile still lacks.
 */
export default function PasswordLinkPage() {
  redirect('/completar-cadastro');
}

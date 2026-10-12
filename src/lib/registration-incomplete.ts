/**
 * REA-22: the certificate only goes out with the registration finished — password
 * created and CPF, date of birth and WhatsApp on the profile. The BFF refuses with
 * the code REGISTRATION_INCOMPLETE; `missing` only comes to the account's own
 * signed-in owner.
 */
export const REGISTRATION_INCOMPLETE = 'REGISTRATION_INCOMPLETE';

export interface RegistrationIncomplete {
  passwordPending: boolean;
  missing: string[] | null;
}

interface WithGraphQLErrors {
  graphQLErrors?: ReadonlyArray<{ extensions?: Record<string, unknown> }>;
}

export function registrationIncomplete(err: unknown): RegistrationIncomplete | null {
  const ext = (err as WithGraphQLErrors | undefined)?.graphQLErrors?.find(
    (e) => e?.extensions?.code === REGISTRATION_INCOMPLETE,
  )?.extensions;
  if (!ext) return null;
  return {
    passwordPending: ext.password_pending === true,
    missing: Array.isArray(ext.missing) ? (ext.missing as string[]) : null,
  };
}

// REA-6: the frontend may reach production before the Eventando and the BFF that
// know about Opa Pingou, coupons in cents and the signup CPF. Every new path asks
// the BFF first: a schema that lacks `signupPaymentStatus` means the old server,
// and the page keeps today's behaviour (prices as typed, no CPF, no Cupons tab).

interface ProbeError {
  graphQLErrors?: ReadonlyArray<{ message?: string; extensions?: Record<string, unknown> }>;
  networkError?: unknown;
}

interface ProbeResult {
  loading: boolean;
  data?: unknown;
  error?: ProbeError | null;
}

function isSchemaError(err: { message?: string; extensions?: Record<string, unknown> }): boolean {
  return (
    err?.extensions?.code === 'GRAPHQL_VALIDATION_FAILED' ||
    /Cannot query field|Unknown argument/i.test(err?.message || '')
  );
}

interface TypeFieldsProbe {
  __type?: { fields?: ReadonlyArray<{ name: string }> | null } | null;
}

/** REA-16: whether a GraphQL type lists a field. null while asking; an error means no. */
export function typeHasField(
  { loading, data, error }: ProbeResult,
  field: string,
): boolean | null {
  if (loading && !data && !error) return null;
  if (error) return false;
  return !!(data as TypeFieldsProbe | undefined)?.__type?.fields?.some((f) => f.name === field);
}

/** true = new BFF, false = old (or unreachable) BFF, null = still asking. */
export function paymentsV2FromProbe({ loading, data, error }: ProbeResult): boolean | null {
  if (loading && !data && !error) return null;
  if (!error) return true;
  const gqlErrors = error.graphQLErrors || [];
  const networkErrors =
    ((error.networkError as { result?: { errors?: ProbeError['graphQLErrors'] } } | undefined)?.result
      ?.errors as ProbeError['graphQLErrors']) || [];
  if ([...gqlErrors, ...networkErrors].some(isSchemaError)) return false;
  // The field resolved with an error: the server knows it.
  if (gqlErrors.length > 0) return true;
  return false;
}

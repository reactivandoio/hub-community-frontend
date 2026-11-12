import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EVENT_PAYMENTS } from '@/lib/queries';

import { EventPaymentsCard } from '../event-payments-card';

const row = (overrides: Record<string, unknown>) => ({
  email: 'a@x.io',
  name: null,
  status: 'CONFIRMED',
  value: 5000,
  expires_at: null,
  manual_approved: null,
  manual_approved_at: null,
  manual_approved_by: null,
  ...overrides,
});

describe('EventPaymentsCard (REA-34)', () => {
  it('counts manual approvals apart and keeps them out of the money', async () => {
    render(
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: { query: EVENT_PAYMENTS, variables: { slugOrId: 'meetup' } },
            result: {
              data: {
                eventPayments: [
                  row({ email: 'pago@x.io' }),
                  row({ email: 'manual@x.io', manual_approved: true, manual_approved_by: 'Pedro' }),
                ],
              },
            },
          },
        ]}
      >
        <EventPaymentsCard slugOrId="meetup" />
      </MockedProvider>,
    );
    expect(await screen.findByText(/R\$\s50,00 recebidos/)).toBeInTheDocument();
    const manual = screen.getByText('Aprovada manualmente').parentElement as HTMLElement;
    expect(manual).toHaveTextContent('1');
    expect((screen.getByText('Pago').parentElement as HTMLElement)).toHaveTextContent('1');
  });
});

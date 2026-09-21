import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import {
  GET_CERTIFICATE_CANDIDATES,
  GET_CERTIFICATE_REQUEST_FORMS,
  ISSUE_CERTIFICATES,
} from '@/lib/queries';
import { CertificateIssueTable } from '../certificate-issue-table';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const candidate = (name: string, email: string, cpf: string) => ({
  __typename: 'CertificateCandidate',
  key: cpf,
  name,
  email,
  identifier: cpf,
  phone: '',
  sources: ['REQUEST'],
  checked_in: false,
  certificate: null,
});

const formsMock: MockedResponse = {
  request: { query: GET_CERTIFICATE_REQUEST_FORMS, variables: { eventId: 'e1' } },
  result: {
    data: {
      certificateRequestForms: [
        {
          __typename: 'CertificateRequestForm',
          id: 'f1',
          title: 'Certificado de mentoria',
          category: 'Mentor',
          slug: 'summit-mentor',
          description: null,
          enabled: true,
          submissions: 1,
        },
      ],
    },
  },
};

const candidatesMock = (category: string, rows: unknown[]): MockedResponse => ({
  request: { query: GET_CERTIFICATE_CANDIDATES, variables: { eventId: 'e1', category } },
  result: { data: { certificateCandidates: rows } },
});

const PARTICIPANTE = candidate('Ana Participante', 'ana@x.com', '52998224725');
const MENTOR = candidate('Bruno Mentor', 'bruno@x.com', '11144477735');

const renderIt = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks}>
      <CertificateIssueTable eventId="e1" eventSlug="summit" />
    </MockedProvider>,
  );

// Names of rows without a certificate are editable inputs, and the card title is split across
// elements by the count, so both need a matcher of their own.
const row = (name: string) => screen.findByDisplayValue(name);
const cardTitle = (text: string) =>
  screen.getByText((_, el) => el?.className?.includes?.('text-2xl') && el?.textContent === text);

const pickList = async (label: string) => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Lista' }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};

beforeEach(() => {
  mockToast.mockClear();
});

describe('CertificateIssueTable', () => {
  it('opens on the participante list', async () => {
    renderIt([formsMock, candidatesMock('Participante', [PARTICIPANTE])]);

    expect(await row('Ana Participante')).toBeInTheDocument();
    expect(cardTitle('Participante (1)')).toBeInTheDocument();
  });

  it('offers one list per request form category and loads the chosen one', async () => {
    renderIt([
      formsMock,
      candidatesMock('Participante', [PARTICIPANTE]),
      candidatesMock('Mentor', [MENTOR]),
    ]);

    await row('Ana Participante');
    await pickList('Mentor');

    expect(await row('Bruno Mentor')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ana Participante')).not.toBeInTheDocument();
    expect(cardTitle('Mentor (1)')).toBeInTheDocument();
  });

  it('issues the selected list under its own category', async () => {
    const issueMock: MockedResponse = {
      request: {
        query: ISSUE_CERTIFICATES,
        variables: {
          eventId: 'e1',
          category: 'Mentor',
          entries: [{ name: 'Bruno Mentor', identifier: '11144477735', email: 'bruno@x.com' }],
          actions: { register: true, email: false },
        },
      },
      result: {
        data: {
          issueCertificates: {
            __typename: 'IssueResult',
            issued: 1,
            emailed: 0,
            errors: [],
            certificates: [
              { __typename: 'Certificate', code: 'RCT-AAAAAAAA', identifier: '11144477735', sent_at: null },
            ],
          },
        },
      },
    };
    renderIt([
      formsMock,
      candidatesMock('Participante', [PARTICIPANTE]),
      candidatesMock('Mentor', [MENTOR]),
      issueMock,
      candidatesMock('Mentor', [MENTOR]),
    ]);

    await row('Ana Participante');
    await pickList('Mentor');
    await row('Bruno Mentor');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Bruno Mentor' }));
    await userEvent.click(screen.getByRole('button', { name: /Emitir/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Emissão concluída' }),
      ),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CERTIFICATE_CONFIGS, COPY_CERTIFICATE_CONFIG } from '@/lib/queries';
import { CopyCertificateModel } from '../copy-certificate-model';

// ─── Mocks ────────────────────────────────────────────────────────

// The real preview renders a PDF into a canvas (pdf.js); the test only needs to know
// which config it was given, and with which event.
vi.mock('next/dynamic', () => ({
  default: () => (props: { config: { title?: string | null }; event: { title: string }; certificate: { name: string } }) => (
    <div data-testid="preview">
      {props.config.title} @ {props.event.title} / {props.certificate.name}
    </div>
  ),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

// ─── Fixtures ─────────────────────────────────────────────────────

// The query reads `config` through a fragment, so the cache needs __typename to match it.
const config = (title: string) => ({
  __typename: 'CertificateConfig',
  id: `cfg-${title}`,
  enabled: true,
  allow_self_request: false,
  title,
  body_template: null,
  workload_hours: null,
  issuer_name: null,
  primary_color: '#8B5CF6',
  logo: null,
  logo_id: null,
  background: null,
  background_id: null,
  sponsors: [],
  signatures: [],
});

const summary = (id: string, slug: string, title: string, start_date: string | null, model: string) => ({
  __typename: 'CertificateConfigSummary',
  event: { __typename: 'CertificateConfigEvent', id, slug, title, start_date },
  config: config(model),
});

const listMock: MockedResponse = {
  request: { query: CERTIFICATE_CONFIGS },
  result: {
    data: {
      certificateConfigs: [
        summary('e-new', 'summit-2026', 'React Summit 2026', '2026-08-01T12:00:00.000Z', 'Modelo Summit'),
        summary('e-this', 'this-event', 'Este evento', '2026-09-01T12:00:00.000Z', 'Modelo atual'),
        summary('e-old', 'meetup-2025', 'Meetup 2025', '2025-03-01T12:00:00.000Z', 'Modelo Meetup'),
      ],
    },
  },
};

const thisEvent = { title: 'Este evento', start_date: '2026-09-01T12:00:00.000Z', end_date: '2026-09-01T20:00:00.000Z' };

const renderIt = (mocks: MockedResponse[], onCopied = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks}>
      <CopyCertificateModel eventId="e-this" event={thisEvent} onCopied={onCopied} />
    </MockedProvider>,
  );
  return onCopied;
};

beforeEach(() => vi.clearAllMocks());

// ─── Tests ────────────────────────────────────────────────────────

describe('CopyCertificateModel', () => {
  it('lists the events that have a model, except the current one', async () => {
    renderIt([listMock]);
    await userEvent.click(await screen.findByRole('combobox', { name: /copiar modelo de outro evento/i }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText(/React Summit 2026/)).toBeInTheDocument();
    expect(within(listbox).getByText(/Meetup 2025/)).toBeInTheDocument();
    expect(within(listbox).queryByText(/Este evento/)).not.toBeInTheDocument();
  });

  it('previews the chosen model with the current event and enables Copiar', async () => {
    renderIt([listMock]);
    const copy = await screen.findByRole('button', { name: /copiar/i });
    expect(copy).toBeDisabled();
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: /copiar modelo de outro evento/i }));
    await userEvent.click(await screen.findByText(/Meetup 2025/));

    expect(await screen.findByTestId('preview')).toHaveTextContent('Modelo Meetup @ Este evento / Nome do Participante');
    expect(copy).toBeEnabled();
  });

  it('copies the chosen model into this event and reports the new config', async () => {
    const copied = config('Modelo Meetup');
    const copyMock: MockedResponse = {
      request: { query: COPY_CERTIFICATE_CONFIG, variables: { fromEventId: 'e-old', toEventId: 'e-this' } },
      result: { data: { copyCertificateConfig: copied } },
    };
    const onCopied = renderIt([listMock, copyMock]);
    await userEvent.click(await screen.findByRole('combobox', { name: /copiar modelo de outro evento/i }));
    await userEvent.click(await screen.findByText(/Meetup 2025/));
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledWith(copied));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Modelo copiado' }));
  });

  it('says so when no other event has a model yet', async () => {
    const only: MockedResponse = {
      request: { query: CERTIFICATE_CONFIGS },
      result: { data: { certificateConfigs: [summary('e-this', 's', 'Este evento', null, 'x')] } },
    };
    renderIt([only]);
    expect(await screen.findByText(/nenhum outro evento tem modelo/i)).toBeInTheDocument();
  });
});

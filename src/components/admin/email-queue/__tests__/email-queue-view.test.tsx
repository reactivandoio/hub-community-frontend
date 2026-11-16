import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UPDATE_EMAIL_CAMPAIGN_STATUS } from '@/lib/queries';
import type { AdminEmailQueue } from '@/lib/types';

import { EmailQueueView } from '../email-queue-view';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const NOW = new Date('2026-11-16T15:00:00Z');

const queue: AdminEmailQueue = {
  sending_enabled: true,
  redirect_to: null,
  usage: { sent_today: 120, sent_this_month: 1540, daily_limit: 300, monthly_limit: 3000, reserve: 80, campaigns_left_today: 100 },
  campaigns: [
    {
      id: 'c1', event_slug: 'meetup', event_title: 'Meetup', type: 'reminder', subject: 'Lembrete', status: 'sending',
      total: 500, sent: 100, failed: 2, remaining: 398, finish_date: '2026-11-18',
    },
    {
      id: 'c2', event_slug: 'sw', event_title: 'SW', type: 'invite', subject: 'Convite', status: 'paused',
      total: 900, sent: 0, failed: 0, remaining: 900, finish_date: null,
    },
  ],
  schedule: [
    { date: '2026-11-16', count: 100, campaigns: [{ id: 'c1', count: 100 }] },
    { date: '2026-11-17', count: 220, campaigns: [{ id: 'c1', count: 220 }] },
  ],
  schedule_truncated: false,
  dob_requests: {
    total: 1, page: 1, pageSize: 50, emailsLeftToday: 100,
    items: [{ id: '9', username: 'ana', email: 'ana@x.io', name: 'Ana', requestedAt: '2026-11-14T13:00:00Z', deadline: '2026-11-21T13:00:00Z' } as never],
  },
};

const renderView = (mocks: MockedResponse[] = [], onChanged = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <EmailQueueView queue={queue} onChanged={onChanged} now={NOW} />
    </MockedProvider>,
  );
  return onChanged;
};

describe('EmailQueueView (REA-59)', () => {
  it('lists the queue of every event with totals and the forecast', () => {
    renderView();
    const row = screen.getByRole('link', { name: 'Meetup' }).closest('tr') as HTMLElement;
    expect(row).toHaveAttribute('class');
    expect(within(row).getByText('Lembrete do evento')).toBeInTheDocument();
    expect(within(row).getByText('398')).toBeInTheDocument();
    expect(within(row).getByText('Termina qua., 18/11')).toBeInTheDocument();
    expect(screen.getByText('Pausada: sem previsão')).toBeInTheDocument();
    expect(screen.getByText('hoje, 16/11')).toBeInTheDocument();
    expect(screen.getByText('120 de 300 hoje')).toBeInTheDocument();
    expect(screen.getByText('1.540 de 3.000 no mês')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/admin/usuarios/9');
  });

  it('pauses and resumes with the existing per-event action', async () => {
    const result = vi.fn(() => ({ data: { updateEmailCampaignStatus: null } }));
    const onChanged = renderView([{
      request: { query: UPDATE_EMAIL_CAMPAIGN_STATUS, variables: { eventSlug: 'meetup', id: 'c1', action: 'pause' } },
      result,
    }]);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar Lembrete do evento de Meetup' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(result).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retomar Convite para o evento de SW' })).toBeInTheDocument();
  });

  it('asks before cancelling', async () => {
    const result = vi.fn(() => ({ data: { updateEmailCampaignStatus: null } }));
    const onChanged = renderView([{
      request: { query: UPDATE_EMAIL_CAMPAIGN_STATUS, variables: { eventSlug: 'meetup', id: 'c1', action: 'cancel' } },
      result,
    }]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Lembrete do evento de Meetup' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('398 e-mails que faltam');
    expect(result).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar campanha' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('warns when the queue is off', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EmailQueueView queue={{ ...queue, sending_enabled: false }} onChanged={vi.fn()} now={NOW} />
      </MockedProvider>,
    );
    expect(screen.getByText(/envio de campanhas está desligado/)).toBeInTheDocument();
  });
});

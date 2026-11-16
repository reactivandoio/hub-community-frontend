import { describe, expect, it } from 'vitest';

import {
  adminUserHref, ageReviewLabel, emailEventLabel, emailKindLabel, emailOutcome, formatDateBR, formatDateTimeBR,
} from '../admin-user';
import { adminBreadcrumbs } from '../admin-nav';

describe('admin user page (REA-52)', () => {
  it('links and breadcrumb', () => {
    expect(adminUserHref(9)).toBe('/admin/usuarios/9');
    expect(adminBreadcrumbs('/admin/usuarios/9').map((c) => c.label)).toEqual(['Admin', 'Usuários', 'Usuário']);
    expect(adminBreadcrumbs('/admin/usuarios/idade').map((c) => c.label)).toEqual(['Admin', 'Usuários', 'Idade (18+)']);
  });

  it('names kinds and Mailgun events in Portuguese', () => {
    expect(emailKindLabel('login-code')).toBe('Código de login');
    expect(emailKindLabel('sw-form')).toBe('Formulário Startup Weekend');
    expect(emailKindLabel('novo-tipo')).toBe('novo-tipo');
    expect(emailKindLabel(null)).toBe('E-mail');
    expect(emailEventLabel({ event: 'failed', severity: 'permanent' })).toBe('Devolvido (falha permanente)');
    expect(emailEventLabel({ event: 'failed', severity: 'temporary' })).toBe('Falha temporária (nova tentativa)');
    expect(emailEventLabel({ event: 'complained' })).toBe('Marcado como spam');
  });

  it('sums up each e-mail by the most telling event', () => {
    expect(emailOutcome({ status: 'sent', events: [] })).toEqual({ label: 'Enviado', tone: 'neutral' });
    expect(emailOutcome({ status: 'failed', error: '421' })).toEqual({ label: 'Não enviado', tone: 'bad' });
    expect(emailOutcome({ status: 'sent', events: [{ event: 'delivered' }, { event: 'opened' }] }).label).toBe('Aberto');
    expect(emailOutcome({ status: 'sent', events: [{ event: 'opened' }, { event: 'clicked' }] }).label).toBe('Clicado');
    expect(emailOutcome({ status: 'sent', events: [{ event: 'failed', severity: 'temporary' }] }).label).toBe('Falha temporária');
    expect(emailOutcome({ status: 'sent', events: [{ event: 'failed', severity: 'temporary' }, { event: 'delivered' }] }).label)
      .toBe('Entregue');
    expect(emailOutcome({ status: 'sent', events: [{ event: 'delivered' }, { event: 'complained' }] }))
      .toEqual({ label: 'Marcado como spam', tone: 'bad' });
    expect(emailOutcome({ status: 'sent', events: [{ event: 'failed', severity: 'permanent' }] }).label).toBe('Devolvido');
  });

  it('formats dates in Brasília time and birth dates without shifting the day', () => {
    expect(formatDateTimeBR('2026-11-16T13:30:00.000Z')).toBe('16/11/2026 10:30');
    expect(formatDateTimeBR(null)).toBe('—');
    expect(formatDateBR('1990-05-17')).toBe('17/05/1990');
    expect(formatDateBR(null)).toBe('—');
    expect(ageReviewLabel('minor_blocked')).toBe('Desativado: menor de idade');
    expect(ageReviewLabel(null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { isAdminOnlyPath } from '../admin-access';
import { finishLabel, formatQueueDay, percentOf, todaySaoPaulo, usageLines } from '../email-queue';

describe('E-mails agendados (REA-59)', () => {
  it('is admin only', () => {
    expect(isAdminOnlyPath('/admin/emails')).toBe(true);
  });

  it('names the days in São Paulo time', () => {
    expect(todaySaoPaulo(new Date('2026-11-17T02:30:00Z'))).toBe('2026-11-16');
    expect(formatQueueDay('2026-11-17')).toBe('ter., 17/11');
    expect(formatQueueDay('2026-11-16', '2026-11-16')).toBe('hoje, 16/11');
    expect(formatQueueDay(null)).toBe('—');
  });

  it('shows the usage of the day and of the month', () => {
    const lines = usageLines({
      sent_today: 120, sent_this_month: 1540, daily_limit: 300, monthly_limit: 3000, reserve: 80, campaigns_left_today: 100,
    });
    expect(lines.today).toBe('120 de 300 hoje');
    expect(lines.month).toBe('1.540 de 3.000 no mês');
    expect(lines.campaigns).toMatch(/ainda podem enviar 100 hoje \(80 ficam reservados/);
    expect(usageLines({
      sent_today: 0, sent_this_month: 5, daily_limit: 300, monthly_limit: null, reserve: 80, campaigns_left_today: 220,
    }).month).toBe('5 no mês (sem limite mensal)');
    expect(percentOf(150, 300)).toBe(50);
    expect(percentOf(900, 300)).toBe(100);
    expect(percentOf(5, null)).toBe(0);
  });

  it('says when each campaign finishes, or why it has no forecast', () => {
    const on = { enabled: true, todayYmd: '2026-11-16' };
    expect(finishLabel({ status: 'sending', remaining: 40, finish_date: '2026-11-18' }, on)).toBe('Termina qua., 18/11');
    expect(finishLabel({ status: 'sending', remaining: 40, finish_date: '2026-11-16' }, on)).toBe('Termina hoje, 16/11');
    expect(finishLabel({ status: 'paused', remaining: 40, finish_date: null }, on)).toBe('Pausada: sem previsão');
    expect(finishLabel({ status: 'sending', remaining: 40, finish_date: null }, { enabled: false })).toBe('Envio desligado no servidor');
    expect(finishLabel({ status: 'sending', remaining: 40, finish_date: null }, on)).toBe('Além de 120 dias');
  });
});

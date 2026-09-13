import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  workloadHours,
  formatHours,
  formatDate,
  eventLocationLabel,
  buildTemplateVars,
  resolveBody,
  certificateFileName,
  normalizeIdentifier,
  isValidCpf,
  formatCpf,
  imageSrc,
  verifyUrl,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_BODY_TEMPLATE_NO_LOCATION,
} from '../certificate';

const event = {
  title: 'React Summit Goiânia',
  slug: 'react-summit-goiania',
  start_date: '2026-08-01T12:00:00.000Z',
  end_date: '2026-08-01T21:30:00.000Z',
  is_online: false,
  location: { title: 'Sebrae', city: 'Goiânia' },
  communities: [{ title: 'Reactivando' }],
};

describe('resolveTemplate', () => {
  it('replaces placeholders, tolerating inner spaces', () => {
    expect(resolveTemplate('Olá {{nome}} — {{ evento }}', { nome: 'Ana', evento: 'X' })).toBe('Olá Ana — X');
  });
  it('keeps unknown or missing placeholders literal', () => {
    expect(resolveTemplate('{{foo}} {{nome}}', {})).toBe('{{foo}} {{nome}}');
  });
});

describe('workloadHours', () => {
  it('prefers configured hours when > 0', () => {
    expect(workloadHours({ workload_hours: 6 }, event)).toBe(6);
  });
  it('derives from dates, rounding up, minimum 1', () => {
    expect(workloadHours({ workload_hours: null }, event)).toBe(10); // 9h30 → 10
    expect(workloadHours({}, { ...event, end_date: '2026-08-01T12:20:00.000Z' })).toBe(1);
  });
});

describe('formatHours / formatDate', () => {
  it('formats decimals with comma', () => {
    expect(formatHours(8)).toBe('8');
    expect(formatHours(1.5)).toBe('1,5');
  });
  it('formats dates in São Paulo timezone', () => {
    expect(formatDate('2026-08-02T01:00:00.000Z')).toBe('01/08/2026');
  });
});

describe('eventLocationLabel', () => {
  it('uses "online" for online events', () => {
    expect(eventLocationLabel({ ...event, is_online: true })).toBe('online');
  });
  it('joins title and city', () => {
    expect(eventLocationLabel(event)).toBe('Sebrae, Goiânia');
  });
  it('is empty without location', () => {
    expect(eventLocationLabel({ ...event, location: null })).toBe('');
  });
});

describe('buildTemplateVars / resolveBody', () => {
  it('builds every placeholder', () => {
    expect(buildTemplateVars({ config: { workload_hours: 8 }, event, name: 'Ana' })).toEqual({
      nome: 'Ana',
      evento: 'React Summit Goiânia',
      carga_horaria: '8',
      data_inicio: '01/08/2026',
      data_fim: '01/08/2026',
      local: 'Sebrae, Goiânia',
      comunidade: 'Reactivando',
    });
  });
  it('uses the default template with location', () => {
    expect(resolveBody({}, event, 'Ana')).toBe(
      'Certificamos que Ana participou do evento React Summit Goiânia, realizado em Sebrae, Goiânia de 01/08/2026 a 01/08/2026, com carga horária de 10 horas.',
    );
  });
  it('omits the location clause when there is none', () => {
    expect(resolveBody({}, { ...event, location: null }, 'Ana')).toBe(
      'Certificamos que Ana participou do evento React Summit Goiânia, de 01/08/2026 a 01/08/2026, com carga horária de 10 horas.',
    );
    expect(DEFAULT_BODY_TEMPLATE).toContain('{{local}}');
    expect(DEFAULT_BODY_TEMPLATE_NO_LOCATION).not.toContain('{{local}}');
  });
  it('uses the custom template when present', () => {
    expect(resolveBody({ body_template: 'X {{nome}}' }, event, 'Ana')).toBe('X Ana');
  });
});

describe('certificateFileName', () => {
  it('slugifies event and name', () => {
    expect(certificateFileName(event, 'Maria José da Silva')).toBe('certificado-react-summit-goiania-maria-jose-da-silva.pdf');
  });
  it('falls back to the title when there is no slug', () => {
    expect(certificateFileName({ title: 'Meetup #3' }, 'Ana')).toBe('certificado-meetup-3-ana.pdf');
  });
});

describe('cpf helpers', () => {
  it('normalizes, validates and formats', () => {
    expect(normalizeIdentifier('529.982.247-25')).toBe('52998224725');
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529')).toBe('529');
  });
  it('formatCpf leaves an e-mail identifier untouched', () => {
    expect(formatCpf('ana.silva@example.com')).toBe('ana.silva@example.com');
    expect(formatCpf('')).toBe('');
  });
});

describe('imageSrc / verifyUrl', () => {
  it('proxies in the browser and passes through on the server', () => {
    const url = 'https://manager.hubcommunity.io/uploads/a.png';
    expect(imageSrc(url, { server: false })).toBe(`/api/og-image?url=${encodeURIComponent(url)}`);
    expect(imageSrc(url, { server: true })).toBe(url);
    expect(imageSrc(null, { server: true })).toBeUndefined();
  });
  it('builds the verification url', () => {
    expect(verifyUrl('RCT-AAAAAAAA', 'https://hubcommunity.io')).toBe('https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA');
  });
});

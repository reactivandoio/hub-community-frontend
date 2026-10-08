import { describe, it, expect } from 'vitest';
import { badgeName, badgeNameFontPt, buildBadgeHtml } from '../badge-print';

const baseData = {
  fullName: 'João Silva',
  qrDataUrl: 'data:image/png;base64,FAKEQR',
  logoText: 'COMUNIDADE',
  link: 'https://linkedin.com/in/joaosilva',
};

describe('buildBadgeHtml', () => {
  it('matches snapshot for a normal badge', () => {
    expect(buildBadgeHtml(baseData)).toMatchSnapshot();
  });

  it('renders without a link when link is omitted', () => {
    const html = buildBadgeHtml({ ...baseData, link: undefined });
    expect(html).not.toContain('class="link-text"');
  });

  it('emits @page size 4in 2in matching the PPD-configured w4h2 page size', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).toContain('@page { size: 4in 2in; margin: 0; }');
  });

  it('sets body to 4in x 2in dimensions matching @page', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).toContain('width: 4in !important');
    expect(html).toContain('height: 2in !important');
  });

  it('does not rotate or absolutely position the badge container (PPD now handles orientation)', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).not.toContain('rotate(');
    expect(html).not.toContain('transform-origin:');
    expect(html).not.toContain('position: absolute');
  });

  it('sizes the badge container to fill the 4in x 2in page directly', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).toMatch(/\.badge-container\s*\{[^}]*width:\s*4in;[^}]*height:\s*2in;/);
  });

  it('no longer needs page-break-inside: avoid since the container matches the page exactly', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).not.toContain('page-break-inside');
    expect(html).not.toContain('break-inside');
  });

  it('clamps long names to 2 lines via -webkit-line-clamp', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).toContain('-webkit-line-clamp: 2');
  });

  it('escapes HTML special characters in user input', () => {
    const html = buildBadgeHtml({
      ...baseData,
      fullName: '<script>alert("xss")</script>',
      logoText: 'A & B',
      link: 'https://example.com/?a=1&b=2',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('a=1&amp;b=2');
  });

  it('does not inject an inline window.print() script (parent owns lifecycle)', () => {
    const html = buildBadgeHtml(baseData);
    expect(html).not.toContain('window.print()');
    expect(html).not.toContain('window.onload');
  });
});

describe('badgeName', () => {
  it('keeps first name and last surname', () => {
    expect(badgeName('AUGUSTO CESAR DA SILVA CRISÓSTOMO')).toBe('AUGUSTO CRISÓSTOMO');
    expect(badgeName('Maria Clara Souza')).toBe('Maria Souza');
  });

  it('keeps a single name or two names as they are', () => {
    expect(badgeName('Pedro')).toBe('Pedro');
    expect(badgeName('  João   Silva ')).toBe('João Silva');
  });

  it('skips trailing particles when picking the surname', () => {
    expect(badgeName('Ana Paula dos')).toBe('Ana Paula');
    expect(badgeName('José da')).toBe('José');
    expect(badgeName('Luiz Souza e Silva')).toBe('Luiz Silva');
    expect(badgeName('Carla De Souza DOS')).toBe('Carla Souza');
  });

  it('returns empty for a blank name', () => {
    expect(badgeName('   ')).toBe('');
  });
});

describe('badgeNameFontPt', () => {
  it('keeps 18pt when every word fits', () => {
    expect(badgeNameFontPt('AUGUSTO CRISÓSTOMO')).toBe(18);
  });

  it('shrinks for a long word, never below 10pt', () => {
    expect(badgeNameFontPt('MARIA WOLKENSTEINBERG')).toBe(14);
    expect(badgeNameFontPt('X'.repeat(40))).toBe(10);
  });
});

describe('buildBadgeHtml name', () => {
  it('prints the short name and keeps the full name in the job title', () => {
    const html = buildBadgeHtml({ ...baseData, fullName: 'Augusto Cesar da Silva Crisóstomo' });
    expect(html).toContain('<h1 class="name-text">Augusto Crisóstomo</h1>');
    expect(html).toContain('<title>Crachá - Augusto Cesar da Silva Crisóstomo</title>');
  });

  it('sets a smaller font inline when the name is too wide', () => {
    const html = buildBadgeHtml({ ...baseData, fullName: 'Maria Wolkensteinberg' });
    expect(html).toContain('<h1 class="name-text" style="font-size: 14pt">Maria Wolkensteinberg</h1>');
  });
});

import { describe, it, expect } from 'vitest';
import { buildBadgeHtml } from '../badge-print';

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

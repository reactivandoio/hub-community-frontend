export interface BadgePrintData {
  fullName: string;
  qrDataUrl: string;
  logoText: string;
  link?: string;
}

// Badge defaults when a station has nothing saved: a generic role and a QR to the
// event's "me inscrevi" art page.
export const DEFAULT_BADGE_NAME = 'PARTICIPANTE';
export const defaultBadgeLink = (eventSlug: string): string =>
  `https://hubcommunity.io/events/${eventSlug}/arte`;

const PRINT_TIMEOUT_MS = 1500;

// Connecting words that never stand alone as the surname.
const NAME_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * At most two names on the badge, so long names are never cut with "…": first name
 * plus the last real surname ("Augusto Cesar da Silva Crisóstomo" → "Augusto Crisóstomo").
 */
export function badgeName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] || '';
  const surname = words.slice(1).reverse().find((w) => !NAME_PARTICLES.has(w.toLowerCase()));
  return surname ? `${words[0]} ${surname}` : words[0];
}

// 18pt fits about 12 uppercase characters per line in the 60mm name column; a longer
// word gets a proportionally smaller font instead of being cut.
const NAME_FONT_PT = 18;
const NAME_FIT_CHARS = 12;
const NAME_MIN_FONT_PT = 10;

export function badgeNameFontPt(name: string): number {
  const longest = Math.max(0, ...name.split(/\s+/).map((w) => w.length));
  if (longest <= NAME_FIT_CHARS) return NAME_FONT_PT;
  return Math.max(NAME_MIN_FONT_PT, Math.floor((NAME_FONT_PT * NAME_FIT_CHARS) / longest));
}
// With Chrome's --kiosk-printing, print() and afterprint come back before the job is
// spooled; removing the iframe then cancels it (the dialog just flashes). Keep the
// iframe around long enough for the job to reach the printer — but no longer: while it
// exists the kiosk page stops responding to clicks, so a long delay froze the station.
const IFRAME_REMOVE_DELAY_MS = 8_000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildBadgeHtml(data: BadgePrintData): string {
  // The job title keeps the full name, so the print queue still identifies the person.
  const fullName = escapeHtml(data.fullName);
  const shortName = badgeName(data.fullName);
  const fontPt = badgeNameFontPt(shortName);
  const nameStyle = fontPt === NAME_FONT_PT ? '' : ` style="font-size: ${fontPt}pt"`;
  const logoText = escapeHtml(data.logoText);
  const link = data.link ? escapeHtml(data.link) : '';
  const qrDataUrl = data.qrDataUrl;

  // PPD modified to include w4h2 (4in x 2in = 288x144pt) matching the physical label.
  // Set via: lpoptions -p _4BARCODE_4B_2074A -o PageSize=w4h2
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Crachá - ${fullName}</title>
    <style>
      @page { size: 4in 2in; margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 4in !important;
        height: 2in !important;
        overflow: hidden !important;
        background: white;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .badge-container {
        width: 4in;
        height: 2in;
        padding: 3mm 4mm;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
        overflow: hidden;
      }
      .info-section {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        height: 100%;
        flex: 1;
        padding-right: 5mm;
        overflow: hidden;
      }
      .logo-text {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 1px;
        color: black;
        text-transform: uppercase;
      }
      .name-text {
        font-size: 18pt;
        font-weight: 900;
        text-transform: uppercase;
        margin: 0;
        line-height: 1.1;
        color: black;
        word-wrap: break-word;
        max-width: 60mm;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .link-text {
        font-size: 7.5pt;
        color: #000;
        margin: 0;
        word-break: break-all;
        max-width: 60mm;
        font-weight: 600;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .qr-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2mm;
      }
      .qr-image {
        display: block;
        width: 32mm;
        height: 32mm;
      }
      .separator {
        height: 2pt;
        width: 15mm;
        background: black;
        margin: 3mm 0;
      }
    </style>
  </head>
  <body>
    <div class="badge-container">
      <div class="info-section">
        <div class="logo-text">${logoText}</div>
        <div class="badge-main">
          <h1 class="name-text"${nameStyle}>${escapeHtml(shortName)}</h1>
          <div class="separator"></div>
          ${link ? `<p class="link-text">${link}</p>` : ''}
        </div>
      </div>
      <div class="qr-section">
        <img src="${qrDataUrl}" class="qr-image" alt="QR Code" />
      </div>
    </div>
  </body>
</html>`;
}

export function printBadge(data: BadgePrintData): Promise<void> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.pointerEvents = 'none';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = buildBadgeHtml(data);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setTimeout(() => iframe.remove(), IFRAME_REMOVE_DELAY_MS);
      resolve();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.addEventListener('afterprint', cleanup);
      win.focus();
      win.print();
      setTimeout(cleanup, PRINT_TIMEOUT_MS);
    };

    document.body.appendChild(iframe);
  });
}

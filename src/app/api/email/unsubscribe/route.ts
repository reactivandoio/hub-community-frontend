import { NextRequest, NextResponse } from 'next/server';

import { unsubscribeByToken } from '@/lib/email-unsubscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-click unsubscribe (RFC 8058) of the campaign e-mails (REA-29): the `List-Unsubscribe`
 * header points here and mail clients POST `List-Unsubscribe=One-Click`. The token is checked by
 * the BFF. GET is not accepted: opening a link must never unsubscribe (that is /descadastro).
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') || '';
  try {
    const ok = await unsubscribeByToken(token);
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}

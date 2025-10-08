export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession(request);
    return NextResponse.json({ ok: true, user });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
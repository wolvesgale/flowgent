import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { NextRequest, NextResponse } from 'next/server';

import { sessionOptions, type SessionData } from '@/lib/session';

/**
 * Ensures the current request is authenticated as an admin user.
 * Throws an Error with message "Unauthorized" when no valid session exists,
 * and "Forbidden" when the logged-in user is not an admin.
 */
export async function requireAdminOrThrow() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session?.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized');
  }

  if (session.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }

  return session;
}

/**
 * API 専用の管理者チェック。失敗時は JSON 応答を返す。
 */
export async function requireAdminForApi(_req: NextRequest) {
  try {
    void _req;
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session?.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

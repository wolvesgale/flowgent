import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest, NextResponse } from 'next/server';

export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  role?: 'ADMIN' | 'CS';
};

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: 'flowgent-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_IN_SECONDS,
  },
};

function applySessionDefaults(session: IronSession<SessionData>) {
  if (!session.userId) {
    session.isLoggedIn = false;
    delete session.role;
    return session;
  }

  session.isLoggedIn = true;
  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return applySessionDefaults(session);
}

export function getIron(request: NextRequest, response: NextResponse) {
  return getIronSession<SessionData>(request, response, sessionOptions);
}

export async function requireAuth() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect('/login');
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();

  if (session.role !== 'ADMIN') {
    redirect('/');
  }

  return session;
}

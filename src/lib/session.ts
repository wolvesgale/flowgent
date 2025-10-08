import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { defaultSession, sessionOptions } from './session-config';
import type { SessionData } from './session-config';

export type { SessionData } from './session-config';

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }

  return session;
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session.isLoggedIn) {
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
import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
  role?: 'ADMIN' | 'CS';
  isLoggedIn?: boolean;
}

const defaultSession: SessionData = {
  isLoggedIn: false,
};

const DEFAULT_COOKIE_NAME = 'flowgent_session';
const LEGACY_COOKIE_NAME = 'flowgent-session';

function resolveSessionPassword() {
  const password = process.env.SESSION_PASSWORD;
  if (!password) {
    throw new Error('SESSION_PASSWORD is not configured.');
  }
  return password;
}

function resolveCookieName() {
  const configured = process.env.SESSION_COOKIE_NAME?.trim();
  if (configured?.length) {
    return configured;
  }
  return DEFAULT_COOKIE_NAME;
}

function buildSessionOptions(cookieName: string): SessionOptions {
  return {
    password: resolveSessionPassword(),
    cookieName,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };
}

async function readSessionForCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  cookieName: string,
) {
  return getIronSession<SessionData>(cookieStore, buildSessionOptions(cookieName));
}

export function getSessionOptions(): SessionOptions {
  return buildSessionOptions(resolveCookieName());
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookieName = resolveCookieName();
  const session = await readSessionForCookie(cookieStore, cookieName);

  if (!session.isLoggedIn) {
    const legacyCookiePresent =
      cookieName !== LEGACY_COOKIE_NAME && Boolean(cookieStore.get(LEGACY_COOKIE_NAME));

    if (legacyCookiePresent) {
      const legacySession = await readSessionForCookie(cookieStore, LEGACY_COOKIE_NAME);
      if (legacySession.isLoggedIn) {
        session.userId = legacySession.userId;
        session.email = legacySession.email;
        session.name = legacySession.name;
        session.role = legacySession.role;
        session.isLoggedIn = legacySession.isLoggedIn;
        await session.save();
        await legacySession.destroy();
      }
    }
  }

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

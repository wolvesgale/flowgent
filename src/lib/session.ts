import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse, type NextRequest, type NextResponse as NextResponseType } from 'next/server';

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

export function getSessionOptions(): SessionOptions {
  return buildSessionOptions(resolveCookieName());
}

async function getSessionFromCookieStore(cookieName: string) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, buildSessionOptions(cookieName));

  if (!session.isLoggedIn) {
    const legacyCookiePresent =
      cookieName !== LEGACY_COOKIE_NAME && Boolean(cookieStore.get(LEGACY_COOKIE_NAME));

    if (legacyCookiePresent) {
      const legacySession = await getIronSession<SessionData>(
        cookieStore,
        buildSessionOptions(LEGACY_COOKIE_NAME),
      );
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

function ensureSessionDefaults(session: IronSession<SessionData>) {
  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }
  return session;
}

export async function getSession(
  request?: NextRequest,
  response?: NextResponseType,
) {
  const cookieName = resolveCookieName();

  if (request && response) {
    const session = await getIronSession<SessionData>(request, response, buildSessionOptions(cookieName));
    return ensureSessionDefaults(session);
  }

  if (request && !response) {
    const workingResponse = new NextResponse();
    const session = await getIronSession<SessionData>(request, workingResponse, buildSessionOptions(cookieName));
    return ensureSessionDefaults(session);
  }

  const session = await getSessionFromCookieStore(cookieName);
  return ensureSessionDefaults(session);
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

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

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

import type { SessionOptions } from 'iron-session'

export interface SessionData {
  userId?: string
  email?: string
  name?: string
  role?: 'ADMIN' | 'CS'
  isLoggedIn?: boolean
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: 'flowgent-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  },
}

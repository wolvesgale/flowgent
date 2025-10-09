import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATH_PREFIXES = ['/api/auth', '/_next', '/public']
const PUBLIC_PATHS = new Set(['/login', '/favicon.ico', '/403'])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('flowgent-session')

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
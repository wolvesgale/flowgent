import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session-config'
import type { SessionData } from '@/lib/session-config'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 管理者ページへのアクセスをチェック
  if (pathname.startsWith('/admin')) {
    try {
      // セッションを取得
      const response = NextResponse.next()
      const session = await getIronSession<SessionData>(request, response, sessionOptions)

      // ログインしていない場合はログインページにリダイレクト
      if (!session.isLoggedIn || !session.userId) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // 管理者権限が必要なパスの場合
      if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
        // 403 Forbiddenページにリダイレクト
        return NextResponse.redirect(new URL('/403', request.url))
      }

      return response
    } catch (error) {
      console.error('Middleware error:', error)
      // エラーが発生した場合はログインページにリダイレクト
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // その他のページは通常通り処理
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - 403 (forbidden page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|403).*)',
  ],
}
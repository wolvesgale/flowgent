import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { SessionData } from '@/lib/session'
import type { Prisma } from '@prisma/client'

async function getSessionUserOrThrow(): Promise<SessionData> {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  })
  if (!session.isLoggedIn || !session.userId) throw new Error('Unauthorized')
  return session
}
function requireRole(user: SessionData, roles: string[]) {
  if (!roles.includes(user.role || '')) throw new Error('Forbidden')
}

// ===== GET: company だけ返す =====
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? '10')))
    const search = (url.searchParams.get('search') ?? '').trim()

    const where: Prisma.InnovatorWhereInput = {}
    if (search) where.company = { contains: search }

    const [total, items] = await Promise.all([
      prisma.innovator.count({ where }),
      prisma.innovator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, company: true, createdAt: true, updatedAt: true },
      }),
    ])

    return NextResponse.json({ total, items, page, limit })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[innovators:list:min]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ===== POST: company だけ受けて作成 =====
type CreateBody = { company?: string; name?: string }

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const body = (await req.json()) as CreateBody
    const company = (body.company ?? body.name ?? '').trim()
    if (!company) return NextResponse.json({ error: 'company is required' }, { status: 400 })

    const created = await prisma.innovator.create({
      data: { company },
      select: { id: true, company: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json(created)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[innovators:create:min]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

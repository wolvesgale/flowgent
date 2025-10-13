import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'

import { prisma } from '@/lib/prisma'
import type { SessionData } from '@/lib/session'
import {
  getInnovatorColumnMetaCached,
  getInnovatorSchemaSnapshot,
  resolveInnovatorColumn,
} from '@/lib/innovator-columns'

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

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? '10')))
    const search = (url.searchParams.get('search') ?? '').trim()

    const where = search
      ? { company: { contains: search, mode: 'insensitive' as const } }
      : {}

    const skip = (page - 1) * limit

    const [total, rows] = await Promise.all([
      prisma.innovator.count({ where }),
      prisma.innovator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, createdAt: true, updatedAt: true, company: true },
      }),
    ])

    const items = rows.map(({ id, createdAt, updatedAt, company: name }) => ({
      id,
      company: name,
      createdAt,
      updatedAt,
    }))

    return NextResponse.json({ total, items, page, limit })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[innovators:list]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type InnovatorRow = {
  id: number
  name: string
  createdAt: Date
  updatedAt: Date
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

async function insertInnovatorWithEmail(options: {
  company: string
  email: string
  meta: Awaited<ReturnType<typeof getInnovatorColumnMetaCached>>
}) {
  const snapshot = await getInnovatorSchemaSnapshot()

  const resolvedTable = escapeIdentifier(options.meta.tableName)
  const nameColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'name') ?? 'name')
  const emailColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'email') ?? 'email')
  const idColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'id') ?? 'id')
  const createdAtColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'createdAt') ?? 'createdAt')
  const updatedAtColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'updatedAt') ?? 'updatedAt')

  const rows = await prisma.$queryRaw<InnovatorRow[]>(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(resolvedTable)} (${Prisma.raw(nameColumn)}, ${Prisma.raw(emailColumn)})
      VALUES (${options.company}, ${options.email})
      RETURNING ${Prisma.raw(idColumn)} AS "id",
        ${Prisma.raw(nameColumn)} AS "name",
        ${Prisma.raw(createdAtColumn)} AS "createdAt",
        ${Prisma.raw(updatedAtColumn)} AS "updatedAt"
    `,
  )

  if (!rows.length) {
    throw new Error('Failed to insert innovator')
  }

  return rows[0]
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const rawBody = (await req.json().catch(() => null)) as unknown

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const body = rawBody as Record<string, unknown>
    const unknownKeys = Object.keys(body).filter((key) => key !== 'company')
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: 'Only { company } is allowed', unknownKeys },
        { status: 400 },
      )
    }

    const company = typeof body.company === 'string' ? body.company.trim() : ''
    if (!company) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 })
    }

    const columnMeta = await getInnovatorColumnMetaCached()

    if (columnMeta.emailRequired) {
      const placeholderEmail = `innovator+${randomUUID()}@placeholder.invalid`
      const insertedInnovator = await insertInnovatorWithEmail({
        company,
        email: placeholderEmail,
        meta: columnMeta,
      })

      return NextResponse.json({
        id: insertedInnovator.id,
        company: insertedInnovator.name,
        createdAt: insertedInnovator.createdAt,
        updatedAt: insertedInnovator.updatedAt,
      })
    }

    const createdInnovator = await prisma.innovator.create({
      data: { company },
      select: { id: true, createdAt: true, updatedAt: true, company: true },
    })

    const extraKeys = Object.keys(body).filter((key) => key !== 'company')
    if (extraKeys.length > 0) {
      return NextResponse.json({ error: 'Unexpected payload properties' }, { status: 400 })
    }

    const created = await prisma.innovator.create({
      data: { company },
      select: { id: true, createdAt: true, updatedAt: true, company: true },
    })

    return NextResponse.json({
      id: createdInnovator.id,
      company: createdInnovator.company,
      createdAt: createdInnovator.createdAt,
      updatedAt: createdInnovator.updatedAt,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[innovators:create]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

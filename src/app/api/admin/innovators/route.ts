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

type CreateBody = {
  company?: unknown
  email?: unknown
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

    const body = (await req.json().catch(() => null)) as CreateBody | null

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { company: rawCompany, email: rawEmail } = body
    if (typeof rawCompany !== 'string') {
      return NextResponse.json({ error: 'company required' }, { status: 400 })
    }

    const company = rawCompany.trim()
    if (!company) {
      return NextResponse.json({ error: 'company required' }, { status: 400 })
    }

    let email: string | null = null
    if (rawEmail !== undefined) {
      if (typeof rawEmail !== 'string') {
        return NextResponse.json({ error: 'email must be a string' }, { status: 400 })
      }
      const trimmed = rawEmail.trim()
      if (trimmed) {
        email = trimmed
      }
    }

    const extraKeys = Object.keys(body).filter((key) => key !== 'company' && key !== 'email')
    if (extraKeys.length > 0) {
      return NextResponse.json({ error: 'Unexpected payload properties' }, { status: 400 })
    }

    const columnMeta = await getInnovatorColumnMetaCached()

    const shouldInsertWithEmail =
      columnMeta.hasEmail && (columnMeta.emailRequired || Boolean(email))

    if (shouldInsertWithEmail) {
      const emailValue = email ?? `innovator+${randomUUID()}@placeholder.invalid`
      const created = await insertInnovatorWithEmail({
        company,
        email: emailValue,
        meta: columnMeta,
      })

      return NextResponse.json({
        id: created.id,
        company: created.name,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      })
    }

    const created = await prisma.innovator.create({
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
      id: created.id,
      company: created.company,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
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

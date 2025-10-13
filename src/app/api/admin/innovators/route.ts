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
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          company: true,
          url: true,
          introPoint: true,
        },
      }),
    ])

    const items = rows.map(({ id, createdAt, updatedAt, company, url, introPoint }) => ({
      id,
      company,
      url: url ?? null,
      introPoint: introPoint ?? null,
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
  company: string
  url?: string | null
  introPoint?: string | null
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
  url: string | null
  introPoint: string | null
}) {
  const snapshot = await getInnovatorSchemaSnapshot()

  const resolvedTable = escapeIdentifier(options.meta.tableName)
  const nameColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'name') ?? 'name')
  const emailColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'email') ?? 'email')
  const idColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'id') ?? 'id')
  const createdAtColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'createdAt') ?? 'createdAt')
  const updatedAtColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'updatedAt') ?? 'updatedAt')
  const urlColumn = resolveInnovatorColumn(snapshot.columns, 'url')
  const introPointColumn = resolveInnovatorColumn(snapshot.columns, 'introPoint')

  const insertColumns: Prisma.Sql[] = [Prisma.raw(nameColumn), Prisma.raw(emailColumn)]
  const insertValues: Prisma.Sql[] = [Prisma.sql`${options.company}`, Prisma.sql`${options.email}`]

  if (options.url !== null && urlColumn) {
    insertColumns.push(Prisma.raw(escapeIdentifier(urlColumn)))
    insertValues.push(Prisma.sql`${options.url}`)
  }

  if (options.introPoint !== null && introPointColumn) {
    insertColumns.push(Prisma.raw(escapeIdentifier(introPointColumn)))
    insertValues.push(Prisma.sql`${options.introPoint}`)
  }

  const returningColumns: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(idColumn)} AS "id"`,
    Prisma.sql`${Prisma.raw(nameColumn)} AS "company"`,
  ]

  if (urlColumn) {
    returningColumns.push(
      Prisma.sql`${Prisma.raw(escapeIdentifier(urlColumn))} AS "url"`,
    )
  }

  if (introPointColumn) {
    returningColumns.push(
      Prisma.sql`${Prisma.raw(escapeIdentifier(introPointColumn))} AS "introPoint"`,
    )
  }

  returningColumns.push(
    Prisma.sql`${Prisma.raw(createdAtColumn)} AS "createdAt"`,
    Prisma.sql`${Prisma.raw(updatedAtColumn)} AS "updatedAt"`,
  )

  const rows = await prisma.$queryRaw<InnovatorRow[]>(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(resolvedTable)} (${Prisma.join(insertColumns, ', ')})
      VALUES (${Prisma.join(insertValues, ', ')})
      RETURNING ${Prisma.join(returningColumns, ', ')}
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
    const allowedKeys = ['company', 'url', 'introPoint'] as const
    const unknownKeys = Object.keys(body).filter(
      (key) => !allowedKeys.includes(key as (typeof allowedKeys)[number]),
    )
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        {
          error: 'Only { company, url, introPoint } are allowed',
          unknownKeys,
        },
        { status: 400 },
      )
    }

    const company = typeof body.company === 'string' ? body.company.trim() : ''
    if (!company) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 })
    }

    if (body.url != null && typeof body.url !== 'string') {
      return NextResponse.json({ error: 'url must be a string' }, { status: 400 })
    }

    if (body.introPoint != null && typeof body.introPoint !== 'string') {
      return NextResponse.json({ error: 'introPoint must be a string' }, { status: 400 })
    }

    const trimmedUrl = typeof body.url === 'string' ? body.url.trim() : ''
    const url = trimmedUrl.length > 0 ? trimmedUrl : null

    const trimmedIntroPoint =
      typeof body.introPoint === 'string' ? body.introPoint.trim() : ''
    const introPoint = trimmedIntroPoint.length > 0 ? trimmedIntroPoint : null

    const columnMeta = await getInnovatorColumnMetaCached()

    if (columnMeta.emailRequired) {
      const placeholderEmail = `innovator+${randomUUID()}@placeholder.invalid`
      const insertedInnovator = await insertInnovatorWithEmail({
        company,
        email: placeholderEmail,
        meta: columnMeta,
        url,
        introPoint,
      })

      return NextResponse.json({
        id: insertedInnovator.id,
        company: insertedInnovator.company,
        url: insertedInnovator.url ?? null,
        introPoint: insertedInnovator.introPoint ?? null,
        createdAt: insertedInnovator.createdAt,
        updatedAt: insertedInnovator.updatedAt,
      })
    }

    const createData: Prisma.InnovatorCreateInput = { company }
    if (url !== null) {
      createData.url = url
    }
    if (introPoint !== null) {
      createData.introPoint = introPoint
    }

    const createdInnovator = await prisma.innovator.create({
      data: createData,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        company: true,
        url: true,
        introPoint: true,
      },
    })

    return NextResponse.json({
      id: createdInnovator.id,
      company: createdInnovator.company,
      url: createdInnovator.url ?? null,
      introPoint: createdInnovator.introPoint ?? null,
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

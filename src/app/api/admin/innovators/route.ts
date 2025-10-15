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

    const where: Prisma.InnovatorWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
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
          name: true,
          url: true,
          introPoint: true,
        },
      }),
    ])

    const items = rows.map(({ id, createdAt, updatedAt, name, url, introPoint }) => ({
      id,
      company: name,
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
  name: string
  url?: string | null
  introPoint?: string | null
  createdAt: Date
  updatedAt: Date
}

async function insertInnovatorRaw(options: {
  company: string
  url: string | null
  introPoint: string | null
  email?: string | null
  meta?: Awaited<ReturnType<typeof getInnovatorColumnMetaCached>>
}): Promise<InnovatorRow> {
  const snapshot = await getInnovatorSchemaSnapshot()
  const meta = options.meta ?? (await getInnovatorColumnMetaCached())

  const esc = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`

  const table = esc(meta.tableName)
  const nameColumnName =
    resolveInnovatorColumn(snapshot.columns, 'company') ??
    resolveInnovatorColumn(snapshot.columns, 'name') ??
    'company'
  const nameColumn = esc(nameColumnName)

  const emailColumnName = resolveInnovatorColumn(snapshot.columns, 'email')
  const idColumn = esc(resolveInnovatorColumn(snapshot.columns, 'id') ?? 'id')
  const createdAtColumn = esc(
    resolveInnovatorColumn(snapshot.columns, 'createdAt') ?? 'createdAt',
  )
  const updatedAtColumn = esc(
    resolveInnovatorColumn(snapshot.columns, 'updatedAt') ?? 'updatedAt',
  )
  const urlColumnName = resolveInnovatorColumn(snapshot.columns, 'url')
  const introColumnName = resolveInnovatorColumn(snapshot.columns, 'introPoint')

  const columns: Prisma.Sql[] = [Prisma.raw(nameColumn)]
  const values: Prisma.Sql[] = [Prisma.sql`${options.company}`]

  if (options.email && emailColumnName) {
    columns.push(Prisma.raw(esc(emailColumnName)))
    values.push(Prisma.sql`${options.email}`)
  }

  if (options.url !== null && urlColumnName) {
    columns.push(Prisma.raw(esc(urlColumnName)))
    values.push(Prisma.sql`${options.url}`)
  }

  if (options.introPoint !== null && introColumnName) {
    columns.push(Prisma.raw(esc(introColumnName)))
    values.push(Prisma.sql`${options.introPoint}`)
  }

  const returning: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(idColumn)} AS "id"`,
    Prisma.sql`${Prisma.raw(nameColumn)} AS "name"`,
    Prisma.sql`${Prisma.raw(createdAtColumn)} AS "createdAt"`,
    Prisma.sql`${Prisma.raw(updatedAtColumn)} AS "updatedAt"`,
  ]

  if (urlColumnName) {
    returning.push(
      Prisma.sql`${Prisma.raw(esc(urlColumnName))} AS "url"`,
    )
  }

  if (introColumnName) {
    returning.push(
      Prisma.sql`${Prisma.raw(esc(introColumnName))} AS "introPoint"`,
    )
  }

  const rows = await prisma.$queryRaw<InnovatorRow[]>(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(table)} (${Prisma.join(columns, ', ')})
      VALUES (${Prisma.join(values, ', ')})
      RETURNING ${Prisma.join(returning, ', ')}
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

    const company =
      typeof body.company === 'string'
        ? body.company.trim()
        : typeof body.company === 'number'
          ? String(body.company).trim()
          : ''
    if (!company) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 })
    }

    const urlStr =
      typeof body.url === 'string'
        ? body.url.trim()
        : typeof body.url === 'number'
          ? String(body.url).trim()
          : ''
    const url = urlStr ? urlStr : null

    const introStr =
      typeof body.introPoint === 'string'
        ? body.introPoint.trim()
        : typeof body.introPoint === 'number'
          ? String(body.introPoint).trim()
          : ''
    const introPoint = introStr ? introStr : null

    const meta = await getInnovatorColumnMetaCached()

    if (meta.emailRequired) {
      const email = `innovator+${randomUUID()}@placeholder.invalid`
      const inserted = await insertInnovatorRaw({
        company,
        url,
        introPoint,
        email,
        meta,
      })

      return NextResponse.json({
        id: inserted.id,
        company: inserted.name,
        url: inserted.url ?? null,
        introPoint: inserted.introPoint ?? null,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      })
    }

    const createData: Prisma.InnovatorCreateInput = {
      name: company,
      ...(url !== null ? { url } : {}),
      ...(introPoint !== null ? { introPoint } : {}),
    }

    const created = await prisma.innovator.create({
      data: createData,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        url: true,
        introPoint: true,
      },
    })

    return NextResponse.json({
      id: created.id,
      company: created.name,
      url: created.url ?? null,
      introPoint: created.introPoint ?? null,
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


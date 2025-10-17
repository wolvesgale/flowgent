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

const escapeIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`

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
  name?: string | null
  company?: string | null
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

  const table = escapeIdentifier(meta.tableName)
  const nameColumnName = resolveInnovatorColumn(snapshot.columns, 'name')
  const companyColumnName = resolveInnovatorColumn(snapshot.columns, 'company')
  const resolvedCompanyColumnName =
    companyColumnName ?? nameColumnName ?? 'company'
  const companyColumn = escapeIdentifier(resolvedCompanyColumnName)
  const nameColumn = nameColumnName ? escapeIdentifier(nameColumnName) : null

  const emailColumnName = resolveInnovatorColumn(snapshot.columns, 'email')
  const idColumn = escapeIdentifier(resolveInnovatorColumn(snapshot.columns, 'id') ?? 'id')
  const createdAtColumn = escapeIdentifier(
    resolveInnovatorColumn(snapshot.columns, 'createdAt') ?? 'createdAt',
  )
  const updatedAtColumn = escapeIdentifier(
    resolveInnovatorColumn(snapshot.columns, 'updatedAt') ?? 'updatedAt',
  )
  const urlColumnName = resolveInnovatorColumn(snapshot.columns, 'url')
  const introColumnName = resolveInnovatorColumn(snapshot.columns, 'introPoint')

  const insertColumns: Prisma.Sql[] = [Prisma.raw(companyColumn)]
  const insertValues: Prisma.Sql[] = [Prisma.sql`${options.company}`]

  if (nameColumn && nameColumn !== companyColumn) {
    insertColumns.push(Prisma.raw(nameColumn))
    insertValues.push(Prisma.sql`${options.company}`)
  }

  if (options.email && emailColumnName) {
    insertColumns.push(Prisma.raw(escapeIdentifier(emailColumnName)))
    insertValues.push(Prisma.sql`${options.email}`)
  }

  if (options.url !== null && urlColumnName) {
    insertColumns.push(Prisma.raw(escapeIdentifier(urlColumnName)))
    insertValues.push(Prisma.sql`${options.url}`)
  }

  if (options.introPoint !== null && introColumnName) {
    insertColumns.push(Prisma.raw(escapeIdentifier(introColumnName)))
    insertValues.push(Prisma.sql`${options.introPoint}`)
  }

  const returning: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(idColumn)} AS "id"`,
    Prisma.sql`${Prisma.raw(createdAtColumn)} AS "createdAt"`,
    Prisma.sql`${Prisma.raw(updatedAtColumn)} AS "updatedAt"`,
  ]

  returning.push(Prisma.sql`${Prisma.raw(companyColumn)} AS "company"`)

  if (nameColumn && nameColumn !== companyColumn) {
    returning.push(Prisma.sql`${Prisma.raw(nameColumn)} AS "name"`)
  }

  if (urlColumnName) {
    returning.push(
      Prisma.sql`${Prisma.raw(escapeIdentifier(urlColumnName))} AS "url"`,
    )
  }

  if (introColumnName) {
    returning.push(
      Prisma.sql`${Prisma.raw(escapeIdentifier(introColumnName))} AS "introPoint"`,
    )
  }

  const rows = await prisma.$queryRaw<InnovatorRow[]>(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(table)} (${Prisma.join(insertColumns, ', ')})
      VALUES (${Prisma.join(insertValues, ', ')})
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
        company: inserted.name ?? inserted.company ?? company,
        url: inserted.url ?? null,
        introPoint: inserted.introPoint ?? null,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      })
    }

    const created = await prisma.innovator.create({
      data: {
        name: company,
        company,
        ...(url !== null ? { url } : {}),
        ...(introPoint !== null ? { introPoint } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        company: true,
        url: true,
        introPoint: true,
      },
    })

    return NextResponse.json({
      id: created.id,
      company: created.company ?? created.name,
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


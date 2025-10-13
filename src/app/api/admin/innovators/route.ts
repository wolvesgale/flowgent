import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getInnovatorSchemaSnapshot, resolveInnovatorColumn } from '@/lib/innovator-columns'
import type { SessionData } from '@/lib/session'
import { Prisma } from '@prisma/client'

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

type InnovatorResponseItem = {
  id: number
  company: string
  createdAt: Date
  updatedAt: Date
}

function quoteIdentifier(identifier: string): Prisma.Sql {
  const escaped = identifier.replace(/"/g, '""')
  return Prisma.raw(`"${escaped}"`)
}

function normalizeCompanyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  return value == null ? '' : String(value)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? '10')))
    const search = (url.searchParams.get('search') ?? '').trim()

    const snapshot = await getInnovatorSchemaSnapshot()
    const columns = snapshot.columns
    const tableName = snapshot.tableName ?? 'innovators'
    const nameColumn = resolveInnovatorColumn(columns, 'name')
    const companyColumn = resolveInnovatorColumn(columns, 'company')

    if (!nameColumn && !companyColumn) {
      return NextResponse.json(
        { error: 'innovators table must have a name/company-like column' },
        { status: 500 }
      )
    }

    const skip = (page - 1) * limit

    if (nameColumn) {
      const where: Prisma.InnovatorWhereInput = {}
      if (search) where.company = { contains: search }

      const [total, rows] = await Promise.all([
        prisma.innovator.count({ where }),
        prisma.innovator.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: { id: true, company: true, createdAt: true, updatedAt: true },
        }),
      ])

      const items: InnovatorResponseItem[] = rows.map((row) => ({
        id: row.id,
        company: normalizeCompanyValue(row.company),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))

      return NextResponse.json({ total, items, page, limit })
    }

    const targetColumn = companyColumn!
    const tableIdentifier = quoteIdentifier(tableName)
    const columnIdentifier = quoteIdentifier(targetColumn)
    const likeValue = `%${search}%`
    const whereSql = search
      ? Prisma.sql`WHERE ${columnIdentifier} ILIKE ${likeValue}`
      : Prisma.sql``

    const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM ${tableIdentifier}
      ${whereSql}
    `)
    const total = Number(totalResult[0]?.count ?? 0)

    const rows = await prisma.$queryRaw<
      Array<{ id: number; company: string | null; createdAt: Date; updatedAt: Date }>
    >(Prisma.sql`
      SELECT "id", ${columnIdentifier} AS "company", "createdAt", "updatedAt"
      FROM ${tableIdentifier}
      ${whereSql}
      ORDER BY "createdAt" DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `)

    const items: InnovatorResponseItem[] = rows.map((row) => ({
      id: row.id,
      company: normalizeCompanyValue(row.company),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

type CreateBody = { company?: string; name?: string }

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow()
    requireRole(user, ['ADMIN', 'CS'])

    const body = (await req.json()) as CreateBody
    const company = (body.company ?? body.name ?? '').trim()
    if (!company) return NextResponse.json({ error: 'company required' }, { status: 400 })

    const snapshot = await getInnovatorSchemaSnapshot()
    const columns = snapshot.columns
    const tableName = snapshot.tableName ?? 'innovators'
    const nameColumn = resolveInnovatorColumn(columns, 'name')
    const companyColumn = resolveInnovatorColumn(columns, 'company')

    if (!nameColumn && !companyColumn) {
      return NextResponse.json(
        { error: 'innovators table must have a name/company-like column' },
        { status: 500 }
      )
    }

    if (nameColumn) {
      const created = await prisma.innovator.create({
        data: { company },
        select: { id: true, company: true, createdAt: true, updatedAt: true },
      })

      return NextResponse.json({
        id: created.id,
        company: normalizeCompanyValue(created.company),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      })
    }

    const targetColumn = companyColumn!
    const tableIdentifier = quoteIdentifier(tableName)
    const columnIdentifier = quoteIdentifier(targetColumn)

    const rows = await prisma.$queryRaw<
      Array<{ id: number; company: string | null; createdAt: Date; updatedAt: Date }>
    >(Prisma.sql`
      INSERT INTO ${tableIdentifier} (${columnIdentifier})
      VALUES (${company})
      RETURNING "id", ${columnIdentifier} AS "company", "createdAt", "updatedAt"
    `)

    const created = rows[0]
    if (!created) {
      throw new Error('Failed to insert innovator')
    }

    return NextResponse.json({
      id: created.id,
      company: normalizeCompanyValue(created.company),
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

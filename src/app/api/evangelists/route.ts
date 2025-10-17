import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import type { SessionData } from '@/lib/session'
import {
  buildEvangelistSelect,
  filterEvangelistData,
  getEvangelistColumnSet,
  normalizeEvangelistResult,
} from '@/lib/evangelist-columns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SORTABLE_FIELDS: Record<string, true> = {
  createdAt: true,
  updatedAt: true,
  firstName: true,
  lastName: true,
  email: true,
  tier: true,
}

async function getSessionUserOrThrow(): Promise<SessionData> {
  const session = await getSession()
  if (!session.isLoggedIn || !session.userId) throw new Error('Unauthorized')
  return session
}

function requireRole(user: SessionData, roles: Array<'ADMIN' | 'CS'>) {
  const role = user.role
  if (!role || !roles.includes(role)) throw new Error('Forbidden')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get('limit') || '10')),
    )
    const rawSearch = searchParams.get('search') || ''
    const search = rawSearch.trim()
    const tier = searchParams.get('tier') || 'ALL'
    const requestedSortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    const status = searchParams.get('status') || ''
    const stale = searchParams.get('stale') // M3: stale=7 for meetings older than 7 days
    const tag = searchParams.get('tag') // M3: tag filtering
    const assignedCsId = searchParams.get('assignedCsId') // 担当CSフィルタ

    const skip = (page - 1) * limit

    const columns = await getEvangelistColumnSet()

    const filters: Prisma.EvangelistWhereInput[] = []

    if (search) {
      const searchConditions: Prisma.EvangelistWhereInput[] = []
      let displayNameIdFilter: Prisma.EvangelistWhereInput | null = null

      if (columns.has('firstName')) {
        searchConditions.push({
          firstName: { contains: search, mode: 'insensitive' },
        })
      }

      if (columns.has('lastName')) {
        searchConditions.push({
          lastName: { contains: search, mode: 'insensitive' },
        })
      }

      if (columns.has('email')) {
        searchConditions.push({
          email: { contains: search, mode: 'insensitive' },
        })
      }

      const displayNameColumn = Array.from(columns).find((column) => {
        const lowered = column.toLowerCase()
        return lowered === 'displayname' || lowered === 'display_name'
      })

      if (displayNameColumn) {
        const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`
        const matches = await prisma.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "evangelists"
          WHERE ${Prisma.raw(quoteIdentifier(displayNameColumn))} ILIKE ${
            `%${search}%`
          }
        `

        if (matches.length > 0) {
          displayNameIdFilter = {
            id: { in: matches.map((match) => match.id) },
          }
        }
      }

      if (displayNameIdFilter) {
        searchConditions.push(displayNameIdFilter)
      }

      if (searchConditions.length > 0) {
        filters.push({ OR: searchConditions })
      }
    }

    if (status && status !== 'ALL') {
      // status 列は現行スキーマに存在しないため利用しない
    }

    if (tier && tier !== 'ALL') {
      filters.push({ tier: tier as 'TIER1' | 'TIER2' })
    }

    if (tag && columns.has('tags')) {
      filters.push({
        tags: {
          contains: tag,
        },
      })
    }

    if (assignedCsId && columns.has('assignedCsId')) {
      filters.push({ assignedCsId })
    }

    if (stale) {
      const staleDays = Number.parseInt(stale)
      if (!Number.isNaN(staleDays) && staleDays > 0) {
        const staleDate = new Date()
        staleDate.setDate(staleDate.getDate() - staleDays)
        filters.push({
          OR: [
            { meetings: { none: {} } },
            {
              meetings: {
                every: {
                  date: {
                    lt: staleDate,
                  },
                },
              },
            },
          ],
        })
      }
    }

    const where: Prisma.EvangelistWhereInput =
      filters.length > 0 ? { AND: filters } : {}

    const canSortByName = columns.has('firstName') && columns.has('lastName')

    const sortBy =
      requestedSortBy === 'name' && canSortByName
        ? 'name'
        : SORTABLE_FIELDS[requestedSortBy] && columns.has(requestedSortBy)
          ? requestedSortBy
          : 'createdAt'

    let orderBy: Prisma.EvangelistOrderByWithRelationInput | Prisma.EvangelistOrderByWithRelationInput[]
    if (sortBy === 'name') {
      orderBy = [
        { firstName: sortOrder },
        { lastName: sortOrder },
      ]
    } else {
      orderBy = { [sortBy]: sortOrder }
    }

    // データ取得
    const select = buildEvangelistSelect(columns, {
      includeAssignedCs: true,
      includeCount: true,
    })

    const [evangelists, total] = await Promise.all([
      prisma.evangelist.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select,
      }),
      prisma.evangelist.count({ where }),
    ])

    const normalized = evangelists.map((evangelist) =>
      normalizeEvangelistResult(evangelist),
    )

    return NextResponse.json({
      ok: true,
      items: normalized,
      total,
      page,
      limit,
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:list]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUserOrThrow()
    requireRole(session, ['ADMIN', 'CS'])

    const payload = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim() : ''
    const lastName = typeof payload.lastName === 'string' ? payload.lastName.trim() : ''
    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: 'firstName and lastName are required' },
        { status: 400 },
      )
    }

    const emailRaw = typeof payload.email === 'string' ? payload.email.trim() : ''
    const email = emailRaw.length > 0 ? emailRaw : null

    const assignedCsIdRaw =
      typeof payload.assignedCsId === 'string' ? payload.assignedCsId.trim() : ''
    const assignedCsId = assignedCsIdRaw.length > 0 ? assignedCsIdRaw : null

    const columns = await getEvangelistColumnSet()
    const data = filterEvangelistData(
      {
        firstName,
        lastName,
        displayName: `${lastName} ${firstName}`.trim(),
        email,
        assignedCsId: assignedCsId ?? undefined,
      },
      columns,
    )

    const created = await prisma.evangelist.create({
      data,
      select: buildEvangelistSelect(columns, {
        includeAssignedCs: true,
        includeCount: true,
      }),
    })

    return NextResponse.json(
      { ok: true, item: normalizeEvangelistResult(created) },
      { status: 201 },
    )
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (err?.message === 'Unauthorized') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (err?.message === 'Forbidden') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
    if (err?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Email already exists' }, { status: 409 })
    }
    console.error('[evangelists:create]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', code: err?.code },
      { status: 500 },
    )
  }
}
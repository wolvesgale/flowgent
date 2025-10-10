import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import {
  buildEvangelistSelect,
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
    const search = searchParams.get('search') || ''
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
      filters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      })
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
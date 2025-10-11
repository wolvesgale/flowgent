import { NextRequest, NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FilterParams = {
  tier?: 'TIER1' | 'TIER2'
  assignedCsIdIsNull?: boolean
  phaseIn?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const innovatorId = Number(body?.innovatorId)
    const where: FilterParams | undefined = body?.where
    const note = typeof body?.note === 'string' ? body.note.trim() : undefined

    if (!Number.isInteger(innovatorId) || innovatorId <= 0) {
      return NextResponse.json({ error: 'Invalid innovatorId' }, { status: 400 })
    }

    const filters: Prisma.EvangelistWhereInput = {}

    if (where?.tier === 'TIER1' || where?.tier === 'TIER2') {
      filters.tier = where.tier
    }

    if (where?.assignedCsIdIsNull) {
      filters.assignedCsId = null
    }

    if (Array.isArray(where?.phaseIn) && where.phaseIn.length > 0) {
      filters.managementPhase = { in: where.phaseIn }
    }

    const evangelists = await prisma.evangelist.findMany({
      where: filters,
      select: { id: true },
      take: 2000,
    })

    if (evangelists.length === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }

    const operations = evangelists.map((evangelist) =>
      prisma.requiredIntro.upsert({
        where: {
          evangelistId_innovatorId: {
            evangelistId: evangelist.id,
            innovatorId,
          },
        },
        create: {
          evangelistId: evangelist.id,
          innovatorId,
          note: note ?? null,
        },
        update: {
          note: note ?? undefined,
          status: 'PENDING',
        },
        select: { id: true },
      })
    )

    await prisma.$transaction(operations, { timeout: 30000 })

    return NextResponse.json({ ok: true, count: operations.length })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[required-intros:create]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

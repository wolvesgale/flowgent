import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getWeekRange() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  return { weekStart, weekEnd }
}

export async function GET() {
  try {
    const session = await getSession()

    if (!session.isLoggedIn) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { weekStart, weekEnd } = getWeekRange()

    const [
      totalEvangelists,
      unassignedEvangelists,
      pendingMeetings,
      requiredInnovators,
      staleEvangelists,
      itTagEvangelists,
    ] = await Promise.all([
      prisma.evangelist.count(),
      prisma.evangelist.count({
        where: { assignedCsId: null },
      }),
      prisma.meeting.count({
        where: {
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.innovator.count({
        where: { introductionPoint: null },
      }),
      prisma.evangelist.count({
        where: {
          OR: [
            { meetings: { none: {} } },
            {
              meetings: {
                some: {
                  date: { lt: thirtyDaysAgo },
                },
              },
            },
          ],
        },
      }),
      prisma.evangelist.count({
        where: {
          OR: [
            { strength: { contains: 'IT', mode: 'insensitive' } },
            { tags: { contains: '"IT"' } },
          ],
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      totalEvangelists,
      unassignedEvangelists,
      pendingMeetings,
      requiredInnovators,
      staleEvangelists,
      itTagEvangelists,
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[dashboard/stats]', err?.code, err?.message, error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

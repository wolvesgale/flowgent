// src/app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

import { prisma } from '@/lib/prisma'
import { sessionOptions } from '@/lib/session-config'
import type { SessionData } from '@/lib/session'

async function checkAuth() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn) return null
  return session
}

export async function GET() {
  try {
    // 認証チェック
    const session = await checkAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 30日前（要フォロー判定）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 今週の開始/終了
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() - start.getDay()) // 日曜始まり
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const [
      totalEvangelists,
      unassignedEvangelists,
      pendingMeetings,
      requiredInnovators,
      staleEvangelists,
      itTagEvangelists,
    ] = await Promise.all([
      // 総EVA数
      prisma.evangelist.count(),

      // CS未割当
      prisma.evangelist.count({
        where: { assignedCsId: null },
      }),

      // 今週の面談数
      prisma.meeting.count({
        where: {
          date: { gte: weekStart, lt: weekEnd },
        },
      }),

      // 紹介必須イノベータ（introductionPoint 未設定）
      prisma.innovator.count({
        where: { introductionPoint: null },
      }),

      // 要フォロー（面談が一度もない or すべて30日より前）
      prisma.evangelist.count({
        where: {
          OR: [
            { meetings: { none: {} } },
            {
              meetings: {
                every: {
                  date: { lt: thirtyDaysAgo },
                },
              },
            },
          ],
        },
      }),

      // ITタグ/強みを持つEVA数
      // tags は JSON文字列で保存のため、'"IT"' を部分一致で検索（大文字小文字は無視）
      prisma.evangelist.count({
        where: {
          OR: [
            { tags: { contains: '"IT"', mode: 'insensitive' } },
            { strengths: { contains: 'IT', mode: 'insensitive' } },
          ],
        },
      }),
    ])

    return NextResponse.json({
      totalEvangelists,
      unassignedEvangelists,
      pendingMeetings,
      requiredInnovators,
      staleEvangelists,
      itTagEvangelists,
    })
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

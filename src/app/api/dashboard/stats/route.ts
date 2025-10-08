// src/app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

import { prisma } from '@/lib/prisma'
import { sessionOptions } from '@/lib/session-config'
import type { SessionData } from '@/lib/session'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { PrismaClientInitializationError } from '@prisma/client/runtime/library'

async function safeCount(query: () => Promise<number>): Promise<number> {
  try {
    return await query()
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2021' || error.code === 'P2010') {
        console.warn('Dashboard stat skipped because table/column is missing:', error.message)
        return 0
      }
    }
    if (error instanceof PrismaClientInitializationError) {
      console.error('Database connection failed for dashboard stats:', error.message)
      throw new Error('DB_UNAVAILABLE')
    }
    throw error
  }
}

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
      safeCount(() => prisma.evangelist.count()),

      // CS未割当
      safeCount(() =>
        prisma.evangelist.count({
          where: { assignedCsId: null },
        }),
      ),

      // 今週の面談数
      safeCount(() =>
        prisma.meeting.count({
          where: {
            date: { gte: weekStart, lt: weekEnd },
          },
        }),
      ),

      // 紹介必須イノベータ（introductionPoint 未設定）
      safeCount(() =>
        prisma.innovator.count({
          where: { introductionPoint: null },
        }),
      ),

      // 要フォロー（面談が一度もない or すべて30日より前）
      safeCount(() =>
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
      ),

      // ITタグ/強みを持つEVA数
      // tags は JSON文字列で保存のため、'"IT"' を部分一致で検索（大文字小文字は無視）
      safeCount(() =>
        prisma.evangelist.count({
          where: {
            OR: [
              { tags: { contains: '"IT"', mode: 'insensitive' } },
              { strength: { contains: 'IT', mode: 'insensitive' } },
            ],
          },
        }),
      ),
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
    if (error instanceof Error && error.message === 'DB_UNAVAILABLE') {
      return NextResponse.json({ error: 'Database is temporarily unavailable' }, { status: 503 })
    }
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

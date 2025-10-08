import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'

async function checkAuth() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  })

  if (!session.isLoggedIn) {
    return null
  }
  return session
}

export async function GET() {
  try {
    // 認証チェック
    const session = await checkAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 30日前の日付を計算（要フォローEVA判定用）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 統計データを並行して取得
    const [
      totalEvangelists,
      unassignedEvangelists,
      pendingMeetings,
      requiredInnovators,
      staleEvangelists,
      itTagEvangelists,
    ] = await Promise.all([
      // 総エバンジェリスト数
      prisma.evangelist.count(),
      
      // CS未割り当てエバンジェリスト数
      prisma.evangelist.count({
        where: {
          assignedCsId: null
        }
      }),
      
      // 今週の面談予定数（仮実装）
      prisma.meeting.count({
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())), // 今週の開始
            lt: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 7)) // 来週の開始
          }
        }
      }),
      
      // 紹介必須イノベータ数
      prisma.innovator.count({
        where: {
          introductionPoint: null,
        },
      }),

      // 要フォローEVA数（30日以上面談なし）
      prisma.evangelist.count({
        where: {
          OR: [
            {
              meetings: {
                none: {}
              }
            },
            {
              meetings: {
                every: {
                  date: {
                    lt: thirtyDaysAgo
                  }
                }
              }
            }
          ]
        }
      }),

      // ITタグ持ちEVA数
      prisma.evangelist.count({
        where: {
          strength: 'IT',
        },
      })
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
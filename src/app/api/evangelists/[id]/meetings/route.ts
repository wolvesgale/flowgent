import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createMeetingSchema = z.object({
  isFirst: z.boolean().default(false),
  summary: z.string().optional(),
  nextActions: z.string().optional(),
  contactMethod: z.string().optional(),
})

// GET /api/evangelists/[id]/meetings - 面談履歴取得
export async function GET(_request: Request, context: unknown) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (context as { params: { id: string } }).params

    // EVAが存在するかチェック
    const evangelist = await prisma.evangelist.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 面談履歴を取得（新しい順）
    const meetings = await prisma.meeting.findMany({
      where: { evangelistId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(meetings)
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:meetings:get]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

// POST /api/evangelists/[id]/meetings - 面談記録作成
export async function POST(request: Request, context: unknown) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (context as { params: { id: string } }).params

    const body = await request.json()
    
    // バリデーション
    const validationResult = createMeetingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: validationResult.error.issues },
        { status: 400 }
      )
    }

    const meetingData = validationResult.data

    // EVAが存在するかチェック
    const evangelist = await prisma.evangelist.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 面談記録を作成
    const meeting = await prisma.meeting.create({
      data: {
        evangelistId: id,
        date: new Date(),
        isFirst: meetingData.isFirst,
        summary: meetingData.summary,
        nextActions: meetingData.nextActions,
        contactMethod: meetingData.contactMethod,
      },
    })

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:meetings:post]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}
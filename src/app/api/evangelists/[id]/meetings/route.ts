import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'
import { z } from 'zod'

const createMeetingSchema = z.object({
  isFirst: z.boolean().default(false),
  summary: z.string().optional(),
  nextActions: z.string().optional(),
  contactMethod: z.string().optional(),
})

// GET /api/evangelists/[id]/meetings - 面談履歴取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), {
      password: process.env.SESSION_PASSWORD!,
      cookieName: 'flowgent-session',
    })

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // EVAが存在するかチェック
    const evangelist = await prisma.evangelist.findUnique({
      where: { id: params.id },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 面談履歴を取得（新しい順）
    const meetings = await prisma.meeting.findMany({
      where: { evangelistId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/evangelists/[id]/meetings - 面談記録作成
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), {
      password: process.env.SESSION_PASSWORD!,
      cookieName: 'flowgent-session',
    })

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      where: { id: params.id },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 面談記録を作成
    const meeting = await prisma.meeting.create({
      data: {
        evangelistId: params.id,
        date: new Date(),
        isFirst: meetingData.isFirst,
        summary: meetingData.summary,
        nextActions: meetingData.nextActions,
        contactMethod: meetingData.contactMethod,
        createdBy: session.userId,
      },
    })

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // EVAが存在するかチェック
    const evangelist = await prisma.evangelist.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'
import { z } from 'zod'

const updateEvangelistSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  contactPref: z.string().optional(),
  strengths: z.string().optional(),
  notes: z.string().optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional(),
})

// GET /api/evangelists/[id] - EVA詳細取得
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

    const evangelist = await prisma.evangelist.findUnique({
      where: { id: params.id },
      include: {
        assignedCs: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    return NextResponse.json(evangelist)
  } catch (error) {
    console.error('Error fetching evangelist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/evangelists/[id] - EVA情報更新
export async function PUT(
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
    const validationResult = updateEvangelistSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: validationResult.error.issues },
        { status: 400 }
      )
    }

    const evangelistData = validationResult.data

    // EVAが存在するかチェック
    const existingEvangelist = await prisma.evangelist.findUnique({
      where: { id: params.id },
    })

    if (!existingEvangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // EVA情報を更新
    const updatedEvangelist = await prisma.evangelist.update({
      where: { id: params.id },
      data: {
        firstName: evangelistData.firstName,
        lastName: evangelistData.lastName,
        email: evangelistData.email,
        contactPref: evangelistData.contactPref,
        strengths: evangelistData.strengths,
        notes: evangelistData.notes,
        tier: evangelistData.tier,
        updatedAt: new Date(),
      },
      include: {
        assignedCs: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(updatedEvangelist)
  } catch (error) {
    console.error('Error updating evangelist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/evangelists/[id] - EVA削除
export async function DELETE(
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
    const existingEvangelist = await prisma.evangelist.findUnique({
      where: { id: params.id },
    })

    if (!existingEvangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 関連する面談記録も削除
    await prisma.meeting.deleteMany({
      where: { evangelistId: params.id },
    })

    // EVAを削除
    await prisma.evangelist.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Evangelist deleted successfully' })
  } catch (error) {
    console.error('Error deleting evangelist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
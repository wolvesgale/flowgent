import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const contactMethodEnum = ['FACEBOOK', 'LINE', 'EMAIL', 'PHONE', 'SLACK'] as const
const strengthEnum = ['HR', 'IT', 'ACCOUNTING', 'ADVERTISING', 'MANAGEMENT', 'SALES', 'MANUFACTURING', 'MEDICAL', 'FINANCE'] as const
const managementPhaseEnum = [
  'INQUIRY',
  'FIRST_MEETING',
  'REGISTERED',
  'LIST_PROVIDED',
  'INNOVATOR_REVIEW',
  'INTRODUCTION_STARTED',
  'MEETING_SCHEDULED',
  'FIRST_RESULT',
  'CONTINUED_PROPOSAL',
] as const

const updateEvangelistSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    email: z.string().email('Invalid email format').optional().nullable(),
    contactMethod: z.enum(contactMethodEnum).optional().nullable(),
    strength: z.enum(strengthEnum).optional().nullable(),
    managementPhase: z.enum(managementPhaseEnum).optional().nullable(),
    notes: z.string().optional().nullable(),
    tier: z.enum(['TIER1', 'TIER2']).optional(),
    assignedCsId: z.string().min(1, 'Assigned CS is required').optional().nullable(),
    listProvided: z.boolean().optional(),
    nextAction: z.string().optional().nullable(),
    nextActionDueOn: z
      .string()
      .datetime({ message: 'Invalid date format' })
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No update fields provided',
  })

// GET /api/evangelists/[id] - EVA詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const evangelist = await prisma.evangelist.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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
      where: { id },
    })

    if (!existingEvangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // EVA情報を更新
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (evangelistData.firstName !== undefined) {
      updateData.firstName = evangelistData.firstName
    }

    if (evangelistData.lastName !== undefined) {
      updateData.lastName = evangelistData.lastName
    }

    if (evangelistData.email !== undefined) {
      updateData.email = evangelistData.email
    }

    if (evangelistData.contactMethod !== undefined) {
      updateData.contactMethod = evangelistData.contactMethod ?? null
    }

    if (evangelistData.strength !== undefined) {
      updateData.strength = evangelistData.strength ?? null
    }

    if (evangelistData.managementPhase !== undefined) {
      updateData.managementPhase = evangelistData.managementPhase ?? null
    }

    if (evangelistData.notes !== undefined) {
      updateData.notes = evangelistData.notes ?? null
    }

    if (evangelistData.tier !== undefined) {
      updateData.tier = evangelistData.tier
    }

    if (evangelistData.assignedCsId !== undefined) {
      updateData.assignedCsId = evangelistData.assignedCsId ?? null
    }

    if (evangelistData.listProvided !== undefined) {
      updateData.listProvided = evangelistData.listProvided
    }

    if (evangelistData.nextAction !== undefined) {
      updateData.nextAction = evangelistData.nextAction ?? null
    }

    if (evangelistData.nextActionDueOn !== undefined) {
      updateData.nextActionDueOn = evangelistData.nextActionDueOn
        ? new Date(evangelistData.nextActionDueOn)
        : null
    }

    const updatedEvangelist = await prisma.evangelist.update({
      where: { id },
      data: updateData,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // EVAが存在するかチェック
    const existingEvangelist = await prisma.evangelist.findUnique({
      where: { id },
    })

    if (!existingEvangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    // 関連する面談記録も削除
    await prisma.meeting.deleteMany({
      where: { evangelistId: id },
    })

    // EVAを削除
    await prisma.evangelist.delete({
      where: { id },
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
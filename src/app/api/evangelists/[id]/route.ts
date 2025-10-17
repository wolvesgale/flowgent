import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import {
  buildEvangelistSelect,
  filterEvangelistData,
  getEvangelistColumnSet,
  normalizeEvangelistResult,
} from '@/lib/evangelist-columns'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
export async function GET(_request: Request, context: unknown) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (context as { params: { id: string } }).params

    const columns = await getEvangelistColumnSet()
    const select = buildEvangelistSelect(columns, {
      includeAssignedCs: true,
      includeCount: true,
    })

    const evangelist = await prisma.evangelist.findUnique({
      where: { id },
      select,
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    return NextResponse.json(normalizeEvangelistResult(evangelist))
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:detail:get]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

// PUT /api/evangelists/[id] - EVA情報更新
export async function PUT(request: Request, context: unknown) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (context as { params: { id: string } }).params
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
    const columns = await getEvangelistColumnSet()
    const select = buildEvangelistSelect(columns, {
      includeAssignedCs: true,
      includeCount: true,
    })

    const existingEvangelist = await prisma.evangelist.findUnique({
      where: { id },
      select: { id: true },
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

    const filteredUpdate = filterEvangelistData(updateData, columns)

    const updatedEvangelist = await prisma.evangelist.update({
      where: { id },
      data: filteredUpdate,
      select,
    })

    return NextResponse.json(normalizeEvangelistResult(updatedEvangelist))
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:detail:put]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

// DELETE /api/evangelists/[id] - EVA削除
export async function DELETE(_request: Request, context: unknown) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = (context as { params: { id: string } }).params

    // EVAが存在するかチェック
    const existingEvangelist = await prisma.evangelist.findUnique({
      where: { id },
      select: { id: true },
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
      }
      if (error.code === 'P2022') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Schema mismatch (P2022). Check model mapping.',
            code: error.code,
          },
          { status: 500 },
        )
      }
    }
    console.error('[evangelists:detail:delete]', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

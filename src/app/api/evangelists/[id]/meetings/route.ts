import { Prisma } from '@prisma/client'
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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createMeetingSchema = z.object({
  isFirst: z.boolean().optional(),
  isInitial: z.boolean().optional(),
  summary: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  nextActions: z.string().optional().nullable(),
  nextActionDueOn: z.string().optional().nullable(),
  contactMethod: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
})

// GET /api/evangelists/[id]/meetings - 面談履歴取得
export async function GET(_request: Request, context: unknown) {
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

    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    const normalize = (value?: string | null) => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }

    const nextActionText = normalize(meetingData.nextAction ?? meetingData.nextActions ?? null)
    const summaryText = normalize(meetingData.summary ?? meetingData.notes ?? null)
    const contactMethod = normalize(meetingData.contactMethod ?? meetingData.channel ?? null)

    let nextActionDueOn: Date | null = null
    const rawDueOn = normalize(meetingData.nextActionDueOn ?? null)
    if (rawDueOn) {
      const normalizedDateString = /\d{4}-\d{2}-\d{2}/.test(rawDueOn)
        ? `${rawDueOn}T00:00:00.000Z`
        : rawDueOn
      const parsed = new Date(normalizedDateString)
      if (!Number.isNaN(parsed.getTime())) {
        nextActionDueOn = parsed
      }
    }

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
        isFirst: meetingData.isInitial ?? meetingData.isFirst ?? false,
        summary: summaryText,
        nextActions: nextActionText,
        contactMethod,
      },
    })

    const columns = await getEvangelistColumnSet()
    const updatePayload = filterEvangelistData(
      {
        nextAction: nextActionText ?? null,
        nextActionDueOn,
        updatedAt: new Date(),
      },
      columns,
    )

    const select = buildEvangelistSelect(columns, {
      includeAssignedCs: true,
      includeCount: true,
    })

    const updatedEvangelist = await prisma.evangelist.update({
      where: { id },
      data: updatePayload,
      select,
    })

    const normalizedEvangelist = normalizeEvangelistResult(updatedEvangelist)

    return NextResponse.json(
      {
        ok: true,
        meeting,
        evangelist: normalizedEvangelist,
      },
      { status: 201 },
    )
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:meetings:post]', err?.code ?? 'UNKNOWN', err)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return NextResponse.json(
        { ok: false, error: 'Evangelist reference is invalid', code: err.code },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { ok: false, error: 'Internal server error', code: err?.code },
      { status: 500 },
    )
  }
}

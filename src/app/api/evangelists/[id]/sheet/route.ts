import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { filterEvangelistData, getEvangelistColumnSet } from '@/lib/evangelist-columns'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MeetingPayload = {
  date?: string
  isFirst?: boolean
  summary?: string | null
  nextActions?: string | null
  contactMethod?: string | null
}

type EvangelistPayload = {
  strength?: string | null
  contactPref?: string | null
  managementPhase?: string | null
}

function hasMeetingContent(payload: MeetingPayload | undefined) {
  if (!payload) return false

  return Boolean(
    payload.date ||
      (payload.summary && payload.summary.trim()) ||
      (payload.nextActions && payload.nextActions.trim()) ||
      (payload.contactMethod && payload.contactMethod.trim()) ||
      payload.isFirst === true
  )
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const meetingPayload: MeetingPayload | undefined = body?.meeting
    const evangelistPayload: EvangelistPayload | undefined = body?.evangelist

    const operations: Promise<unknown>[] = []

    if (hasMeetingContent(meetingPayload)) {
      const meetingDate = meetingPayload?.date ? new Date(meetingPayload.date) : new Date()

      if (Number.isNaN(meetingDate.getTime())) {
        return NextResponse.json({ error: 'Invalid meeting date' }, { status: 400 })
      }

      operations.push(
        prisma.meeting.create({
          data: {
            evangelistId: params.id,
            date: meetingDate,
            isFirst: Boolean(meetingPayload?.isFirst),
            summary: meetingPayload?.summary ?? null,
            nextActions: meetingPayload?.nextActions ?? null,
            contactMethod: meetingPayload?.contactMethod ?? null,
          },
          select: { id: true },
        })
      )
    }

    if (evangelistPayload) {
      const columns = await getEvangelistColumnSet()
      const filtered = filterEvangelistData(
        {
          strength: evangelistPayload.strength ?? undefined,
          contactMethod: evangelistPayload.contactPref ?? undefined,
          managementPhase: evangelistPayload.managementPhase ?? undefined,
        },
        columns
      )

      if (Object.keys(filtered).length > 0) {
        operations.push(
          prisma.evangelist.update({
            where: { id: params.id },
            data: filtered,
            select: { id: true },
          })
        )
      }
    }

    if (operations.length === 0) {
      return NextResponse.json({ ok: true })
    }

    await prisma.$transaction(operations)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[evangelists:sheet]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapRule, type RuleWithInnovator } from '../utils'

const updateSchema = z.object({
  innovatorId: z.number().int().nonnegative().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  tiers: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
})

async function requireAdmin() {
  const session = await getSession()
  if (!session.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized')
  }
  if (session.role !== 'ADMIN') {
    throw new Error('Forbidden')
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
    const segments = req.nextUrl.pathname.split('/')
    const id = segments[segments.length - 1] ?? ''
    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    const result = updateSchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const data = result.data
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const existing = await prisma.requiredIntroductionRule.findUnique({
      where: { id },
      include: {
        innovator: {
          select: { id: true, name: true, url: true, introPoint: true },
        },
      },
    }) as RuleWithInnovator | null

    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof data.innovatorId === 'number') {
      const innovator = await prisma.innovator.findUnique({
        where: { id: data.innovatorId },
        select: { id: true },
      })
      if (!innovator) {
        return NextResponse.json({ error: 'Innovator not found' }, { status: 404 })
      }
      updateData.innovatorId = data.innovatorId
    }

    if (data.startDate) {
      updateData.startDate = data.startDate
    }
    if (data.endDate) {
      updateData.endDate = data.endDate
    }

    const nextStart = (updateData.startDate as Date | undefined) ?? existing.startDate
    const nextEnd = (updateData.endDate as Date | undefined) ?? existing.endDate
    if (nextEnd < nextStart) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 })
    }

    if (data.tiers) {
      updateData.tiers = data.tiers.length ? JSON.stringify(Array.from(new Set(data.tiers))) : null
    }
    if (data.strengths) {
      updateData.strengths = data.strengths.length ? JSON.stringify(Array.from(new Set(data.strengths))) : null
    }

    const updated = await prisma.requiredIntroductionRule.update({
      where: { id },
      data: updateData,
      include: {
        innovator: {
          select: { id: true, name: true, url: true, introPoint: true },
        },
      },
    }) as RuleWithInnovator

    return NextResponse.json(mapRule(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[required-introduction:PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const segments = req.nextUrl.pathname.split('/')
    const id = segments[segments.length - 1] ?? ''
    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 })
    }

    await prisma.requiredIntroductionRule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[required-introduction:DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

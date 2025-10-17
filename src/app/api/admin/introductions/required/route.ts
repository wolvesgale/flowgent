import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapRule, type RuleWithInnovator } from './utils'

const ruleInputSchema = z.object({
  innovatorId: z.number().int().nonnegative(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
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

export async function GET() {
  try {
    await requireAdmin()

    const rules = await prisma.requiredIntroductionRule.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        innovator: {
          select: {
            id: true,
            name: true,
            url: true,
            introPoint: true,
          },
        },
      },
    }) as RuleWithInnovator[]

    return NextResponse.json({ rules: rules.map(mapRule) })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[required-introduction:GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const json = await req.json().catch(() => null)
    const result = ruleInputSchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { innovatorId, startDate, endDate, tiers, strengths } = result.data
    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 })
    }

    const innovator = await prisma.innovator.findUnique({
      where: { id: innovatorId },
      select: { id: true },
    })
    if (!innovator) {
      return NextResponse.json({ error: 'Innovator not found' }, { status: 404 })
    }

    const rule = await prisma.requiredIntroductionRule.create({
      data: {
        innovatorId,
        startDate,
        endDate,
        tiers: tiers && tiers.length ? JSON.stringify(Array.from(new Set(tiers))) : null,
        strengths: strengths && strengths.length ? JSON.stringify(Array.from(new Set(strengths))) : null,
      },
      include: {
        innovator: {
          select: {
            id: true,
            name: true,
            url: true,
            introPoint: true,
          },
        },
      },
    }) as RuleWithInnovator

    return NextResponse.json(mapRule(rule), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[required-introduction:POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

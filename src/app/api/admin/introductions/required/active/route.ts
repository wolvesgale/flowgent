import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapRule, parseStringArray, type RuleWithInnovator } from '../utils'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const evangelistId = url.searchParams.get('evangelistId')
    const atParam = url.searchParams.get('at')

    if (!evangelistId) {
      return NextResponse.json({ error: 'evangelistId is required' }, { status: 400 })
    }

    const at = atParam ? new Date(atParam) : new Date()
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: 'Invalid at parameter' }, { status: 400 })
    }

    const evangelist = await prisma.evangelist.findUnique({
      where: { id: evangelistId },
      select: { id: true, tier: true, strength: true },
    })

    if (!evangelist) {
      return NextResponse.json({ error: 'Evangelist not found' }, { status: 404 })
    }

    const rules = await prisma.requiredIntroductionRule.findMany({
      where: {
        startDate: { lte: at },
        endDate: { gte: at },
      },
      orderBy: { startDate: 'asc' },
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

    const matching = rules.filter((rule) => {
      const tiers = parseStringArray(rule.tiers)
      const strengths = parseStringArray(rule.strengths)
      const tierMatch = tiers.length === 0 || tiers.includes(evangelist.tier)
      const evangelistStrength = evangelist.strength ?? undefined
      const strengthMatch =
        strengths.length === 0 || (evangelistStrength ? strengths.includes(evangelistStrength) : false)

      return tierMatch && strengthMatch
    })

    return NextResponse.json({ rules: matching.map(mapRule) })
  } catch (error) {
    console.error('[required-introduction:active]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

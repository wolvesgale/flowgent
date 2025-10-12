import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import type { BusinessDomainValue } from '@/lib/business-domain'
import { getInnovatorColumns } from '@/lib/live-schema'
import {
  buildSelect,
  computeAvailability,
  mapPayloadToData,
  type InnovatorPayload,
} from './column-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUSINESS_DOMAIN_SET = new Set<BusinessDomainValue>(BUSINESS_DOMAIN_VALUES)

function normalizeDomain(input: unknown): BusinessDomainValue | undefined {
  if (input == null) {
    return undefined
  }

  const normalized = String(input).trim().toUpperCase() as BusinessDomainValue
  if (!normalized) {
    return undefined
  }

  return BUSINESS_DOMAIN_SET.has(normalized) ? normalized : undefined
}

function parsePositiveInt(value: string | null, defaultValue: number, max?: number) {
  const parsed = Number.parseInt((value ?? '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue
  }

  if (typeof max === 'number') {
    return Math.min(parsed, max)
  }

  return parsed
}

async function checkAdminPermission() {
  const session = await getSession()

  if (!session.isLoggedIn) {
    return false
  }

  return session.role === 'ADMIN'
}

export async function GET(request: Request) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クエリパラメータの取得
    const columns = await getInnovatorColumns()
    const availability = computeAvailability(columns)
    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = parsePositiveInt(searchParams.get('limit'), 10, 100)
    const search = (searchParams.get('search') ?? '').trim()
    const domain = availability.domain
      ? normalizeDomain(searchParams.get('domain'))
      : undefined

    const skip = (page - 1) * limit

    // 検索条件の構築
    const where: Prisma.InnovatorWhereInput = {}
    const orConditions: Prisma.InnovatorWhereInput[] = []

    if (search) {
      if (availability.company) {
        orConditions.push({ company: { contains: search, mode: 'insensitive' } })
      }

      if (availability.introductionPoint) {
        orConditions.push({ introductionPoint: { contains: search, mode: 'insensitive' } })
      }

      if (availability.url) {
        orConditions.push({ url: { contains: search, mode: 'insensitive' } })
      }
    }

    if (domain && availability.domain) {
      where.domain = domain
    }

    if (orConditions.length > 0) {
      where.OR = orConditions
    }

    const findManyArgs: Prisma.InnovatorFindManyArgs = {
      where,
      skip,
      take: limit,
    }

    const select = buildSelect(availability)

    if (availability.createdAt) {
      findManyArgs.orderBy = { createdAt: 'desc' }
    }

    if (select) {
      findManyArgs.select = select
    }

    // データ取得
    const [innovators, total] = await Promise.all([
      prisma.innovator.findMany(findManyArgs),
      prisma.innovator.count({ where }),
    ])

    return NextResponse.json({
      innovators,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[innovators:list]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const columns = await getInnovatorColumns()
    const availability = computeAvailability(columns)

    const body = await request
      .json()
      .catch(() => ({} as Record<string, unknown>))

    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const introductionPoint =
      typeof body.introductionPoint === 'string' ? body.introductionPoint.trim() : ''
    const rawDomain = body.domain
    const domainProvided =
      rawDomain !== undefined && rawDomain !== null && String(rawDomain).trim().length > 0

    if (!company) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: 'company は必須です',
        },
        { status: 400 }
      )
    }

    if (!availability.company) {
      return NextResponse.json(
        {
          error: 'Invalid schema',
          details: 'name/company 列が存在しないため登録できません',
        },
        { status: 500 }
      )
    }

    let domain: BusinessDomainValue | undefined
    if (availability.domain) {
      if (!domainProvided) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            details: 'domain は必須です',
          },
          { status: 400 }
        )
      }
      data.domain = domain
    }

      domain = normalizeDomain(rawDomain)
      if (!domain) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            details: 'domain は定義済みの値のみ許可されています',
          },
          { status: 400 }
        )
      }
    }

    const payload: InnovatorPayload = {
      company,
    }

    if (availability.domain && domain) {
      payload.domain = domain
    }
    if (availability.url && url.length > 0) {
      payload.url = url
    }
    if (availability.introductionPoint && introductionPoint.length > 0) {
      payload.introductionPoint = introductionPoint
    }

    const data = mapPayloadToData(payload, availability)
    const select = buildSelect(availability)

    const createArgs: Prisma.InnovatorCreateArgs = {
      data: data as Prisma.InnovatorCreateInput,
    }

    if (select) {
      createArgs.select = select
    }

    const innovator = await prisma.innovator.create(createArgs)

    return NextResponse.json({ ok: true, innovator }, { status: 201 })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[innovators:create]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json(
      { error: 'Internal server error', code: err?.code },
      { status: 500 }
    )
  }
}


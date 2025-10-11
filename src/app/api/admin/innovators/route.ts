import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import type { BusinessDomainValue } from '@/lib/business-domain'
import { getInnovatorColumns, hasColumn } from '@/lib/live-schema'

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
    const hasIdColumn = hasColumn(columns, 'id')
    const hasCompanyColumn = hasColumn(columns, 'company')
    const hasDomainColumn = hasColumn(columns, 'domain')
    const hasUrlColumn = hasColumn(columns, 'url')
    const hasIntroductionPointColumn = hasColumn(columns, 'introductionPoint')
    const hasCreatedAtColumn = hasColumn(columns, 'createdAt')
    const hasUpdatedAtColumn = hasColumn(columns, 'updatedAt')
    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = parsePositiveInt(searchParams.get('limit'), 10, 100)
    const search = (searchParams.get('search') ?? '').trim()
    const domain = normalizeDomain(searchParams.get('domain'))

    const skip = (page - 1) * limit

    // 検索条件の構築
    const where: Prisma.InnovatorWhereInput = {}
    const orConditions: Prisma.InnovatorWhereInput[] = []

    if (search) {
      if (hasCompanyColumn) {
        orConditions.push({ company: { contains: search, mode: 'insensitive' } })
      }

      if (hasIntroductionPointColumn) {
        orConditions.push({ introductionPoint: { contains: search, mode: 'insensitive' } })
      }

      if (hasUrlColumn) {
        orConditions.push({ url: { contains: search, mode: 'insensitive' } })
      }
    }

    if (domain && hasDomainColumn) {
      where.domain = domain
    }

    if (orConditions.length > 0) {
      where.OR = orConditions
    }

    const select: Prisma.InnovatorSelect = {}

    if (hasIdColumn) {
      select.id = true
    }
    if (hasCompanyColumn) {
      select.company = true
    }
    if (hasDomainColumn) {
      select.domain = true
    }
    if (hasCreatedAtColumn) {
      select.createdAt = true
    }
    if (hasUpdatedAtColumn) {
      select.updatedAt = true
    }
    if (hasUrlColumn) {
      select.url = true
    }
    if (hasIntroductionPointColumn) {
      select.introductionPoint = true
    }

    const findManyArgs: Prisma.InnovatorFindManyArgs = {
      where,
      skip,
      take: limit,
    }

    if (hasCreatedAtColumn) {
      findManyArgs.orderBy = { createdAt: 'desc' }
    }

    if (Object.keys(select).length > 0) {
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
    const hasIdColumn = hasColumn(columns, 'id')
    const hasCompanyColumn = hasColumn(columns, 'company')
    const hasDomainColumn = hasColumn(columns, 'domain')
    const hasUrlColumn = hasColumn(columns, 'url')
    const hasIntroductionPointColumn = hasColumn(columns, 'introductionPoint')
    const hasCreatedAtColumn = hasColumn(columns, 'createdAt')
    const hasUpdatedAtColumn = hasColumn(columns, 'updatedAt')

    const body = await request
      .json()
      .catch(() => ({} as Record<string, unknown>))

    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const introductionPoint =
      typeof body.introductionPoint === 'string' ? body.introductionPoint.trim() : ''

    if (!company) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: 'company は必須です',
        },
        { status: 400 }
      )
    }

    if (!hasCompanyColumn) {
      return NextResponse.json(
        { error: 'Invalid schema', details: 'company 列が存在しないため登録できません' },
        { status: 500 }
      )
    }

    const data: Record<string, unknown> = {
      company,
    }

    if (hasDomainColumn) {
      const domain = normalizeDomain(body.domain)
      if (!domain) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            details: 'domain は定義済みの値のみ許可されています',
          },
          { status: 400 }
        )
      }
      data.domain = domain
    }

    if (hasUrlColumn && url.length > 0) {
      data.url = url
    }

    if (hasIntroductionPointColumn && introductionPoint.length > 0) {
      data.introductionPoint = introductionPoint
    }

    const select: Prisma.InnovatorSelect = {}

    if (hasIdColumn) {
      select.id = true
    }
    if (hasCompanyColumn) {
      select.company = true
    }
    if (hasDomainColumn) {
      select.domain = true
    }
    if (hasCreatedAtColumn) {
      select.createdAt = true
    }
    if (hasUpdatedAtColumn) {
      select.updatedAt = true
    }
    if (hasUrlColumn) {
      select.url = true
    }
    if (hasIntroductionPointColumn) {
      select.introductionPoint = true
    }

    const createArgs: Prisma.InnovatorCreateArgs = {
      data: data as Prisma.InnovatorCreateInput,
    }

    if (Object.keys(select).length > 0) {
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


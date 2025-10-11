import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import type { BusinessDomainValue } from '@/lib/business-domain'
import { getInnovatorColumns, innovatorHasColumn } from '@/lib/innovator-columns'

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
      if (innovatorHasColumn(columns, 'company')) {
        orConditions.push({ company: { contains: search, mode: 'insensitive' } })
      }

      if (innovatorHasColumn(columns, 'introductionPoint')) {
        orConditions.push({ introductionPoint: { contains: search, mode: 'insensitive' } })
      }

      if (innovatorHasColumn(columns, 'url')) {
        orConditions.push({ url: { contains: search, mode: 'insensitive' } })
      }
    }

    if (domain && innovatorHasColumn(columns, 'domain')) {
      where.domain = domain
    }

    if (orConditions.length > 0) {
      where.OR = orConditions
    }

    const select: Prisma.InnovatorSelect = {
      id: true,
      company: true,
      domain: true,
      createdAt: true,
      updatedAt: true,
    }

    if (innovatorHasColumn(columns, 'url')) {
      select.url = true
    }

    if (innovatorHasColumn(columns, 'introductionPoint')) {
      select.introductionPoint = true
    }

    // データ取得
    const [innovators, total] = await Promise.all([
      prisma.innovator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select,
      }),
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

    const body = await request
      .json()
      .catch(() => ({} as Record<string, unknown>))

    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const domain = normalizeDomain(body.domain)
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const introductionPoint =
      typeof body.introductionPoint === 'string' ? body.introductionPoint.trim() : ''

    if (!company || !domain) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: 'company と domain は必須（domain は定義済みの値のみ許可）',
        },
        { status: 400 }
      )
    }

    const data: Prisma.InnovatorCreateInput = {
      company,
      domain,
    }

    if (innovatorHasColumn(columns, 'url') && url.length > 0) {
      data.url = url
    }

    if (innovatorHasColumn(columns, 'introductionPoint') && introductionPoint.length > 0) {
      data.introductionPoint = introductionPoint
    }

    const select: Prisma.InnovatorSelect = {
      id: true,
      company: true,
      domain: true,
      createdAt: true,
      updatedAt: true,
    }

    if (innovatorHasColumn(columns, 'url')) {
      select.url = true
    }

    if (innovatorHasColumn(columns, 'introductionPoint')) {
      select.introductionPoint = true
    }

    const innovator = await prisma.innovator.create({
      data,
      select,
    })

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


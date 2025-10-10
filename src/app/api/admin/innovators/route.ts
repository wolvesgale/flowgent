import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import type { BusinessDomainValue } from '@/lib/business-domain'

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
    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = parsePositiveInt(searchParams.get('limit'), 10, 100)
    const search = (searchParams.get('search') ?? '').trim()
    const domain = normalizeDomain(searchParams.get('domain'))

    const skip = (page - 1) * limit

    // 検索条件の構築
    const where: {
      OR?: Array<{
        company?: { contains: string; mode: 'insensitive' }
        introductionPoint?: { contains: string; mode: 'insensitive' }
        url?: { contains: string; mode: 'insensitive' }
      }>
      domain?: BusinessDomainValue
    } = {}

    if (search) {
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { introductionPoint: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (domain) {
      where.domain = domain
    }

    // データ取得
    const [innovators, total] = await Promise.all([
      prisma.innovator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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

    const innovator = await prisma.innovator.create({
      data: {
        company,
        domain,
        url: url.length > 0 ? url : undefined,
        introductionPoint: introductionPoint.length > 0 ? introductionPoint : undefined,
      },
      select: {
        id: true,
        company: true,
        url: true,
        introductionPoint: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
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


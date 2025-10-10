import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapBusinessDomainOrDefault, BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import type { BusinessDomainValue } from '@/lib/business-domain'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BusinessDomainEnum = z.enum(BUSINESS_DOMAIN_VALUES)

const innovatorSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  url: z
    .string()
    .url('Invalid URL')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  introductionPoint: z.string().optional(),
  domain: z.preprocess((value) => mapBusinessDomainOrDefault(value), BusinessDomainEnum),
})

async function checkAdminPermission() {
  const session = await getSession()

  if (!session.isLoggedIn) {
    return false
  }

  return session.role === 'ADMIN'
}

export async function GET(request: NextRequest) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const domain = searchParams.get('domain') || ''

    const skip = (page - 1) * limit

    // 検索条件の構築
    interface WhereInput {
      OR?: Array<{
        company?: { contains: string; mode: 'insensitive' }
        introductionPoint?: { contains: string; mode: 'insensitive' }
      }>
      domain?: BusinessDomainValue
    }
    
    const where: WhereInput = {}
    
    if (search) {
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { introductionPoint: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (domain && domain !== 'ALL') {
      where.domain = domain as WhereInput['domain']
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

export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // バリデーション
    const validatedData = innovatorSchema.parse(body)

    const innovator = await prisma.innovator.create({
      data: validatedData,
    })

    return NextResponse.json(innovator, { status: 201 })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.issues },
          { status: 400 }
        )
      }

      const err = error as { code?: string; message?: string }
      console.error('[innovators:create]', err?.code ?? 'UNKNOWN', err)
      return NextResponse.json(
        { error: 'Internal server error', code: err?.code },
        { status: 500 }
      )
    }
  }
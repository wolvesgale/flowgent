import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// バリデーションスキーマ
const innovatorSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  url: z.string().url('Invalid URL').optional().or(z.literal('')).transform((value) => value || undefined),
  introductionPoint: z.string().optional(),
  domain: z.enum(['HR', 'IT', 'ACCOUNTING', 'ADVERTISING', 'MANAGEMENT', 'SALES', 'MANUFACTURING', 'MEDICAL', 'FINANCE']),
})

async function checkAdminPermission(request: NextRequest) {
  const session = await getSession(request)

  if (!session.isLoggedIn || session.role !== 'ADMIN') {
    return false
  }
  return true
}

export async function GET(request: NextRequest) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission(request))) {
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
      domain?: 'HR' | 'IT' | 'ACCOUNTING' | 'ADVERTISING' | 'MANAGEMENT' | 'SALES' | 'MANUFACTURING' | 'MEDICAL' | 'FINANCE'
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
    console.error('Failed to fetch innovators:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission(request))) {
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

    console.error('Failed to create innovator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
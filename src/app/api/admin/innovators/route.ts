import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'
import { z } from 'zod'

// バリデーションスキーマ
const innovatorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  company: z.string().min(1, 'Company is required'),
  position: z.string().min(1, 'Position is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  requiresIntroduction: z.boolean(),
  notes: z.string().optional(),
})

async function checkAdminPermission() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  })

  if (!session.isLoggedIn || session.role !== 'ADMIN') {
    return false
  }
  return true
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
    const status = searchParams.get('status') || ''
    const requiresIntroduction = searchParams.get('requiresIntroduction') || ''

    const skip = (page - 1) * limit

    // 検索条件の構築
    interface WhereInput {
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' }
        email?: { contains: string; mode: 'insensitive' }
        company?: { contains: string; mode: 'insensitive' }
      }>
      status?: string
      requiresIntroduction?: boolean
    }
    
    const where: WhereInput = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (requiresIntroduction && requiresIntroduction !== '') {
      where.requiresIntroduction = requiresIntroduction === 'true'
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
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // バリデーション
    const validatedData = innovatorSchema.parse(body)

    // メールアドレスの重複チェック
    const existingInnovator = await prisma.innovator.findUnique({
      where: { email: validatedData.email }
    })

    if (existingInnovator) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // イノベータ作成
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
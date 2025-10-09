import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

interface WhereInput {
  OR?: Array<{
    firstName?: { contains: string; mode: 'insensitive' }
    lastName?: { contains: string; mode: 'insensitive' }
    email?: { contains: string; mode: 'insensitive' }
    meetings?: {
      none?: Record<string, never>
      every?: {
        date?: {
          lt: Date
        }
      }
    }
  }>
  meetings?: {
    none?: Record<string, never>
    every?: {
      date?: {
        lt: Date
      }
    }
  }
  tags?: {
    contains: string
  }
  assignedCsId?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const status = searchParams.get('status') || ''
    const stale = searchParams.get('stale') // M3: stale=7 for meetings older than 7 days
    const tag = searchParams.get('tag') // M3: tag filtering
    const assignedCsId = searchParams.get('assignedCsId') // 担当CSフィルタ

    const skip = (page - 1) * limit

    // 検索条件の構築
    const where: WhereInput = {}
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status && status !== 'ALL') {
      // Note: status field might not exist in current schema
      // where.status = status
    }

    // M3: Advanced filtering
    if (stale) {
      const staleDays = parseInt(stale)
      const staleDate = new Date()
      staleDate.setDate(staleDate.getDate() - staleDays)
      
      where.OR = [
        // No meetings at all
        { meetings: { none: {} } },
        // Latest meeting is older than stale days
        {
          meetings: {
            every: {
              date: {
                lt: staleDate
              }
            }
          }
        }
      ]
    }

    if (tag) {
      // Tags are stored as JSON string, so we need to use contains
      where.tags = {
        contains: tag
      }
    }

    if (assignedCsId) {
      where.assignedCsId = assignedCsId
    }

    // ソート条件の構築
    let orderBy: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>
    if (sortBy === 'name') {
      orderBy = [{ firstName: sortOrder as 'asc' | 'desc' }, { lastName: sortOrder as 'asc' | 'desc' }]
    } else {
      orderBy = { [sortBy]: sortOrder as 'asc' | 'desc' }
    }

    // データ取得
    const [evangelists, total] = await Promise.all([
      prisma.evangelist.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          assignedCs: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              meetings: true,
            },
          },
        },
      }),
      prisma.evangelist.count({ where }),
    ])

    return NextResponse.json({
      evangelists,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Failed to fetch evangelists:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
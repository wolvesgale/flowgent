import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['ADMIN', 'CS']).optional(),
})

// 管理者権限チェック
async function checkAdminPermission(request: NextRequest) {
  const session = await getSession(request)

  if (!session.isLoggedIn || !session.userId) {
    return { authorized: false, error: 'Unauthorized', status: 401 }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    return { authorized: false, error: 'Admin access required', status: 403 }
  }

  return { authorized: true, userId: session.userId }
}

// GET /api/admin/users/[id] - ユーザー詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkAdminPermission(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        assignedEvangelists: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            tier: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/users/[id] - ユーザー更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkAdminPermission(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { id } = await params

    const body = await request.json()
    
    // バリデーション
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: validationResult.error.issues },
        { status: 400 }
      )
    }

    const userData = validationResult.data
    const normalizedEmail = userData.email ? userData.email.trim().toLowerCase() : undefined

    // ユーザーが存在するかチェック
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // メールアドレスの重複チェック（自分以外）
    if (normalizedEmail) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: id },
        },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        )
      }
    }

    // 更新データを準備
    interface UpdateData {
      name?: string
      email?: string
      role?: 'ADMIN' | 'CS'
      password?: string
      updatedAt: Date
    }
    
    const updateData: UpdateData = { updatedAt: new Date() }
    if (userData.name) updateData.name = userData.name.trim()
    if (normalizedEmail) updateData.email = normalizedEmail
    if (userData.role) updateData.role = userData.role
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 12)
    }

    // ユーザーを更新
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - ユーザー削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkAdminPermission(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { id } = await params

    // ユーザーが存在するかチェック
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedEvangelists: true,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 自分自身を削除しようとしていないかチェック
    if (id === authCheck.userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // 割り当てられたEVAがある場合は警告
    if (existingUser.assignedEvangelists.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with assigned evangelists',
          assignedCount: existingUser.assignedEvangelists.length 
        },
        { status: 400 }
      )
    }

    // ユーザーを削除
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
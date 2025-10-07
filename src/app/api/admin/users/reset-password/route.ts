import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

// バリデーションスキーマ
const resetPasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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

export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // バリデーション
    const validatedData = resetPasswordSchema.parse(body)

    // ユーザー存在チェック
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 12)

    // パスワード更新
    await prisma.user.update({
      where: { id: validatedData.userId },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ 
      message: 'Password reset successfully',
      userId: validatedData.userId 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to reset password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
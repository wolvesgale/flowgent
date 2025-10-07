import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SessionData } from '@/lib/session'
import { z } from 'zod'

// バリデーションスキーマ
const innovatorUpdateSchema = z.object({
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()
    
    // バリデーション
    const validatedData = innovatorUpdateSchema.parse(body)

    // 存在チェック
    const existingInnovator = await prisma.innovator.findUnique({
      where: { id }
    })

    if (!existingInnovator) {
      return NextResponse.json(
        { error: 'Innovator not found' },
        { status: 404 }
      )
    }

    // メールアドレスの重複チェック（自分以外）
    if (validatedData.email !== existingInnovator.email) {
      const emailExists = await prisma.innovator.findUnique({
        where: { email: validatedData.email }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // イノベータ更新
    const updatedInnovator = await prisma.innovator.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedInnovator)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update innovator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // 存在チェック
    const existingInnovator = await prisma.innovator.findUnique({
      where: { id }
    })

    if (!existingInnovator) {
      return NextResponse.json(
        { error: 'Innovator not found' },
        { status: 404 }
      )
    }

    // イノベータ削除
    await prisma.innovator.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Innovator deleted successfully' })
  } catch (error) {
    console.error('Failed to delete innovator:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// バリデーションスキーマ
const innovatorUpdateSchema = z.object({
  company: z.string().min(1, 'Company is required').optional(),
  url: z.union([z.string().url('Invalid URL'), z.literal('')]).optional().transform((value) => (value === '' ? undefined : value)),
  introductionPoint: z.string().optional(),
  domain: z.enum(['HR', 'IT', 'ACCOUNTING', 'ADVERTISING', 'MANAGEMENT', 'SALES', 'MANUFACTURING', 'MEDICAL', 'FINANCE']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'No update fields provided',
})

async function checkAdminPermission() {
  const session = await getSession()

  if (!session.isLoggedIn) {
    return false
  }

  return session.role === 'ADMIN'
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: idParam } = await params
    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()
    
    // バリデーション
    const validatedData = innovatorUpdateSchema.parse(body)

    const existingInnovator = await prisma.innovator.findUnique({
      where: { id }
    })

    if (!existingInnovator) {
      return NextResponse.json(
        { error: 'Innovator not found' },
        { status: 404 }
      )
    }

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

      const err = error as { code?: string; message?: string }
      console.error('[innovators:update]', err?.code ?? 'UNKNOWN', err)
      return NextResponse.json(
        { error: 'Internal server error', code: err?.code },
        { status: 500 }
      )
    }
  }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: idParam } = await params
    const id = parseInt(idParam)
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
      const err = error as { code?: string; message?: string }
      console.error('[innovators:delete]', err?.code ?? 'UNKNOWN', err)
      return NextResponse.json(
        { error: 'Internal server error', code: err?.code },
        { status: 500 }
      )
    }
  }
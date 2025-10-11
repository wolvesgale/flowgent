import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapBusinessDomainOrDefault, BUSINESS_DOMAIN_VALUES } from '@/lib/business-domain'
import { getInnovatorColumns, innovatorHasColumn } from '@/lib/innovator-columns'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BusinessDomainEnum = z.enum(BUSINESS_DOMAIN_VALUES)

// バリデーションスキーマ
const innovatorUpdateSchema = z
  .object({
    company: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value
        const trimmed = value.trim()
        return trimmed.length === 0 ? undefined : trimmed
      },
      z.string().min(1, 'Company is required').optional()
    ),
    url: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value
        const trimmed = value.trim()
        return trimmed.length === 0 ? undefined : trimmed
      },
      z.string().url('Invalid URL').optional()
    ),
    introductionPoint: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value
        const trimmed = value.trim()
        return trimmed.length === 0 ? undefined : trimmed
      },
      z.string().optional()
    ),
    domain: z
      .preprocess(
        (value) => (value === undefined ? value : mapBusinessDomainOrDefault(value)),
        z.union([BusinessDomainEnum, z.undefined()])
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No update fields provided',
  })

async function checkAdminPermission() {
  const session = await getSession()

  if (!session.isLoggedIn) {
    return false
  }

  return session.role === 'ADMIN'
}

export async function PUT(request: Request, context: unknown) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: idParam } = (context as { params: { id: string } }).params
    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()

    // バリデーション
    const validatedData = innovatorUpdateSchema.parse(body)

    const existingInnovator = await prisma.innovator.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingInnovator) {
      return NextResponse.json(
        { error: 'Innovator not found' },
        { status: 404 }
      )
    }

    const columns = await getInnovatorColumns()

    const data: Prisma.InnovatorUpdateInput = {}

    if (validatedData.company !== undefined && innovatorHasColumn(columns, 'company')) {
      data.company = validatedData.company
    }

    if (validatedData.url !== undefined && innovatorHasColumn(columns, 'url')) {
      data.url = validatedData.url
    }

    if (
      validatedData.introductionPoint !== undefined &&
      innovatorHasColumn(columns, 'introductionPoint')
    ) {
      data.introductionPoint = validatedData.introductionPoint
    }

    if (validatedData.domain !== undefined && innovatorHasColumn(columns, 'domain')) {
      data.domain = validatedData.domain
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update for current schema' },
        { status: 400 }
      )
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

    const updatedInnovator = await prisma.innovator.update({
      where: { id },
      data,
      select,
    })

    return NextResponse.json({ ok: true, innovator: updatedInnovator })
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

export async function DELETE(_request: Request, context: unknown) {
  try {
    // 管理者権限チェック
    if (!(await checkAdminPermission())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: idParam } = (context as { params: { id: string } }).params
    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // 存在チェック
    const existingInnovator = await prisma.innovator.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingInnovator) {
      return NextResponse.json(
        { error: 'Innovator not found' },
        { status: 404 }
      )
    }

    // イノベータ削除
    await prisma.innovator.delete({
      where: { id },
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

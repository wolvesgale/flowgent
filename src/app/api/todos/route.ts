import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'

import { prisma } from '@/lib/prisma'
import { sessionOptions, type SessionData } from '@/lib/session'
import type { Prisma } from '@prisma/client'

function ensureSession(session: SessionData | undefined | null) {
  if (!session || !session.isLoggedIn || !session.userId) {
    return null
  }
  return session
}

function parseScope(raw: string | null): 'mine' | 'dueSoon' | 'all' {
  if (!raw) return 'mine'
  const value = raw.toLowerCase()
  if (value === 'duesoon') return 'dueSoon'
  if (value === 'all') return 'all'
  return 'mine'
}

function parseStatus(raw: string | null): 'OPEN' | 'DONE' | 'ALL' {
  if (!raw) return 'OPEN'
  const value = raw.toUpperCase()
  if (value === 'DONE' || value === 'ALL') return value
  return 'OPEN'
}

function parseTake(raw: string | null) {
  const parsed = Number(raw ?? '50')
  if (Number.isNaN(parsed) || parsed <= 0) return 50
  return Math.min(parsed, 200)
}

function normalizeDueOn(input: string | null | undefined): Date | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapTodo(todo: {
  id: string
  title: string
  notes: string | null
  dueOn: Date | null
  status: string
  assigneeId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes,
    dueOn: todo.dueOn ? todo.dueOn.toISOString() : null,
    status: todo.status as 'OPEN' | 'DONE' | string,
    assigneeId: todo.assigneeId,
    createdById: todo.createdById,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const session = ensureSession(
    await getIronSession<SessionData>(cookieStore, sessionOptions),
  )

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const scope = parseScope(url.searchParams.get('scope'))
  const status = parseStatus(url.searchParams.get('status'))
  const take = parseTake(url.searchParams.get('take'))
  const cursor = url.searchParams.get('cursor') || undefined
  const requestedAssigneeId = url.searchParams.get('assigneeId') || undefined

  const isAdmin = session.role === 'ADMIN'
  const where: Prisma.TodoWhereInput = {}
  const filters: Prisma.TodoWhereInput[] = []

  const statusFilter = status === 'ALL' ? undefined : status
  if (statusFilter) {
    where.status = statusFilter
  }

  if (scope === 'dueSoon') {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const orConditions: Prisma.TodoWhereInput[] = [
      { assigneeId: session.userId! },
    ]
    // 自分が作成したタスクも拾う
    orConditions.push({ createdById: session.userId! })
    filters.push({ OR: orConditions })
    filters.push({ dueOn: { not: null, lte: tomorrow } })
  } else if (scope === 'all' && isAdmin) {
    if (requestedAssigneeId && requestedAssigneeId !== 'all') {
      filters.push({ assigneeId: requestedAssigneeId })
    }
  } else {
    // mine or fallback for non-admins
    filters.push({
      OR: [
        { assigneeId: session.userId! },
        { createdById: session.userId! },
      ],
    })
  }

  if (filters.length === 1) {
    Object.assign(where, filters[0])
  } else if (filters.length > 1) {
    where.AND = filters
  }

  const findArgs: Prisma.TodoFindManyArgs = {
    where,
    orderBy: [
      { updatedAt: 'desc' as const },
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ],
    take,
    select: {
      id: true,
      title: true,
      notes: true,
      dueOn: true,
      status: true,
      assigneeId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  }

  if (cursor) {
    findArgs.skip = 1
    findArgs.cursor = { id: cursor }
  }

  const items = await prisma.todo.findMany(findArgs)
  const nextCursor = items.length === take ? items[items.length - 1].id : null

  return NextResponse.json({
    items: items.map(mapTodo),
    nextCursor,
  })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = ensureSession(
    await getIronSession<SessionData>(cookieStore, sessionOptions),
  )

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string
        notes?: string | null
        dueOn?: string | null
        assigneeId?: string | null
      }
    | null

  const title = body?.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }

  const notes = body?.notes?.trim() || null
  const dueOn = normalizeDueOn(body?.dueOn ?? null)

  let assigneeId = body?.assigneeId?.trim() || ''
  if (!assigneeId || session.role !== 'ADMIN') {
    assigneeId = session.userId!
  }

  const created = await prisma.todo.create({
    data: {
      title,
      notes,
      dueOn,
      status: 'OPEN',
      assigneeId,
      createdById: session.userId!,
    },
    select: {
      id: true,
      title: true,
      notes: true,
      dueOn: true,
      status: true,
      assigneeId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(mapTodo(created), { status: 201 })
}

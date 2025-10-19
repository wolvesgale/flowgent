import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import type { SessionData } from '@/lib/session'
import type { Prisma } from '@prisma/client'

const SELF = 'me'
const ALL = 'all'
const VALID_STATUSES = new Set(['OPEN', 'DONE'])

function normalizeDueOn(input: unknown): Date | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapTodo(todo: {
  id: string
  title: string
  notes: string | null
  dueOn: Date | null
  status: string
  assigneeId: string
  assignee: { id: string; name: string; role: 'ADMIN' | 'CS' } | null
  createdById: string
  createdBy: { id: string; name: string; role: 'ADMIN' | 'CS' } | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes,
    dueOn: todo.dueOn ? todo.dueOn.toISOString() : null,
    status: todo.status,
    assigneeId: todo.assigneeId,
    assignee: todo.assignee,
    createdById: todo.createdById,
    createdBy: todo.createdBy,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  }
}

async function getSessionOrUnauthorized(): Promise<SessionData> {
  const session = await getSession()
  if (!session.isLoggedIn || !session.userId) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
  return session
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrUnauthorized()
    const userId = session.userId!

    const url = new URL(request.url)
    const requestedStatus = (url.searchParams.get('status') || 'OPEN').toUpperCase()
    const requestedAssignee = url.searchParams.get('assigneeId')

    const where: Prisma.TodoWhereInput = {}
    const selfConditions: Prisma.TodoWhereInput[] = [
      { assigneeId: userId },
      { createdById: userId },
    ]

    let appliedAssignee: string | typeof ALL | typeof SELF = SELF

    if (session.role === 'ADMIN') {
      if (!requestedAssignee || requestedAssignee === ALL) {
        appliedAssignee = ALL
      } else if (requestedAssignee === SELF) {
        appliedAssignee = userId
        where.OR = selfConditions
      } else {
        appliedAssignee = requestedAssignee
        where.assigneeId = requestedAssignee
      }
    } else {
      appliedAssignee = userId
      where.OR = selfConditions
    }

    let appliedStatus: 'OPEN' | 'DONE' | 'ALL' = 'ALL'
    if (VALID_STATUSES.has(requestedStatus)) {
      appliedStatus = requestedStatus as 'OPEN' | 'DONE'
      where.status = requestedStatus
    }

    const todos = await prisma.todo.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { dueOn: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    let assignees: Array<{ id: string; name: string; role: 'ADMIN' | 'CS' }> | undefined
    if (session.role === 'ADMIN') {
      assignees = await prisma.user.findMany({
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
    }

    return NextResponse.json({
      ok: true,
      items: todos.map(mapTodo),
      currentUser: { id: userId, role: session.role ?? 'CS' },
      filters: {
        assigneeId: appliedAssignee === userId ? SELF : appliedAssignee,
        status: appliedStatus,
      },
      assignees,
    })
  } catch (error) {
    const err = error as { status?: number; message?: string }
    if (err?.status === 401) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[todos:get]', error)
    return NextResponse.json({ ok: false, error: 'Failed to load todos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrUnauthorized()
    const userId = session.userId!
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const titleRaw = typeof body.title === 'string' ? body.title.trim() : ''
    if (!titleRaw) {
      return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    }

    const notesRaw = typeof body.notes === 'string' ? body.notes.trim() : ''
    const dueOn = normalizeDueOn(body.dueOn)

    let assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId.trim() : ''
    if (!assigneeId || session.role !== 'ADMIN') {
      assigneeId = userId
    }

    const created = await prisma.todo.create({
      data: {
        title: titleRaw,
        notes: notesRaw || null,
        dueOn,
        assigneeId,
        createdById: userId,
      },
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    return NextResponse.json({ ok: true, item: mapTodo(created) }, { status: 201 })
  } catch (error) {
    const err = error as { status?: number; message?: string }
    if (err?.status === 401) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[todos:post]', error)
    return NextResponse.json({ ok: false, error: 'Failed to create todo' }, { status: 500 })
  }
}

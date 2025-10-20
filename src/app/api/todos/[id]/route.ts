import { NextRequest, NextResponse } from 'next/server'
import type { Params } from 'next/dist/server/request/params'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import type { SessionData } from '@/lib/session'

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

async function getSessionOrUnauthorized(): Promise<SessionData> {
  const session = await getSession()
  if (!session.isLoggedIn || !session.userId) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
  return session
}

function canManageTodo(session: SessionData, todo: { assigneeId: string; createdById: string }) {
  if (session.role === 'ADMIN') return true
  return todo.assigneeId === session.userId || todo.createdById === session.userId
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

function extractId(params: Params | undefined): string | null {
  if (!params) return null
  const value = params.id
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getSessionOrUnauthorized()
    const resolvedParams = await params
    const id = extractId(resolvedParams)
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })
    }

    const existing = await prisma.todo.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, createdById: true },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }

    if (!canManageTodo(session, existing)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const titleRaw = typeof body.title === 'string' ? body.title.trim() : ''
      if (!titleRaw) {
        return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
      }
      updates.title = titleRaw
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const notesRaw = typeof body.notes === 'string' ? body.notes.trim() : ''
      updates.notes = notesRaw || null
    }

    if (Object.prototype.hasOwnProperty.call(body, 'dueOn')) {
      updates.dueOn = normalizeDueOn(body.dueOn)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
      if (!VALID_STATUSES.has(statusRaw)) {
        return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 })
      }
      updates.status = statusRaw
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No changes provided' }, { status: 400 })
    }

    const updated = await prisma.todo.update({
      where: { id },
      data: updates,
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    })

    return NextResponse.json({ ok: true, item: mapTodo(updated) })
  } catch (error) {
    const err = error as { status?: number; message?: string }
    if (err?.status === 401) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (err?.status === 403) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
    console.error('[todos:put]', error)
    return NextResponse.json({ ok: false, error: 'Failed to update todo' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getSessionOrUnauthorized()
    const resolvedParams = await params
    const id = extractId(resolvedParams)
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })
    }

    const existing = await prisma.todo.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, createdById: true },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }

    if (!canManageTodo(session, existing)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    await prisma.todo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const err = error as { status?: number; message?: string }
    if (err?.status === 401) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (err?.status === 403) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
    console.error('[todos:delete]', error)
    return NextResponse.json({ ok: false, error: 'Failed to delete todo' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  })
  if (!session.isLoggedIn || session.role !== 'ADMIN') throw new Error('Unauthorized')
}

function requireToken(req: NextRequest) {
  const t = req.headers.get('x-setup-token')
  if (!t || t !== process.env.SETUP_TOKEN) throw new Error('Forbidden')
}

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`

async function copyTable(fromSchema: string, table: string, key: string) {
  const src = `${esc(fromSchema)}.${esc(table)}`
  const dst = `"public".${esc(table)}`
  // カラム存在を自動合わせ（name/company の場合に備え、COALESCE で吸収）
  if (table === 'Innovator') {
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${dst} ("id","createdAt","updatedAt","name","url","introPoint","email")
      SELECT i."id", COALESCE(i."createdAt", NOW()), COALESCE(i."updatedAt", NOW()),
             COALESCE(i."company", i."name") as "name",
             i."url", i."introPoint", i."email"
      FROM ${src} i
      ON CONFLICT ("${key}") DO NOTHING
    `)
    return
  }
  // 汎用（同じカラム前提）：id/createdAt/updatedAt/その他はそのまま
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${dst} SELECT * FROM ${src}
    ON CONFLICT ("${key}") DO NOTHING
  `)
}

type MoveRequestBody = {
  fromSchema?: string
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    requireToken(req)
    const body = (await req.json().catch(() => ({}))) as MoveRequestBody
    const { fromSchema = 'public' } = body
    if (!fromSchema || fromSchema === 'public')
      return NextResponse.json({ ok: true, note: 'fromSchema is public; nothing to do' })

    // User / Innovator / evangelists の順に idempotent copy
    await copyTable(fromSchema, 'User', 'id')
    await copyTable(fromSchema, 'Innovator', 'id')
    await copyTable(fromSchema, 'evangelists', 'id')

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[ops:move-schema]', error)
    const message = error instanceof Error ? error.message : 'error'
    const code = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: message }, { status: code })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaSource } from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'
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

async function scan(client: PrismaClient) {
  const db = await client.$queryRaw<{ current_database: string }[]>`SELECT current_database()`
  const host = await client.$queryRaw<{ inet_server_addr: string }[]>`SELECT inet_server_addr()`
  const tables = await client.$queryRaw<{ table_schema: string; table_name: string }[]>`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
    ORDER BY table_schema, table_name
  `
  // 代表3テーブルの件数（スキーマ横断）
  const counts = await client.$queryRaw<{
    table_schema: string
    table_name: string
    cnt: bigint
  }[]>`
    WITH targets AS (
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name IN ('User','Innovator','evangelists')
    )
    SELECT t.table_schema, t.table_name, COUNT(*)::bigint AS cnt
    FROM targets t
    JOIN pg_catalog.pg_class c ON (c.relname = t.table_name)
    JOIN pg_catalog.pg_namespace n ON (n.nspname = t.table_schema)
    JOIN pg_catalog.pg_attribute a ON (a.attrelid = c.oid)
    GROUP BY t.table_schema, t.table_name
  `
  return {
    database: db[0]?.current_database,
    host: host[0]?.inet_server_addr,
    tables,
    counts: counts.map((x) => ({ schema: x.table_schema, table: x.table_name, count: Number(x.cnt) })),
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    requireToken(req)
    const main = await scan(prisma)
    const source = prismaSource ? await scan(prismaSource) : null
    return NextResponse.json({ main, source })
  } catch (error: unknown) {
    console.error('[ops:diagnose]', error)
    const message = error instanceof Error ? error.message : 'error'
    const code = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: message }, { status: code })
  }
}

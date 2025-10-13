import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getInnovatorSchemaSnapshot } from '@/lib/innovator-columns'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const evangelistColumns = await prisma.$queryRawUnsafe<
      { column_name: string }[]
    >(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'evangelists'
      ORDER BY ordinal_position
    `)

    const innovatorSnapshot = await getInnovatorSchemaSnapshot({ refresh: true })
    const innovatorColumns = Array.from(innovatorSnapshot.columns).sort((a, b) => a.localeCompare(b))

    return NextResponse.json({
      ok: true,
      evangelistsColumns: evangelistColumns.map((column) => column.column_name),
      innovatorsColumns: innovatorColumns,
    })
  } catch (e) {
    console.error('DB healthcheck failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

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

    const innovatorColumns = await prisma.$queryRawUnsafe<
      { column_name: string }[]
    >(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'innovators'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      ok: true,
      evangelistsColumns: evangelistColumns.map((column) => column.column_name),
      innovatorsColumns: innovatorColumns.map((column) => column.column_name),
    })
  } catch (e) {
    console.error('DB healthcheck failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  getInnovatorColumnMetaCached,
  getInnovatorSchemaSnapshot,
} from '@/lib/innovator-columns'

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
    const innovatorMeta = await getInnovatorColumnMetaCached()
    const innovatorColumns = Array.from(innovatorSnapshot.columns).sort((a, b) =>
      a.localeCompare(b),
    )
    const innovatorColumnDetails = Array.from(
      innovatorSnapshot.columnDetails.entries(),
    )
      .map(([column, details]) => ({
        column,
        isNullable: details.isNullable,
        hasDefault: details.hasDefault,
      }))
      .sort((a, b) => a.column.localeCompare(b.column))

    return NextResponse.json({
      ok: true,
      evangelistsColumns: evangelistColumns.map((column) => column.column_name),
      innovator: {
        tableName: innovatorSnapshot.tableName,
        columns: innovatorColumns,
        columnDetails: innovatorColumnDetails,
        hasEmail: innovatorMeta.hasEmail,
        emailRequired: innovatorMeta.emailRequired,
      },
    })
  } catch (e) {
    console.error('DB healthcheck failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

import { prisma } from '@/lib/prisma'

export type ColumnSet = Set<string>

let cachedColumns: ColumnSet | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000

async function fetchInnovatorColumns(): Promise<ColumnSet> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND LOWER(table_name) IN ('innovator', 'innovators')
  `

  return new Set(rows.map((row) => row.column_name.toLowerCase()))
}

export async function getInnovatorColumns(): Promise<ColumnSet> {
  const now = Date.now()
  if (cachedColumns && now - cachedAt < CACHE_TTL_MS) {
    return cachedColumns
  }

  cachedColumns = await fetchInnovatorColumns()
  cachedAt = now
  return cachedColumns
}

export function innovatorHasColumn(columns: ColumnSet, name: string) {
  return columns.has(name.toLowerCase())
}

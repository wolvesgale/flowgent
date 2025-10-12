import { prisma } from '@/lib/prisma'

export type ColumnSet = Set<string>

let cachedInnovatorColumns: ColumnSet | null = null
let innovatorColumnsFetchedAt = 0
const CACHE_TTL_MS = 60_000

async function fetchTableColumns(tableNames: string[]): Promise<ColumnSet> {
  if (tableNames.length === 0) {
    return new Set()
  }

  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ANY(${tableNames})
  `

  return new Set(rows.map((row) => row.column_name))
}

export async function getInnovatorColumns(): Promise<ColumnSet> {
  const now = Date.now()
  if (cachedInnovatorColumns && now - innovatorColumnsFetchedAt < CACHE_TTL_MS) {
    return cachedInnovatorColumns
  }

  // Prisma defaults to "Innovator" (PascalCase singular). Support common variations
  // so we can survive environments with differing casing or @@map overrides.
  const candidates = ['Innovator', 'innovators', 'innovator', 'Innovators']

  cachedInnovatorColumns = await fetchTableColumns(candidates)
  innovatorColumnsFetchedAt = now
  return cachedInnovatorColumns
}

export function resolveColumnName(
  columns: ColumnSet,
  ...candidates: string[]
): string | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const target = candidate.toLowerCase()
    for (const column of columns) {
      if (column === candidate || column.toLowerCase() === target) {
        return column
      }
    }
  }

  return null
}

export function hasAnyColumn(columns: ColumnSet, ...names: string[]): boolean {
  return resolveColumnName(columns, ...names) !== null
}

export function hasColumn(columns: ColumnSet, name: string): boolean {
  return hasAnyColumn(columns, name)
}

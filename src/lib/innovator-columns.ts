import { prisma } from '@/lib/prisma'

export type ColumnSet = Set<string>

const TABLE_CANDIDATES = ['innovators', 'Innovator', 'Innovators', 'innovator'] as const
const CACHE_TTL_MS = 60_000

export interface InnovatorSchemaSnapshot {
  tableName: string | null
  columns: ColumnSet
}

let cachedSnapshot: InnovatorSchemaSnapshot | null = null
let cachedAt = 0

function chooseTableName(rows: Array<{ table_name: string; column_name: string }>): string | null {
  if (rows.length === 0) {
    return null
  }

  const grouped = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = grouped.get(row.table_name) ?? new Set<string>()
    set.add(row.column_name)
    grouped.set(row.table_name, set)
  }

  let bestTable: string | null = null
  let bestCount = -1
  for (const [tableName, columns] of grouped.entries()) {
    if (columns.size > bestCount) {
      bestTable = tableName
      bestCount = columns.size
    }
  }

  return bestTable
}

async function fetchInnovatorSnapshot(): Promise<InnovatorSchemaSnapshot> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ANY(${TABLE_CANDIDATES})
    ORDER BY ordinal_position
  `

  const tableName = chooseTableName(rows)
  const relevantRows = tableName ? rows.filter((row) => row.table_name === tableName) : rows
  const columns = new Set(relevantRows.map((row) => row.column_name))

  return {
    tableName,
    columns,
  }
}

export async function getInnovatorSchemaSnapshot(options: { refresh?: boolean } = {}): Promise<InnovatorSchemaSnapshot> {
  const now = Date.now()
  if (!options.refresh && cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot
  }

  cachedSnapshot = await fetchInnovatorSnapshot()
  cachedAt = now
  return cachedSnapshot
}

export async function getInnovatorColumns(): Promise<ColumnSet> {
  const snapshot = await getInnovatorSchemaSnapshot()
  return snapshot.columns
}

export function resolveInnovatorColumn(columns: ColumnSet, target: string): string | null {
  if (!target) {
    return null
  }

  const lower = target.toLowerCase()
  for (const column of columns) {
    if (column === target) {
      return column
    }
    if (column.toLowerCase() === lower) {
      return column
    }
  }

  return null
}

export function resetInnovatorSchemaCache() {
  cachedSnapshot = null
  cachedAt = 0
}

import { prisma } from '@/lib/prisma'

export type ColumnSet = Set<string>

const TABLE_CANDIDATES = ['innovators', 'Innovator', 'Innovators', 'innovator'] as const
const TABLE_CANDIDATE_SET = new Set<string>(TABLE_CANDIDATES)
const CACHE_TTL_MS = 60_000

export interface InnovatorColumnDetails {
  isNullable: boolean
  hasDefault: boolean
}

export interface InnovatorSchemaSnapshot {
  tableName: string | null
  columns: ColumnSet
  columnDetails: Map<string, InnovatorColumnDetails>
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
  const rows = await prisma.$queryRaw<
    Array<{ table_name: string; column_name: string; is_nullable: 'YES' | 'NO'; column_default: string | null }>
  >`
    SELECT table_name, column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ANY(${TABLE_CANDIDATES})
    ORDER BY ordinal_position
  `

  const tableName = chooseTableName(rows)
  const relevantRows = tableName ? rows.filter((row) => row.table_name === tableName) : rows
  const columns = new Set(relevantRows.map((row) => row.column_name))
  const columnDetails = new Map<string, InnovatorColumnDetails>()

  for (const row of relevantRows) {
    columnDetails.set(row.column_name, {
      isNullable: row.is_nullable === 'YES',
      hasDefault: row.column_default != null,
    })
  }

  return {
    tableName,
    columns,
    columnDetails,
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

export interface InnovatorColumnMeta {
  tableName: string
  hasEmail: boolean
  emailRequired: boolean
}

export async function getInnovatorColumnMetaCached(): Promise<InnovatorColumnMeta> {
  const snapshot = await getInnovatorSchemaSnapshot()
  const emailColumn = resolveInnovatorColumn(snapshot.columns, 'email')
  const emailDetails = emailColumn ? snapshot.columnDetails.get(emailColumn) : undefined

  const hasEmail = Boolean(emailColumn)
  const emailRequired = Boolean(
    emailDetails && !emailDetails.isNullable && !emailDetails.hasDefault,
  )

  const resolvedTableName =
    snapshot.tableName && TABLE_CANDIDATE_SET.has(snapshot.tableName)
      ? snapshot.tableName
      : 'Innovator'

  return {
    tableName: resolvedTableName,
    hasEmail,
    emailRequired,
  }
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

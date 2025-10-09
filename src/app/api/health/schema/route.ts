import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [users, evangelists, innovators, migrations] = await Promise.all([
      prisma.user.count(),
      prisma.evangelist.count(),
      prisma.innovator.count(),
      prisma
        .$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM _prisma_migrations`
        .catch((error) => {
          const err = error as { code?: string; message?: string }
          console.error('[health:schema:migrations]', err?.code ?? 'UNKNOWN', err)
          return [] as { n: number }[]
        }),
    ])

    const migrationCount = migrations[0]?.n ?? 0

    return NextResponse.json({ users, evangelists, innovators, migrations: migrationCount })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    console.error('[health:schema]', err?.code ?? 'UNKNOWN', err)
    return NextResponse.json({ error: String(err?.message ?? error) }, { status: 500 })
  }
}

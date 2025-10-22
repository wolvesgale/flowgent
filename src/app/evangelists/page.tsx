import { Suspense } from 'react'
import EvangelistsPageClient from './_components/EvangelistsPageClient'

export const dynamic = 'force-dynamic'

// 許容値をリテラルで固定
const ALLOWED = [30, 50, 100] as const

type PageSize = typeof ALLOWED[number]

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  const raw = Array.isArray(sp.pageSize) ? sp.pageSize[0] : sp.pageSize
  const n = Number(raw)

  const initialPageSize: PageSize = ALLOWED.includes(n as PageSize)
    ? (n as PageSize)
    : 30

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">読み込み中…</div>}>
      <EvangelistsPageClient initialPageSize={initialPageSize} />
    </Suspense>
  )
}

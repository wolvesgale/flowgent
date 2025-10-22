import { Suspense } from 'react'

import EvangelistsPageClient from './_components/EvangelistsPageClient'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  const raw = Array.isArray(sp.pageSize) ? sp.pageSize[0] : sp.pageSize
  const parsed = Number(raw)
  const initialPageSize = [30, 50, 100].includes(parsed) ? parsed : 30

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">読み込み中…</div>}>
      <EvangelistsPageClient initialPageSize={initialPageSize} />
    </Suspense>
  )
}

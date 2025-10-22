import { Suspense } from 'react'

import EvangelistsPageClient from './_components/EvangelistsPageClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function Page({ searchParams }: PageProps) {
  const raw = Array.isArray(searchParams.pageSize)
    ? searchParams.pageSize[0]
    : searchParams.pageSize

  const parsed = Number(raw)
  const initialPageSize = [30, 50, 100].includes(parsed) ? parsed : 30

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">読み込み中…</div>}>
      <EvangelistsPageClient initialPageSize={initialPageSize} />
    </Suspense>
  )
}

import { Suspense } from 'react'

import EvangelistsPageClient from './_components/EvangelistsPageClient'
import PageSizeSelect from './_components/PageSizeSelect'

const PAGE_SIZE_OPTIONS = [30, 50, 100] as const

type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function EvangelistsPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {}
  const raw = resolved.pageSize
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? '30', 10)
  const take = (PAGE_SIZE_OPTIONS.find(option => option === parsed) ?? 30) as PageSizeOption

  return (
    <EvangelistsPageClient
      initialPageSize={take}
      pageSizeSelector={
        <Suspense fallback={<div className="text-sm text-slate-500">…</div>}>
          <PageSizeSelect />
        </Suspense>
      }
    />
  )
}

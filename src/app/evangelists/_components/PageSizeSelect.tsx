'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = ['30', '50', '100'] as const

type PageSizeValue = (typeof PAGE_SIZE_OPTIONS)[number]

export default function PageSizeSelect() {
  const router = useRouter()
  const sp = useSearchParams()
  const raw = sp.get('pageSize') ?? '30'
  const pageSize = PAGE_SIZE_OPTIONS.includes(raw as PageSizeValue)
    ? (raw as PageSizeValue)
    : '30'

  function updateSize(size: string) {
    const params = new URLSearchParams(sp.toString())
    params.set('pageSize', size)
    params.set('page', '1')
    router.push(`/evangelists?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">表示件数</span>
      <Select value={pageSize} onValueChange={updateSize}>
        <SelectTrigger className="w-[96px]">
          <SelectValue placeholder="30" />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

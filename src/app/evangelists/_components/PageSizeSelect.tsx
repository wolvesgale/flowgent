'use client'

import type { ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [30, 50, 100] as const

type PageSizeValue = (typeof OPTIONS)[number]

type Props = {
  value: PageSizeValue
  onChange: (value: PageSizeValue) => void
}

export default function PageSizeSelect({ value, onChange }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = Number(event.target.value)
    const normalized = OPTIONS.includes(nextValue as PageSizeValue)
      ? (nextValue as PageSizeValue)
      : 30

    onChange(normalized)

    const params = new URLSearchParams(searchParams.toString())
    params.set('pageSize', String(normalized))
    params.set('page', '1')

    const query = params.toString()
    router.replace(query ? `?${query}` : '?')
  }

  return (
    <select
      value={String(value)}
      onChange={handleChange}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
    >
      {OPTIONS.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

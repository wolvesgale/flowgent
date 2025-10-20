'use client'

import useSWR, { mutate as globalMutate, type KeyedMutator } from 'swr'

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' })
  const text = await response.text()
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }
  if (!response.ok) {
    throw new Error(text || response.statusText)
  }
  if (!text) return { items: [], nextCursor: null }
  return JSON.parse(text)
}

export type TodoItem = {
  id: string
  title: string
  notes: string | null
  dueOn: string | null
  status: 'OPEN' | 'DONE' | string
  assigneeId: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export type TodoListResponse = {
  items: TodoItem[]
  nextCursor: string | null
}

type UseTodosParams = {
  scope: 'mine' | 'dueSoon' | 'all'
  status?: 'OPEN' | 'DONE' | 'ALL'
  take?: number
  assigneeId?: string | null
}

function buildKey(params: UseTodosParams) {
  const searchParams = new URLSearchParams()
  searchParams.set('scope', params.scope)
  searchParams.set('status', params.status ?? 'OPEN')
  searchParams.set('take', String(params.take ?? 50))
  if (params.assigneeId) {
    searchParams.set('assigneeId', params.assigneeId)
  }
  return `/api/todos?${searchParams.toString()}`
}

export function useTodos(params: UseTodosParams) {
  const key = buildKey(params)
  const { data, error, isLoading, mutate } = useSWR<TodoListResponse>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30_000,
    dedupingInterval: 10_000,
  })

  return {
    key,
    data,
    error,
    isLoading,
    mutate,
    items: data?.items ?? [],
    nextCursor: data?.nextCursor ?? null,
  }
}

export function mutateTodosKey(key: string, data?: TodoListResponse | null, revalidate = false) {
  return globalMutate<TodoListResponse>(key, data ?? undefined, { revalidate })
}

export type TodosMutate = KeyedMutator<TodoListResponse>

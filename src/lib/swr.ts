'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Fetcher<Data> = (key: string) => Promise<Data>

type MutateOptions = {
  revalidate?: boolean
}

export type KeyedMutator<Data> = (
  data?: Data | ((current: Data | undefined) => Data | undefined),
  options?: MutateOptions,
) => Promise<unknown>

type SWROptions = {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  refreshInterval?: number
  dedupingInterval?: number
}

type CacheEntry<Data = unknown, Error = unknown> = {
  data?: Data
  error?: Error
  timestamp: number
  isValidating: boolean
}

const cache = new Map<string, CacheEntry>()
const listeners = new Map<string, Set<() => void>>()

function ensureEntry(key: string) {
  if (!cache.has(key)) {
    cache.set(key, { timestamp: 0, isValidating: false })
  }
  return cache.get(key) as CacheEntry
}

function notify(key: string) {
  const subs = listeners.get(key)
  if (!subs) return
  subs.forEach((cb) => cb())
}

async function fetchData<Data>(key: string, fetcher: Fetcher<Data>) {
  const entry = ensureEntry(key)
  entry.isValidating = true
  notify(key)
  try {
    const data = await fetcher(key)
    entry.data = data
    entry.error = undefined
    entry.timestamp = Date.now()
    return data
  } catch (error) {
    entry.error = error as unknown
    throw error
  } finally {
    entry.isValidating = false
    notify(key)
  }
}

export function mutate<Data = unknown>(key: string, data?: Data, options: MutateOptions = {}) {
  if (!key) return Promise.resolve()
  const entry = ensureEntry(key)
  if (typeof data !== 'undefined') {
    entry.data = data
    entry.error = undefined
    entry.timestamp = Date.now()
    notify(key)
  }
  if (options.revalidate) {
    const revalidate = revalidators.get(key)
    if (revalidate) {
      return revalidate()
    }
  }
  return Promise.resolve()
}

const revalidators = new Map<string, () => Promise<void>>()

export default function useSWR<Data = unknown, Error = unknown>(
  key: string,
  fetcher: Fetcher<Data>,
  options: SWROptions = {},
) {
  const entry = ensureEntry(key)
  const [data, setData] = useState<Data | undefined>(entry.data as Data | undefined)
  const [error, setError] = useState<Error | undefined>(entry.error as Error | undefined)
  const [isValidating, setIsValidating] = useState(entry.isValidating)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const revalidate = useCallback(async () => {
    try {
      const result = await fetchData(key, fetcher)
      setData(result)
      setError(undefined)
    } catch (err) {
      setError(err as Error)
    }
  }, [key, fetcher])

  revalidators.set(key, revalidate)

  useEffect(() => {
    const update = () => {
      const latest = ensureEntry(key)
      setData(latest.data as Data | undefined)
      setError(latest.error as Error | undefined)
      setIsValidating(latest.isValidating)
    }
    const subs = listeners.get(key) ?? new Set<() => void>()
    subs.add(update)
    listeners.set(key, subs)
    update()
    return () => {
      subs.delete(update)
      if (subs.size === 0) {
        listeners.delete(key)
      }
    }
  }, [key])

  useEffect(() => {
    const entry = ensureEntry(key)
    const now = Date.now()
    const dedupingInterval = optionsRef.current.dedupingInterval ?? 0
    if (!entry.data || now - entry.timestamp > dedupingInterval) {
      void revalidate()
    }
  }, [key, revalidate])

  useEffect(() => {
    if (!optionsRef.current.refreshInterval) return
    const interval = window.setInterval(() => {
      void revalidate()
    }, optionsRef.current.refreshInterval)
    return () => window.clearInterval(interval)
  }, [revalidate])

  const boundMutate = useCallback<KeyedMutator<Data | undefined>>(
    async (updater, mutateOptions) => {
      if (typeof updater === 'function') {
        const entry = ensureEntry(key)
        const handler = updater as (current: Data | undefined) => Data | undefined
        const nextData = handler(entry.data as Data | undefined)
        entry.data = nextData
        entry.error = undefined
        entry.timestamp = Date.now()
        notify(key)
        if (mutateOptions?.revalidate) {
          await revalidate()
        }
        return nextData
      }
      if (typeof updater !== 'undefined') {
        await mutate<Data | undefined>(key, updater as Data | undefined, mutateOptions)
      } else if (mutateOptions?.revalidate) {
        await revalidate()
      }
      return undefined
    },
    [key, revalidate],
  )

  return {
    data: data as Data | undefined,
    error,
    isLoading: isValidating && typeof data === 'undefined',
    isValidating,
    mutate: boundMutate,
  }
}

export { useSWR }

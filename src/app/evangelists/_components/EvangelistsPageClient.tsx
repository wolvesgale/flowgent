'use client'

import type { ReactNode } from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, ArrowUpDown, X, Pencil, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const STRENGTH_LABELS = {
  HR: '人事',
  IT: 'IT',
  ACCOUNTING: '会計',
  ADVERTISING: '広告',
  MANAGEMENT: '経営',
  SALES: '営業',
  MANUFACTURING: '製造',
  MEDICAL: '医療',
  FINANCE: '金融',
} as const

const CONTACT_LABELS = {
  FACEBOOK: 'Facebook',
  LINE: 'LINE',
  EMAIL: 'メール',
  PHONE: '電話',
  SLACK: 'Slack',
} as const

const MANAGEMENT_PHASE_LABELS = {
  INQUIRY: '問い合わせ',
  FIRST_MEETING: '初回面談',
  REGISTERED: '登録',
  LIST_PROVIDED: 'リスト提供/突合',
  INNOVATOR_REVIEW: 'イノベータ確認',
  INTRODUCTION_STARTED: '紹介開始',
  MEETING_SCHEDULED: '商談設定',
  FIRST_RESULT: '初回実績',
  CONTINUED_PROPOSAL: '継続提案',
} as const

type StrengthKey = keyof typeof STRENGTH_LABELS
type ContactKey = keyof typeof CONTACT_LABELS
type ManagementPhaseKey = keyof typeof MANAGEMENT_PHASE_LABELS

interface Evangelist {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  strength?: StrengthKey | null
  contactMethod?: ContactKey | null
  managementPhase?: ManagementPhaseKey | null
  listProvided?: boolean | null
  nextAction?: string | null
  nextActionDueOn?: string | null
  notes?: string | null
  tier: 'TIER1' | 'TIER2'
  assignedCsId?: string | null
  assignedCs?: {
    id: string
    name: string
  } | null
  createdAt: string
  _count: {
    meetings: number
  }
}

interface User {
  id: string
  name: string
  role: 'ADMIN' | 'CS'
}

interface EvangelistListSuccessResponse {
  ok: true
  items: Evangelist[]
  total: number
  page: number
  limit: number
}

interface EvangelistListErrorResponse {
  ok?: false
  error?: string
  message?: string
}

interface EvangelistCreateSuccessResponse {
  ok: true
  item: Evangelist
}

const isEvangelistListResponse = (
  value: unknown,
): value is EvangelistListSuccessResponse => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  if (record.ok !== true) {
    return false
  }

  return (
    Array.isArray(record.items) &&
    typeof record.total === 'number' &&
    typeof record.page === 'number' &&
    typeof record.limit === 'number'
  )
}

const isEvangelistCreateSuccessResponse = (
  value: unknown,
): value is EvangelistCreateSuccessResponse => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return record.ok === true && typeof record.item === 'object' && record.item !== null
}

const extractErrorMessage = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object') {
    const record = value as EvangelistListErrorResponse
    if (typeof record.error === 'string' && record.error) {
      return record.error
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message
    }
  }

  return fallback
}

type EditFormState = {
  contactMethod: ContactKey | ''
  strength: StrengthKey | ''
  managementPhase: ManagementPhaseKey | ''
  listProvided: 'true' | 'false'
  nextAction: string
  nextActionDueOn: string
  notes: string
}

const SELECT_CLEAR_VALUE = '__UNSET__'
const CS_CLEAR_VALUE = '__UNASSIGNED__'
const PAGE_SIZE_OPTIONS = [30, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 30

const normalizePageSize = (value: string | null): PageSizeOption => {
  if (!value) return DEFAULT_PAGE_SIZE
  const parsed = Number(value)
  const match = PAGE_SIZE_OPTIONS.find(option => option === parsed)
  return (match ?? DEFAULT_PAGE_SIZE) as PageSizeOption
}

interface EvangelistsPageClientProps {
  initialPageSize: PageSizeOption
  pageSizeSelector: ReactNode
}

export default function EvangelistsPageClient({
  initialPageSize,
  pageSizeSelector,
}: EvangelistsPageClientProps) {
  const searchParams = useSearchParams()
  const [evangelists, setEvangelists] = useState<Evangelist[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [tierFilter, setTierFilter] = useState<'ALL' | 'TIER1' | 'TIER2'>('ALL')
  const [assignedCsFilter, setAssignedCsFilter] = useState('')
  const [staleFilter, setStaleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<PageSizeOption>(initialPageSize)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEvangelist, setSelectedEvangelist] = useState<Evangelist | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>({
    contactMethod: '',
    strength: '',
    managementPhase: '',
    listProvided: 'false',
    nextAction: '',
    nextActionDueOn: '',
    notes: '',
  })
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    assignedCsId: CS_CLEAR_VALUE,
  })

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const activeRequestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const normalized = normalizePageSize(searchParams.get('pageSize'))
    setItemsPerPage(prev => (prev === normalized ? prev : normalized))
  }, [searchParams])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?limit=100', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUsers((data.users || []) as User[])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const controller = new AbortController()
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller
    const requestId = ++activeRequestIdRef.current

    setLoading(true)

    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      sortBy,
      sortOrder,
    })

    const trimmedSearch = debouncedSearchTerm.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (tierFilter !== 'ALL') {
      params.set('tier', tierFilter)
    }
    if (assignedCsFilter) {
      params.set('assignedCsId', assignedCsFilter)
    }
    if (staleFilter) {
      params.set('stale', staleFilter)
    }

    const run = async () => {
      try {
        const response = await fetch(`/api/evangelists?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const contentType = response.headers.get('content-type') || ''
        const raw = await response.text()
        let parsed: unknown = null
        if (contentType.includes('application/json') && raw) {
          try {
            parsed = JSON.parse(raw)
          } catch (error) {
            console.error('Failed to parse evangelists response JSON', error)
          }
        }

        if (response.status === 401) {
          window.location.href = '/login'
          return
        }

        const fallbackMessage =
          (raw && raw.length > 0 ? raw : '') ||
          response.statusText ||
          `HTTP ${response.status}`

        if (!response.ok || !isEvangelistListResponse(parsed)) {
          const message = extractErrorMessage(parsed, fallbackMessage)
          throw new Error(message)
        }

        const data: EvangelistListSuccessResponse = parsed

        if (requestId === activeRequestIdRef.current) {
          setEvangelists(data.items)
          const serverLimit = normalizePageSize(String(data.limit ?? itemsPerPage))
          setItemsPerPage(prev => (prev === serverLimit ? prev : serverLimit))
          setTotalPages(Math.max(1, Math.ceil(data.total / serverLimit)))
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if ((error as { name?: string })?.name === 'AbortError') {
          return
        }

        console.error('Failed to fetch evangelists:', error)

        if (requestId === activeRequestIdRef.current) {
          toast.error('エバンジェリストの取得に失敗しました')
          setEvangelists([])
          setTotalPages(1)
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoading(false)
          abortControllerRef.current = null
        }
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [
    assignedCsFilter,
    currentPage,
    debouncedSearchTerm,
    itemsPerPage,
    sortBy,
    sortOrder,
    staleFilter,
    tierFilter,
  ])

  useEffect(() => {
    if (!selectedEvangelist) return

    setEditForm({
      contactMethod: selectedEvangelist.contactMethod ?? '',
      strength: selectedEvangelist.strength ?? '',
      managementPhase: selectedEvangelist.managementPhase ?? '',
      listProvided: selectedEvangelist.listProvided ? 'true' : 'false',
      nextAction: selectedEvangelist.nextAction ?? '',
      nextActionDueOn: selectedEvangelist.nextActionDueOn
        ? selectedEvangelist.nextActionDueOn.slice(0, 10)
        : '',
      notes: selectedEvangelist.notes ?? '',
    })
  }, [selectedEvangelist])

  const handleSort = (field: 'name' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleAssign = async (evangelistId: string, newAssignee: string) => {
    const normalizedAssignee = newAssignee === CS_CLEAR_VALUE ? '' : newAssignee
    try {
      const response = await fetch(`/api/evangelists/${evangelistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignedCsId: normalizedAssignee || null }),
      })

      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      let parsed: unknown = null
      if (contentType.includes('application/json') && raw) {
        try {
          parsed = JSON.parse(raw)
        } catch (error) {
          console.error('Failed to parse evangelist assign response JSON', error)
        }
      }

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (!response.ok || !parsed || typeof parsed !== 'object') {
        const message = extractErrorMessage(parsed, raw || '担当CSの更新に失敗しました')
        throw new Error(message)
      }

      const updated = parsed as Evangelist
      setEvangelists((prev) =>
        prev.map((evangelist) =>
          evangelist.id === evangelistId
            ? {
                ...evangelist,
                assignedCsId: updated.assignedCsId ?? null,
                assignedCs: updated.assignedCs ?? null,
              }
            : evangelist
        )
      )
      toast.success('担当CSを更新しました')
    } catch (error) {
      console.error('Failed to assign CS:', error)
      toast.error('担当CSの更新に失敗しました')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const openEditDialog = (evangelist: Evangelist) => {
    setSelectedEvangelist(evangelist)
    setIsEditOpen(true)
  }

  const openCreateDialog = () => {
    setCreateForm({
      firstName: '',
      lastName: '',
      email: '',
      assignedCsId: CS_CLEAR_VALUE,
    })
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async () => {
    const first = createForm.firstName.trim()
    const last = createForm.lastName.trim()

    if (!first || !last) {
      toast.error('姓と名は必須です')
      return
    }

    try {
      const res = await fetch('/api/evangelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          email: createForm.email.trim() || null,
          assignedCsId:
            createForm.assignedCsId === CS_CLEAR_VALUE
              ? null
              : createForm.assignedCsId,
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      const raw = await res.text()
      let parsed: unknown = null
      if (contentType.includes('application/json') && raw) {
        try {
          parsed = JSON.parse(raw)
        } catch (error) {
          console.error('Failed to parse evangelist create response JSON', error)
        }
      }

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      if (!res.ok || !isEvangelistCreateSuccessResponse(parsed)) {
        const message = extractErrorMessage(parsed, raw || '作成に失敗しました')
        throw new Error(message)
      }

      const created = parsed.item as Evangelist
      setEvangelists((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        assignedCsId: CS_CLEAR_VALUE,
      })
      setIsCreateOpen(false)
      toast.success('エバンジェリストを作成しました')
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? error.message || '作成に失敗しました' : '作成に失敗しました'
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('このエバンジェリストを削除します。よろしいですか？')) return

    try {
      const res = await fetch(`/api/evangelists/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const contentType = res.headers.get('content-type') || ''
      const raw = await res.text()
      let parsed: unknown = null
      if (contentType.includes('application/json') && raw) {
        try {
          parsed = JSON.parse(raw)
        } catch (error) {
          console.error('Failed to parse evangelist delete response JSON', error)
        }
      }

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      if (!res.ok) {
        const message = extractErrorMessage(parsed, raw || '削除に失敗しました')
        throw new Error(message)
      }

      setEvangelists((prev) => prev.filter((e) => e.id !== id))
      toast.success('削除しました')
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? `削除に失敗しました：${error.message}` : '削除に失敗しました'
      toast.error(message)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setTierFilter('ALL')
    setAssignedCsFilter('')
    setStaleFilter('')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || tierFilter !== 'ALL' || assignedCsFilter || staleFilter

  const handleEditSubmit = async () => {
    if (!selectedEvangelist) return

    try {
      const payload = {
        contactMethod: editForm.contactMethod || null,
        strength: editForm.strength || null,
        managementPhase: editForm.managementPhase || null,
        listProvided: editForm.listProvided === 'true',
        nextAction: editForm.nextAction ? editForm.nextAction : null,
        nextActionDueOn: editForm.nextActionDueOn
          ? new Date(editForm.nextActionDueOn).toISOString()
          : null,
        notes: editForm.notes ? editForm.notes : null,
      }

      const response = await fetch(`/api/evangelists/${selectedEvangelist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('更新に失敗しました')
      }

      const updated: Evangelist = await response.json()

      setEvangelists((prev) =>
        prev.map((evangelist) =>
          evangelist.id === updated.id
            ? {
                ...evangelist,
                ...updated,
              }
            : evangelist,
        ),
      )

      setSelectedEvangelist(updated)
      setIsEditOpen(false)
      toast.success('EVA情報を更新しました')
    } catch (error) {
      console.error('Failed to update evangelist:', error)
      toast.error('EVA情報の更新に失敗しました')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">エバンジェリスト管理</h1>
          <p className="text-slate-500">エバンジェリストの一覧と管理</p>
        </div>
        <div className="flex items-center justify-start sm:justify-end">
          <Button
            onClick={openCreateDialog}
            variant="default"
            className="bg-brand text-white shadow-xs hover:bg-brand-600"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            新規追加
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-[var(--fg-border)] bg-[var(--fg-card)] shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-[20px] font-semibold text-slate-800">エバンジェリスト一覧</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            登録されているエバンジェリストの一覧です
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-sm text-slate-600">
            {pageSizeSelector}
          </div>
          {/* 検索・フィルタ */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="名前、メールアドレスで検索..."
                  value={searchTerm}
                  onChange={(e) => {
                    setCurrentPage(1)
                    setSearchTerm(e.target.value)
                  }}
                  className="border border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="flex items-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  フィルタクリア
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as 'ALL' | 'TIER1' | 'TIER2')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="ALL">全てのTier</option>
                <option value="TIER1">TIER1</option>
                <option value="TIER2">TIER2</option>
              </select>

              <select
                value={assignedCsFilter}
                onChange={(e) => setAssignedCsFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="">全ての担当CS</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}（{user.role === 'ADMIN' ? '管理者' : 'CS'}）
                  </option>
                ))}
              </select>

              <select
                value={staleFilter}
                onChange={(e) => setStaleFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="">フォロー期間</option>
                <option value="7">7日以上未フォロー</option>
                <option value="14">14日以上未フォロー</option>
                <option value="30">30日以上未フォロー</option>
              </select>
            </div>
          </div>

          {/* テーブル */}
          {loading ? (
            <div className="py-8 text-center text-slate-600">読み込み中...</div>
          ) : (
            <>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-slate-700">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('name')}
                        className="h-auto p-0 font-semibold text-slate-700 hover:text-slate-900"
                      >
                        名前
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-slate-700">メールアドレス</TableHead>
                    <TableHead className="text-slate-700">強み</TableHead>
                    <TableHead className="text-slate-700">連絡手段</TableHead>
                    <TableHead className="text-slate-700">管理フェーズ</TableHead>
                    <TableHead className="text-slate-700">リスト提供</TableHead>
                    <TableHead className="text-slate-700">ネクストアクション</TableHead>
                    <TableHead className="text-slate-700">NA期日</TableHead>
                    <TableHead className="text-slate-700">担当CS</TableHead>
                    <TableHead className="text-slate-700">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('createdAt')}
                        className="h-auto p-0 font-semibold text-slate-700 hover:text-slate-900"
                      >
                        登録日
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-slate-700">アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evangelists.map((evangelist) => (
                    <TableRow key={evangelist.id} className="even:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-800">
                        {[evangelist.lastName, evangelist.firstName].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell className="text-slate-700">{evangelist.email ?? '—'}</TableCell>
                      <TableCell className="text-slate-700">
                        {evangelist.strength ? STRENGTH_LABELS[evangelist.strength] : '—'}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {evangelist.contactMethod ? CONTACT_LABELS[evangelist.contactMethod] : '—'}
                      </TableCell>
                      <TableCell>
                        {evangelist.managementPhase ? (
                          <Badge variant="outline" className="border-brand/40 bg-purple-50 text-brand">
                            {MANAGEMENT_PHASE_LABELS[evangelist.managementPhase]}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-500">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {evangelist.listProvided ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            済
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                            未
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm text-slate-700">
                        {evangelist.nextAction ? (
                          <span className="line-clamp-2">{evangelist.nextAction}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {evangelist.nextActionDueOn ? (
                          <span>{formatDate(evangelist.nextActionDueOn)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={evangelist.assignedCsId ?? CS_CLEAR_VALUE}
                          onValueChange={(value) => {
                            const normalized = value === CS_CLEAR_VALUE ? '' : value
                            if ((evangelist.assignedCsId ?? '') === normalized) return
                            handleAssign(evangelist.id, value)
                          }}
                        >
                          <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                            <SelectValue placeholder="未割り当て" />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                            <SelectItem value={CS_CLEAR_VALUE}>未割り当て</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}（{user.role === 'ADMIN' ? '管理者' : 'CS'}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-slate-700">{formatDate(evangelist.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(evangelist)}
                            className="btn btn--ghost"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            編集
                          </Button>
                          <Link href={`/evangelists/${evangelist.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="btn btn--ghost"
                              aria-label="面談記録"
                            >
                              面談記録
                            </Button>
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="btn"
                            onClick={() => handleDelete(evangelist.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ページネーション */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    前へ
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages} ページ
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    次へ
                  </Button>
                </div>
              )}

              {evangelists.length === 0 && (
                <div className="py-8 text-center text-slate-500">
                  エバンジェリストが見つかりませんでした
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => setIsCreateOpen(open)}>
        <DialogContent
          aria-describedby="create-desc"
          className="max-h-[80vh] overflow-y-auto rounded-xl sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-slate-800">
              エバンジェリストを追加
            </DialogTitle>
            <p id="create-desc" className="sr-only">
              姓・名は必須、メールと担当CSは任意
            </p>
          </DialogHeader>

          <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>姓（必須）</Label>
              <Input
                value={createForm.lastName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                placeholder="山田"
                className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>名（必須）</Label>
              <Input
                value={createForm.firstName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                placeholder="太郎"
                className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>メールアドレス（任意）</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="taro@example.com"
                className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>担当CS（任意）</Label>
              <Select
                value={createForm.assignedCsId}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, assignedCsId: value }))
                }
              >
                <SelectTrigger className="border border-slate-300 bg-white text-slate-900">
                  <SelectValue placeholder="未割り当て" />
                </SelectTrigger>
                <SelectContent className="border border-slate-300 bg-white text-slate-900">
                  <SelectItem value={CS_CLEAR_VALUE}>未割り当て</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}（{user.role === 'ADMIN' ? '管理者' : 'CS'}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="text-slate-600 hover:bg-slate-100"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateSubmit}
              className="bg-brand text-white hover:bg-brand-600"
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setSelectedEvangelist(null)
          }
        }}
      >
        <DialogContent
          aria-describedby="edit-desc"
          className="max-h-[80vh] overflow-y-auto rounded-xl sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-slate-800">
              エヴァンジェリスト情報を編集
            </DialogTitle>
            <p id="edit-desc" className="sr-only">
              連絡手段・強み・管理フェーズ等を変更できます
            </p>
          </DialogHeader>
          {selectedEvangelist && (
            <div className="mx-auto flex w-full max-w-2xl flex-col space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedEvangelist.firstName} {selectedEvangelist.lastName}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>連絡手段</Label>
                  <Select
                    value={editForm.contactMethod ? editForm.contactMethod : SELECT_CLEAR_VALUE}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        contactMethod: value === SELECT_CLEAR_VALUE ? '' : (value as ContactKey),
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectItem value={SELECT_CLEAR_VALUE}>未設定</SelectItem>
                      {Object.entries(CONTACT_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>強み</Label>
                  <Select
                    value={editForm.strength ? editForm.strength : SELECT_CLEAR_VALUE}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        strength: value === SELECT_CLEAR_VALUE ? '' : (value as StrengthKey),
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectItem value={SELECT_CLEAR_VALUE}>未設定</SelectItem>
                      {Object.entries(STRENGTH_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>管理フェーズ</Label>
                  <Select
                    value={editForm.managementPhase ? editForm.managementPhase : SELECT_CLEAR_VALUE}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        managementPhase: value === SELECT_CLEAR_VALUE ? '' : (value as ManagementPhaseKey),
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectItem value={SELECT_CLEAR_VALUE}>未設定</SelectItem>
                      {Object.entries(MANAGEMENT_PHASE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>リスト提供</Label>
                  <Select
                    value={editForm.listProvided ?? ''}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({ ...prev, listProvided: value as 'true' | 'false' }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                      <SelectItem value="true">済</SelectItem>
                      <SelectItem value="false">未</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>ネクストアクション</Label>
                <Textarea
                  value={editForm.nextAction}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nextAction: e.target.value }))}
                  className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>NA期日</Label>
                  <Input
                    type="date"
                    value={editForm.nextActionDueOn}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, nextActionDueOn: e.target.value }))}
                    className="border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label>メモ</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="text-slate-600 hover:bg-slate-100"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!selectedEvangelist}
              className="bg-brand text-white hover:bg-brand-600 disabled:opacity-50"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}

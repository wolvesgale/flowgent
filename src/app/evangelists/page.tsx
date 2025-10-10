'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Plus, ArrowUpDown, X, Pencil } from 'lucide-react'
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

export default function EvangelistsPage() {
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
  const itemsPerPage = 10
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEvangelist, setSelectedEvangelist] = useState<Evangelist | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    contactMethod: '',
    strength: '',
    managementPhase: '',
    listProvided: 'false',
    nextAction: '',
    nextActionDueOn: '',
    notes: '',
  })

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

  const fetchEvangelists = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        sortBy,
        sortOrder,
        ...(tierFilter !== 'ALL' && { tier: tierFilter }),
        ...(assignedCsFilter && { assignedCsId: assignedCsFilter }),
        ...(staleFilter && { stale: staleFilter }),
      })

      const response = await fetch(`/api/evangelists?${params}` , {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setEvangelists(data.evangelists)
        setTotalPages(Math.ceil(data.total / itemsPerPage))
      }
    } catch (error) {
      console.error('Failed to fetch evangelists:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, sortBy, sortOrder, tierFilter, assignedCsFilter, staleFilter])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    void fetchEvangelists()
  }, [fetchEvangelists])

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

      if (!response.ok) {
        throw new Error('担当CSの更新に失敗しました')
      }

      const updated: Evangelist = await response.json()
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

  const openEditDialog = (evangelist: Evangelist) => {
    setSelectedEvangelist(evangelist)
    setIsEditOpen(true)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">エバンジェリスト管理</h1>
          <p className="text-muted-foreground">エバンジェリストの一覧と管理</p>
        </div>
        <Link href="/evangelists/import">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            CSVインポート
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>エバンジェリスト一覧</CardTitle>
          <CardDescription>
            登録されているエバンジェリストの一覧です
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 検索・フィルタ */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="名前、メールアドレスで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  フィルタクリア
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as 'ALL' | 'TIER1' | 'TIER2')}
                className="px-3 py-2 border border-input bg-background rounded-md"
              >
                <option value="ALL">全てのTier</option>
                <option value="TIER1">TIER1</option>
                <option value="TIER2">TIER2</option>
              </select>

              <select
                value={assignedCsFilter}
                onChange={(e) => setAssignedCsFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md"
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
                className="px-3 py-2 border border-input bg-background rounded-md"
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
            <div className="text-center py-8">読み込み中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('name')}
                        className="h-auto p-0 font-semibold"
                      >
                        名前
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>強み</TableHead>
                    <TableHead>連絡手段</TableHead>
                    <TableHead>管理フェーズ</TableHead>
                    <TableHead>リスト提供</TableHead>
                    <TableHead>ネクストアクション</TableHead>
                    <TableHead>NA期日</TableHead>
                    <TableHead>担当CS</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('createdAt')}
                        className="h-auto p-0 font-semibold"
                      >
                        登録日
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evangelists.map((evangelist) => (
                    <TableRow key={evangelist.id}>
                      <TableCell className="font-medium">
                        {evangelist.firstName} {evangelist.lastName}
                      </TableCell>
                      <TableCell>{evangelist.email}</TableCell>
                      <TableCell>
                        {evangelist.strength ? STRENGTH_LABELS[evangelist.strength] : '—'}
                      </TableCell>
                      <TableCell>
                        {evangelist.contactMethod ? CONTACT_LABELS[evangelist.contactMethod] : '—'}
                      </TableCell>
                      <TableCell>
                        {evangelist.managementPhase ? (
                          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
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
                      <TableCell>
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
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="未割り当て" />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-slate-900">
                            <SelectItem value={CS_CLEAR_VALUE}>未割り当て</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}（{user.role === 'ADMIN' ? '管理者' : 'CS'}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{formatDate(evangelist.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(evangelist)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            編集
                          </Button>
                          <Link href={`/evangelists/${evangelist.id}`}>
                            <Button variant="outline" size="sm">
                              詳細
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ページネーション */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
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
                  >
                    次へ
                  </Button>
                </div>
              )}

              {evangelists.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  エバンジェリストが見つかりませんでした
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setSelectedEvangelist(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>エヴァンジェリスト情報を編集</DialogTitle>
          </DialogHeader>
          {selectedEvangelist && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedEvangelist.firstName} {selectedEvangelist.lastName}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
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
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
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
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
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
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
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
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NA期日</Label>
                  <Input
                    type="date"
                    value={editForm.nextActionDueOn}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, nextActionDueOn: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>メモ</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEditSubmit} disabled={!selectedEvangelist}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
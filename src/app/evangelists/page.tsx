'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, ArrowUpDown, X } from 'lucide-react'
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

const PHASE_LABELS = {
  FIRST_CONTACT: '初回',
  REGISTERED: '登録',
  LIST_SHARED: 'リスト提供',
  CANDIDATE_SELECTION: '候補抽出',
  INNOVATOR_REVIEW: 'イノベータ確認',
  INTRODUCING: '紹介中',
  FOLLOW_UP: '継続中',
} as const

type StrengthKey = keyof typeof STRENGTH_LABELS
type ContactKey = keyof typeof CONTACT_LABELS
type PhaseKey = keyof typeof PHASE_LABELS

interface Evangelist {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  strength?: StrengthKey | null
  contactPreference?: ContactKey | null
  phase?: PhaseKey | null
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

  const handleSort = (field: 'name' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleAssign = async (evangelistId: string, newAssignee: string) => {
    try {
      const response = await fetch(`/api/evangelists/${evangelistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignedCsId: newAssignee || null }),
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
                className="px-3 py-2 border border-input bg-background text-slate-900 rounded-md"
              >
                <option value="ALL">全てのTier</option>
                <option value="TIER1">TIER1</option>
                <option value="TIER2">TIER2</option>
              </select>

              <select
                value={assignedCsFilter}
                onChange={(e) => setAssignedCsFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background text-slate-900 rounded-md"
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
                className="px-3 py-2 border border-input bg-background text-slate-900 rounded-md"
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
                    <TableHead>フェーズ</TableHead>
                    <TableHead>連絡手段</TableHead>
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
                        {evangelist.phase ? (
                          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
                            {PHASE_LABELS[evangelist.phase]}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-500">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {evangelist.contactPreference ? CONTACT_LABELS[evangelist.contactPreference] : '—'}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={evangelist.assignedCsId ?? ''}
                          onValueChange={(value) => {
                            if ((evangelist.assignedCsId ?? '') === value) return
                            handleAssign(evangelist.id, value)
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="未割り当て" />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-slate-900">
                            <SelectItem value="">未割り当て</SelectItem>
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
                        <Link href={`/evangelists/${evangelist.id}`}>
                          <Button variant="outline" size="sm">
                            詳細
                          </Button>
                        </Link>
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
    </div>
  )
}
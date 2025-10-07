'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Filter, ArrowUpDown, X } from 'lucide-react'

interface Evangelist {
  id: number
  recordId?: string
  firstName?: string
  lastName?: string
  email?: string
  contactPref?: string
  strengths?: string
  notes?: string
  tier: 'TIER1' | 'TIER2'
  tags?: string
  assignedUserId?: number
  assignedUser?: {
    name: string
  }
  createdAt: string
  _count: {
    meetings: number
  }
}

interface User {
  id: number
  name: string
}

export default function EvangelistsPage() {
  const [evangelists, setEvangelists] = useState<Evangelist[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'tier' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [tierFilter, setTierFilter] = useState<'ALL' | 'TIER1' | 'TIER2'>('ALL')
  const [tagFilter, setTagFilter] = useState('')
  const [assignedCsFilter, setAssignedCsFilter] = useState('')
  const [staleFilter, setStaleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchEvangelists()
  }, [currentPage, searchTerm, sortBy, sortOrder, tierFilter, tagFilter, assignedCsFilter, staleFilter])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchEvangelists = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        sortBy,
        sortOrder,
        ...(tierFilter !== 'ALL' && { tier: tierFilter }),
        ...(tagFilter && { tag: tagFilter }),
        ...(assignedCsFilter && { assignedCsId: assignedCsFilter }),
        ...(staleFilter && { stale: staleFilter }),
      })

      const response = await fetch(`/api/evangelists?${params}`)
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
  }

  const handleSort = (field: 'name' | 'tier' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const getTierBadgeVariant = (tier: string) => {
    return tier === 'TIER1' ? 'default' : 'secondary'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setTierFilter('ALL')
    setTagFilter('')
    setAssignedCsFilter('')
    setStaleFilter('')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || tierFilter !== 'ALL' || tagFilter || assignedCsFilter || staleFilter

  const parseTags = (tagsString?: string): string[] => {
    if (!tagsString) return []
    try {
      return JSON.parse(tagsString)
    } catch {
      return []
    }
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as 'ALL' | 'TIER1' | 'TIER2')}
                className="px-3 py-2 border border-input bg-background rounded-md"
              >
                <option value="ALL">全てのTier</option>
                <option value="TIER1">TIER1</option>
                <option value="TIER2">TIER2</option>
              </select>

              <Input
                placeholder="タグで絞り込み..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />

              <select
                value={assignedCsFilter}
                onChange={(e) => setAssignedCsFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md"
              >
                <option value="">全ての担当CS</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id.toString()}>
                    {user.name}
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
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('tier')}
                        className="h-auto p-0 font-semibold"
                      >
                        Tier
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>タグ</TableHead>
                    <TableHead>担当CS</TableHead>
                    <TableHead>ミーティング数</TableHead>
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
                        <Badge variant={getTierBadgeVariant(evangelist.tier)}>
                          {evangelist.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parseTags(evangelist.tags).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {evangelist.assignedUser?.name || '未割り当て'}
                      </TableCell>
                      <TableCell>{evangelist._count.meetings}</TableCell>
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
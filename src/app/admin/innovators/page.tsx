'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Search, Plus, Edit, Trash2 } from 'lucide-react'

interface Innovator {
  id: number
  company: string
  url: string | null
  introPoint: string | null
  createdAt: string
  updatedAt: string
}

const ITEMS_PER_PAGE = 10

type InnovatorResponse = {
  items?: unknown
  total?: unknown
}

type CreateOrUpdatePayload = {
  company: string
  email?: string
  url?: string
  introPoint?: string
}

type InnovatorMeta = {
  hasEmail: boolean
  emailRequired: boolean
}

const normalizeString = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

export default function AdminInnovatorsPage() {
  const [innovators, setInnovators] = useState<Innovator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedInnovator, setSelectedInnovator] = useState<Innovator | null>(null)
  const [formData, setFormData] = useState({ company: '', email: '', url: '', introPoint: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [createPending, setCreatePending] = useState(false)
  const [innovatorMeta, setInnovatorMeta] = useState<InnovatorMeta | null>(null)

  const fetchInnovators = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      params.set('limit', ITEMS_PER_PAGE.toString())

      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }

      const response = await fetch(`/api/admin/innovators?${params.toString()}`, {
        credentials: 'include',
      })

      const data = (await response.json().catch(() => null)) as InnovatorResponse | null
      const rawItems = Array.isArray(data?.items) ? (data.items as unknown[]) : []
      const items: Innovator[] = rawItems.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const id = Number(record.id)
        if (!Number.isFinite(id)) return []
        const urlValue = record.url == null ? null : normalizeString(record.url)
        const introPointValue =
          record.introPoint == null ? null : normalizeString(record.introPoint)
        return [
          {
            id,
            company: normalizeString(record.company),
            url: urlValue,
            introPoint: introPointValue,
            createdAt: normalizeString(record.createdAt),
            updatedAt: normalizeString(record.updatedAt),
          },
        ]
      })

      setInnovators(items)
      const total = typeof data?.total === 'number' ? data.total : items.length
      const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE) || 1)
      setTotalPages(pages)

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? 'Failed to fetch innovators')
      }
    } catch (error) {
      console.error('Failed to fetch innovators:', error)
      setInnovators([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  useEffect(() => {
    void fetchInnovators()
  }, [fetchInnovators])

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const response = await fetch('/api/health/db', { credentials: 'include' })
        if (!response.ok) return
        const data = (await response.json().catch(() => null)) as {
          innovator?: { hasEmail?: unknown; emailRequired?: unknown }
        } | null
        const meta = data?.innovator
        if (!meta) return
        setInnovatorMeta({
          hasEmail: meta.hasEmail === true,
          emailRequired: meta.emailRequired === true,
        })
      } catch (error) {
        console.error('Failed to fetch innovator metadata:', error)
      }
    }

    void fetchMeta()
  }, [])

  const buildInnovatorPayload = (): CreateOrUpdatePayload | null => {
    const trimmedCompany = formData.company.trim()
    if (!trimmedCompany) {
      toast.error('企業名は必須です')
      setFormError('企業名は必須です')
      return null
    }

    setFormError(null)
    const payload: CreateOrUpdatePayload = { company: trimmedCompany }

    const trimmedUrl = formData.url.trim()
    if (trimmedUrl) {
      payload.url = trimmedUrl
    }

    const trimmedIntroPoint = formData.introPoint.trim()
    if (trimmedIntroPoint) {
      payload.introPoint = trimmedIntroPoint
    }
    const shouldIncludeEmail = innovatorMeta?.emailRequired === true
    const trimmedEmail = formData.email.trim()
    if (shouldIncludeEmail && trimmedEmail) {
      payload.email = trimmedEmail
    }
    return payload
  }

  const handleCreate = async () => {
    const payload = buildInnovatorPayload()
    if (!payload) return

    try {
      setCreatePending(true)
      setFormError(null)
      const response = await fetch('/api/admin/innovators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        if (response.status === 400) {
          setFormError(data?.error ?? '企業名は必須です')
          return
        }
        toast.error(data?.error ?? 'イノベータの登録に失敗しました')
        return
      }

      toast.success('イノベータを登録しました')
      setIsCreateDialogOpen(false)
      resetForm()
      await fetchInnovators()
    } catch (error) {
      console.error('Failed to create innovator:', error)
      toast.error('イノベータの登録に失敗しました')
    } finally {
      setCreatePending(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedInnovator) return

    const payload = buildInnovatorPayload()
    if (!payload) return

    try {
      const response = await fetch(`/api/admin/innovators/${selectedInnovator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        toast.error(data?.error ?? 'イノベータの更新に失敗しました')
        return
      }

      toast.success('イノベータを更新しました')
      setIsEditDialogOpen(false)
      setSelectedInnovator(null)
      resetForm()
      await fetchInnovators()
    } catch (error) {
      console.error('Failed to update innovator:', error)
      toast.error('イノベータの更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('このイノベータを削除してもよろしいですか？')) return

    try {
      const response = await fetch(`/api/admin/innovators/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? 'イノベータの削除に失敗しました')
        return
      }

      toast.success('イノベータを削除しました')
      await fetchInnovators()
    } catch (error) {
      console.error('Failed to delete innovator:', error)
      toast.error('イノベータの削除に失敗しました')
    }
  }

  const resetForm = () => {
    setFormData({ company: '', email: '', url: '', introPoint: '' })
    setFormError(null)
    setCreatePending(false)
  }

  const openEditDialog = (innovator: Innovator) => {
    setSelectedInnovator(innovator)
    setFormData({
      company: innovator.company,
      email: '',
      url: innovator.url ?? '',
      introPoint: innovator.introPoint ?? '',
    })
    setIsEditDialogOpen(true)
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('ja-JP')
  const safeInnovators = Array.isArray(innovators) ? innovators : []
  const itemCount = safeInnovators.length

  const shouldShowEmailField = innovatorMeta?.emailRequired === true

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">イノベータ管理</h1>
          <p className="text-muted-foreground">イノベータの一覧と管理（管理者専用）</p>
        </div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>新しいイノベータを追加</DialogTitle>
              <DialogDescription>企業名を入力してください。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">
                  企業名
                </Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                  placeholder="企業名"
                  required
                  className="col-span-3 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                  URL（任意）
                </Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com"
                  className="col-span-3 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="introPoint" className="text-right">
                  紹介ポイント（任意）
                </Label>
                <Input
                  id="introPoint"
                  value={formData.introPoint}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, introPoint: e.target.value }))
                  }
                  placeholder="紹介ポイント"
                  className="col-span-3 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                />
              </div>
              {shouldShowEmailField && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email（任意）
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="col-span-3 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                  />
                </div>
              )}
              {formError && (
                <div className="col-span-4 text-sm text-red-600" role="alert">
                  {formError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetForm()
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={createPending}>
                {createPending ? '登録中...' : '登録'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>イノベータ情報を編集</DialogTitle>
            <DialogDescription>企業名を更新します。</DialogDescription>
          </DialogHeader>
          {selectedInnovator && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-company" className="text-right">
                  企業名
                </Label>
                <Input
                  id="edit-company"
                  value={formData.company}
                  onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                  placeholder="企業名"
                  className="col-span-3 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEdit}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>イノベーター一覧</CardTitle>
          <CardDescription>登録されているイノベータの一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="企業名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white text-slate-900 placeholder:text-slate-500 border border-slate-300"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setCurrentPage(1)
                }}
              >
                フィルタクリア
              </Button>
            </div>

            <div className="rounded-md border border-purple-200 bg-purple-50/80 px-3 py-2 text-purple-700">
              <p className="text-sm font-semibold">登録件数</p>
              <p className="text-sm">{itemCount} 件</p>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center">読み込み中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>企業名</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>更新日</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeInnovators.map((innovator) => (
                    <TableRow key={innovator.id}>
                      <TableCell className="font-medium">{innovator.company ?? '—'}</TableCell>
                      <TableCell>{innovator.createdAt ? formatDate(innovator.createdAt) : '—'}</TableCell>
                      <TableCell>{innovator.updatedAt ? formatDate(innovator.updatedAt) : '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(innovator)}>
                            <Edit className="mr-1 h-4 w-4" />編集
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(innovator.id)}>
                            <Trash2 className="mr-1 h-4 w-4" />削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
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

              {itemCount === 0 && (
                <div className="py-8 text-center text-muted-foreground">イノベータが見つかりませんでした</div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

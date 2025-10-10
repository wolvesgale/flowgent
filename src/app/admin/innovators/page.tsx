'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Edit, Trash2, Link as LinkIcon, Map } from 'lucide-react'
import { toast } from 'sonner'
import { mapBusinessDomainOrDefault } from '@/lib/business-domain'

const DOMAIN_OPTIONS = [
  { value: 'HR', label: '人事' },
  { value: 'IT', label: 'IT' },
  { value: 'ACCOUNTING', label: '会計' },
  { value: 'ADVERTISING', label: '広告' },
  { value: 'MANAGEMENT', label: '経営' },
  { value: 'SALES', label: '営業' },
  { value: 'MANUFACTURING', label: '製造' },
  { value: 'MEDICAL', label: '医療' },
  { value: 'FINANCE', label: '金融' },
] as const

type Domain = (typeof DOMAIN_OPTIONS)[number]['value']

interface Innovator {
  id: number
  company: string
  url?: string | null
  introductionPoint?: string | null
  domain: Domain
  createdAt: string
  updatedAt: string
}

export default function AdminInnovatorsPage() {
  const [innovators, setInnovators] = useState<Innovator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [domainFilter, setDomainFilter] = useState<'ALL' | Domain>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedInnovator, setSelectedInnovator] = useState<Innovator | null>(null)
  const [formData, setFormData] = useState({
    company: '',
    url: '',
    introductionPoint: '',
    domain: 'HR' as Domain,
  })
  const itemsPerPage = 10

  const fetchInnovators = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        domain: domainFilter === 'ALL' ? '' : domainFilter,
      })

      const response = await fetch(`/api/admin/innovators?${params}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setInnovators(data.innovators)
        setTotalPages(Math.ceil(data.total / itemsPerPage))
      }
    } catch (error) {
      console.error('Failed to fetch innovators:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, domainFilter])

  useEffect(() => {
    void fetchInnovators()
  }, [fetchInnovators])

  const buildInnovatorPayload = () => {
    const trimmedCompany = formData.company.trim()
    if (!trimmedCompany) {
      toast.error('企業名は必須です')
      return null
    }

    const trimmedUrl = formData.url.trim()
    const trimmedIntroductionPoint = formData.introductionPoint.trim()

    return {
      company: trimmedCompany,
      domain: mapBusinessDomainOrDefault(formData.domain),
      url: trimmedUrl.length > 0 ? trimmedUrl : undefined,
      introductionPoint: trimmedIntroductionPoint.length > 0 ? trimmedIntroductionPoint : undefined,
    }
  }

  const handleCreate = async () => {
    const payload = buildInnovatorPayload()
    if (!payload) return

    try {
      const response = await fetch('/api/admin/innovators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error((data as { error?: string } | null)?.error ?? 'イノベータの登録に失敗しました')
        return
      }

      toast.success('イノベータを登録しました')
      setIsCreateDialogOpen(false)
      resetForm()
      await fetchInnovators()
    } catch (error) {
      console.error('Failed to create innovator:', error)
      toast.error('イノベータの登録に失敗しました')
    }
  }

  const handleEdit = async () => {
    if (!selectedInnovator) return

    const payload = buildInnovatorPayload()
    if (!payload) return

    try {
      const response = await fetch(`/api/admin/innovators/${selectedInnovator.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error((data as { error?: string } | null)?.error ?? 'イノベータの更新に失敗しました')
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

      if (response.ok) {
        fetchInnovators()
      }
    } catch (error) {
      console.error('Failed to delete innovator:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      company: '',
      url: '',
      introductionPoint: '',
      domain: 'HR',
    })
  }

  const openEditDialog = (innovator: Innovator) => {
    setSelectedInnovator(innovator)
    setFormData({
      company: innovator.company,
      url: innovator.url || '',
      introductionPoint: innovator.introductionPoint || '',
      domain: innovator.domain,
    })
    setIsEditDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">イノベータ管理</h1>
          <p className="text-muted-foreground">イノベータの一覧と管理（管理者専用）</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>新しいイノベータを追加</DialogTitle>
              <DialogDescription>企業情報と領域を入力してください。</DialogDescription>
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
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                  URL
                </Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">領域</Label>
                <Select value={formData.domain} onValueChange={(value: Domain) => setFormData((prev) => ({ ...prev, domain: value }))}>
                  <SelectTrigger className="col-span-3 bg-white">
                    <SelectValue placeholder="領域を選択" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900">
                    {DOMAIN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="introductionPoint" className="text-right">
                  紹介ポイント
                </Label>
                <Textarea
                  id="introductionPoint"
                  value={formData.introductionPoint}
                  onChange={(e) => setFormData((prev) => ({ ...prev, introductionPoint: e.target.value }))}
                  className="col-span-3"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate}>登録</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>イノベータ情報を編集</DialogTitle>
            <DialogDescription>企業情報と領域を更新します。</DialogDescription>
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
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-url" className="text-right">
                  URL
                </Label>
                <Input
                  id="edit-url"
                  value={formData.url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">領域</Label>
                <Select value={formData.domain} onValueChange={(value: Domain) => setFormData((prev) => ({ ...prev, domain: value }))}>
                  <SelectTrigger className="col-span-3 bg-white">
                    <SelectValue placeholder="領域を選択" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900">
                    {DOMAIN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-introductionPoint" className="text-right">
                  紹介ポイント
                </Label>
                <Textarea
                  id="edit-introductionPoint"
                  value={formData.introductionPoint}
                  onChange={(e) => setFormData((prev) => ({ ...prev, introductionPoint: e.target.value }))}
                  className="col-span-3"
                  rows={4}
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
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="企業名または紹介ポイントで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setDomainFilter('ALL')
                  setCurrentPage(1)
                }}
              >
                フィルタクリア
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select value={domainFilter} onValueChange={(value: 'ALL' | Domain) => setDomainFilter(value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="領域を選択" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900">
                  <SelectItem value="ALL">全ての領域</SelectItem>
                  {DOMAIN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50/80 px-3 py-2 text-purple-700">
                <Map className="h-4 w-4" />
                <div className="text-sm">
                  <p className="font-semibold">登録件数</p>
                  <p>{innovators.length} 件</p>
                </div>
              </div>
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
                    <TableHead>URL</TableHead>
                    <TableHead>紹介ポイント</TableHead>
                    <TableHead>領域</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {innovators.map((innovator) => (
                    <TableRow key={innovator.id}>
                      <TableCell className="font-medium">{innovator.company}</TableCell>
                      <TableCell>
                        {innovator.url ? (
                          <a
                            href={innovator.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-purple-700 underline-offset-2 hover:underline"
                          >
                            <LinkIcon className="h-4 w-4" />
                            サイトを見る
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-slate-700">
                        {innovator.introductionPoint || '—'}
                      </TableCell>
                      <TableCell>
                        {DOMAIN_OPTIONS.find((option) => option.value === innovator.domain)?.label ?? innovator.domain}
                      </TableCell>
                      <TableCell>{formatDate(innovator.createdAt)}</TableCell>
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

              {innovators.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">イノベータが見つかりませんでした</div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

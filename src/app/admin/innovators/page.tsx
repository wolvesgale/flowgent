'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Edit, Trash2, AlertTriangle, Users } from 'lucide-react'

interface Innovator {
  id: number
  name: string
  email: string
  company: string
  position: string
  status: 'ACTIVE' | 'INACTIVE'
  requiresIntroduction: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export default function AdminInnovatorsPage() {
  const [innovators, setInnovators] = useState<Innovator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [requiresIntroFilter, setRequiresIntroFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedInnovator, setSelectedInnovator] = useState<Innovator | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    position: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    requiresIntroduction: false,
    notes: ''
  })
  const itemsPerPage = 10

  useEffect(() => {
    fetchInnovators()
  }, [currentPage, searchTerm, statusFilter, requiresIntroFilter])

  const fetchInnovators = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        status: statusFilter === 'ALL' ? '' : statusFilter,
        requiresIntroduction: requiresIntroFilter === 'ALL' ? '' : (requiresIntroFilter === 'YES' ? 'true' : 'false'),
      })

      const response = await fetch(`/api/admin/innovators?${params}`)
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
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/innovators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setIsCreateDialogOpen(false)
        resetForm()
        fetchInnovators()
      }
    } catch (error) {
      console.error('Failed to create innovator:', error)
    }
  }

  const handleEdit = async () => {
    if (!selectedInnovator) return

    try {
      const response = await fetch(`/api/admin/innovators/${selectedInnovator.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setSelectedInnovator(null)
        resetForm()
        fetchInnovators()
      }
    } catch (error) {
      console.error('Failed to update innovator:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('このイノベータを削除してもよろしいですか？')) return

    try {
      const response = await fetch(`/api/admin/innovators/${id}`, {
        method: 'DELETE',
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
      name: '',
      email: '',
      company: '',
      position: '',
      status: 'ACTIVE',
      requiresIntroduction: false,
      notes: ''
    })
  }

  const openEditDialog = (innovator: Innovator) => {
    setSelectedInnovator(innovator)
    setFormData({
      name: innovator.name,
      email: innovator.email,
      company: innovator.company,
      position: innovator.position,
      status: innovator.status,
      requiresIntroduction: innovator.requiresIntroduction,
      notes: innovator.notes || ''
    })
    setIsEditDialogOpen(true)
  }

  const getStatusBadgeVariant = (status: string) => {
    return status === 'ACTIVE' ? 'default' : 'secondary'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const requiredIntroductionCount = innovators.filter(i => i.requiresIntroduction).length

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
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
              <DialogDescription>
                新しいイノベータの情報を入力してください。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  名前
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  メール
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">
                  会社
                </Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="position" className="text-right">
                  役職
                </Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  ステータス
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'ACTIVE' | 'INACTIVE') => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">アクティブ</SelectItem>
                    <SelectItem value="INACTIVE">非アクティブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="requiresIntroduction" className="text-right">
                  紹介必須
                </Label>
                <div className="col-span-3">
                  <input
                    id="requiresIntroduction"
                    type="checkbox"
                    checked={formData.requiresIntroduction}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresIntroduction: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">紹介が必要</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  備考
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="col-span-3"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreate}>
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 紹介必須イノベータの警告 */}
      {requiredIntroductionCount > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                紹介が必要なイノベータが {requiredIntroductionCount} 名います
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            イノベータ一覧
          </CardTitle>
          <CardDescription>
            登録されているイノベータの一覧です
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 検索・フィルタ */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="名前、会社名、メールアドレスで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="ALL">全てのステータス</option>
              <option value="ACTIVE">アクティブ</option>
              <option value="INACTIVE">非アクティブ</option>
            </select>
            <select
              value={requiresIntroFilter}
              onChange={(e) => setRequiresIntroFilter(e.target.value as 'ALL' | 'YES' | 'NO')}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="ALL">全て</option>
              <option value="YES">紹介必須</option>
              <option value="NO">紹介不要</option>
            </select>
          </div>

          {/* テーブル */}
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>会社</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>役職</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>紹介必須</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {innovators.map((innovator) => (
                    <TableRow key={innovator.id}>
                      <TableCell className="font-medium">{innovator.name}</TableCell>
                      <TableCell>{innovator.company}</TableCell>
                      <TableCell>{innovator.email}</TableCell>
                      <TableCell>{innovator.position}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(innovator.status)}>
                          {innovator.status === 'ACTIVE' ? 'アクティブ' : '非アクティブ'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {innovator.requiresIntroduction ? (
                          <Badge variant="destructive">必須</Badge>
                        ) : (
                          <Badge variant="outline">不要</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(innovator.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(innovator)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(innovator.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

              {innovators.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  イノベータが見つかりませんでした
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>イノベータを編集</DialogTitle>
            <DialogDescription>
              イノベータの情報を編集してください。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                名前
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                メール
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-company" className="text-right">
                会社
              </Label>
              <Input
                id="edit-company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-position" className="text-right">
                役職
              </Label>
              <Input
                id="edit-position"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">
                ステータス
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'ACTIVE' | 'INACTIVE') => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">アクティブ</SelectItem>
                  <SelectItem value="INACTIVE">非アクティブ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-requiresIntroduction" className="text-right">
                紹介必須
              </Label>
              <div className="col-span-3">
                <input
                  id="edit-requiresIntroduction"
                  type="checkbox"
                  checked={formData.requiresIntroduction}
                  onChange={(e) => setFormData(prev => ({ ...prev, requiresIntroduction: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">紹介が必要</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notes" className="text-right">
                備考
              </Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEdit}>
              更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
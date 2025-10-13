'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Key, Search, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'CS' | 'USER'
  createdAt: string
  updatedAt: string
}

export default function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // 新規ユーザー作成用の状態
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'ADMIN' | 'CS' | 'USER'
  })

  // 編集用の状態
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    role: 'USER' as 'ADMIN' | 'CS' | 'USER'
  })

  // ユーザー一覧取得
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (roleFilter !== 'all') params.append('role', roleFilter)

      const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch users')
      
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('ユーザー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, roleFilter])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  // 新規ユーザー作成
  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to create user')

      toast.success('ユーザーを作成しました')
      setIsCreateDialogOpen(false)
      setNewUser({ name: '', email: '', password: '', role: 'USER' })
      void fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('ユーザーの作成に失敗しました')
    }
  }

  // ユーザー編集
  const handleEditUser = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUser),
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to update user')

      toast.success('ユーザーを更新しました')
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      void fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('ユーザーの更新に失敗しました')
    }
  }

  // ユーザー削除
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('このユーザーを削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to delete user')

      toast.success('ユーザーを削除しました')
      void fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('ユーザーの削除に失敗しました')
    }
  }

  // パスワードリセット
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return

    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword
        }),
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to reset password')

      toast.success('パスワードをリセットしました')
      setIsResetPasswordDialogOpen(false)
      setSelectedUser(null)
      setNewPassword('')
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('パスワードのリセットに失敗しました')
    }
  }

  // 編集ダイアログを開く
  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setEditUser({
      name: user.name,
      email: user.email,
      role: user.role
    })
    setIsEditDialogOpen(true)
  }

  // パスワードリセットダイアログを開く
  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user)
    setNewPassword('')
    setIsResetPasswordDialogOpen(true)
  }

  // フィルタリングされたユーザー
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'destructive'
      case 'CS': return 'default'
      case 'USER': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ユーザー管理</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規ユーザー作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規ユーザー作成</DialogTitle>
              <DialogDescription>
                新しいユーザーを作成します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  名前
                </Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
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
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  役割
                </Label>
                <Select value={newUser.role} onValueChange={(value: 'ADMIN' | 'CS' | 'USER') => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="col-span-3 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                    <SelectItem value="USER">USER</SelectItem>
                    <SelectItem value="CS">CS</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateUser}>作成</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 検索・フィルター */}
      <Card>
        <CardHeader>
          <CardTitle>検索・フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="名前またはメールで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px] bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                <SelectValue placeholder="役割で絞り込み" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                <SelectItem value="all">すべての役割</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="USER">USER</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧 ({filteredUsers.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">読み込み中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>役割</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>{new Date(user.updatedAt).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openResetPasswordDialog(user)}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
            <DialogDescription>
              ユーザー情報を編集します。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                名前
              </Label>
              <Input
                id="edit-name"
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
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
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                役割
              </Label>
              <Select value={editUser.role} onValueChange={(value: 'ADMIN' | 'CS' | 'USER') => setEditUser({ ...editUser, role: value })}>
                <SelectTrigger className="col-span-3 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="CS">CS</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditUser}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* パスワードリセットダイアログ */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードリセット</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} のパスワードをリセットします。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                新しいパスワード
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword}>リセット</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
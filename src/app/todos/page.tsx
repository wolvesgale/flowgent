'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react'

import { useTodos, useTodosDueTomorrow, type TodoItem } from '@/lib/useTodos'

const SELF_ASSIGNEE = '__SELF__'

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatJstDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }
  const data = contentType.includes('application/json') && raw ? JSON.parse(raw) : null
  return { response, data } as const
}

type UserSummary = {
  id: string
  name: string
  role: 'ADMIN' | 'CS'
}

export default function TodosPage() {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [assignees, setAssignees] = useState<UserSummary[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<'me' | 'all' | string>('me')
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'DONE' | 'ALL'>('OPEN')
  const [selectedTomorrowCs, setSelectedTomorrowCs] = useState<'me' | 'all' | string>('me')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    notes: '',
    dueOn: '',
    assigneeId: SELF_ASSIGNEE,
  })

  const isAdmin = currentUser?.role === 'ADMIN'

  const computedScope = isAdmin
    ? assigneeFilter === 'all'
      ? 'all'
      : 'mine'
    : 'mine'

  const computedAssigneeId = isAdmin
    ? assigneeFilter === 'all' || assigneeFilter === 'me'
      ? null
      : assigneeFilter
    : null

  const {
    items: todos,
    isLoading: todosLoading,
    error: todosError,
    mutate: mutateTodos,
  } = useTodos({
    scope: computedAssigneeId ? 'all' : (computedScope as 'mine' | 'dueSoon' | 'all'),
    status: statusFilter,
    take: 100,
    assigneeId: computedAssigneeId ?? undefined,
  })

  const effectiveTomorrowAssignee = useMemo(() => {
    if (!isAdmin) return undefined
    if (selectedTomorrowCs === 'all') return 'all'
    if (selectedTomorrowCs === 'me') return currentUser?.id ?? undefined
    return selectedTomorrowCs
  }, [currentUser, isAdmin, selectedTomorrowCs])

  const {
    items: tomorrowTodos,
    isLoading: tomorrowLoading,
    mutate: mutateDueTomorrow,
  } = useTodosDueTomorrow(effectiveTomorrowAssignee)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoadingUser(true)
        const { response, data } = await requestJson('/api/auth/me')
        if (!response.ok || !data?.user) {
          throw new Error(data?.error || 'failed')
        }
        if (!cancelled) {
          setCurrentUser(data.user as UserSummary)
        }
      } catch (error) {
        console.error('[todos:user]', error)
        if (!cancelled) {
          toast.error('ユーザー情報の取得に失敗しました')
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    const run = async () => {
      try {
        const params = new URLSearchParams({ role: 'CS', limit: '200' })
        const { response, data } = await requestJson(`/api/admin/users?${params.toString()}`)
        if (!response.ok || !Array.isArray(data?.users)) {
          throw new Error(data?.error || 'failed')
        }
        if (!cancelled) {
          setAssignees(data.users as UserSummary[])
        }
      } catch (error) {
        console.error('[todos:assignees]', error)
        if (!cancelled) {
          toast.error('担当者リストの取得に失敗しました')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin && assigneeFilter === 'me') {
      setAssigneeFilter('all')
    }
  }, [isAdmin, assigneeFilter])

  useEffect(() => {
    if (isAdmin && selectedTomorrowCs === 'me') {
      setSelectedTomorrowCs('all')
    }
  }, [isAdmin, selectedTomorrowCs])

  useEffect(() => {
    if (!todosError) return
    console.error('[todos:list]', todosError)
    toast.error('ToDoの取得に失敗しました')
  }, [todosError])

  const csAssignees = useMemo(() => assignees.filter((user) => user.role === 'CS'), [assignees])

  const userNameMap = useMemo(() => {
    const entries = new Map<string, string>()
    if (currentUser) {
      entries.set(currentUser.id, currentUser.name)
    }
    for (const user of assignees) {
      entries.set(user.id, user.name)
    }
    return entries
  }, [assignees, currentUser])

  const handleCreateSubmit = useCallback(async () => {
    if (!currentUser) return
    const title = createForm.title.trim()
    if (!title) {
      toast.error('タイトルを入力してください')
      return
    }

    const notes = createForm.notes.trim()
    const dueOn = createForm.dueOn.trim()
    const assigneeForCreate = isAdmin
      ? createForm.assigneeId === SELF_ASSIGNEE || !createForm.assigneeId
        ? currentUser.id
        : createForm.assigneeId
      : currentUser.id

    const optimisticId = `optimistic-${Date.now()}`
    const nowIso = new Date().toISOString()
    const optimistic: TodoItem = {
      id: optimisticId,
      title,
      notes: notes || null,
      dueOn: dueOn ? new Date(dueOn).toISOString() : null,
      status: 'OPEN',
      assigneeId: assigneeForCreate,
      createdById: currentUser.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    mutateTodos(
      (prev) => {
        const base = prev ?? { items: [] as TodoItem[], nextCursor: null }
        return { ...base, items: [optimistic, ...base.items] }
      },
      { revalidate: false },
    )

    try {
      const body: Record<string, unknown> = {
        title,
        notes: notes || null,
        dueOn: dueOn || null,
      }
      if (isAdmin) {
        body.assigneeId = assigneeForCreate
      }
      const response = await fetch('/api/todos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : null
      if (!response.ok) {
        throw new Error(data?.error || 'ToDoの作成に失敗しました')
      }
      const created = data as TodoItem
      mutateTodos(
        (prev) => {
          const base = prev ?? { items: [] as TodoItem[], nextCursor: null }
          const filtered = base.items.filter((item) => item.id !== optimisticId)
          return { ...base, items: [created, ...filtered] }
        },
        { revalidate: false },
      )
      toast.success('ToDoを作成しました')
      setCreateOpen(false)
      setCreateForm({ title: '', notes: '', dueOn: '', assigneeId: SELF_ASSIGNEE })
      void mutateTodos()
      void mutateDueTomorrow()
    } catch (error) {
      console.error('[todos:create]', error)
      mutateTodos(
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.filter((item) => item.id !== optimisticId),
          }
        },
        { revalidate: false },
      )
      toast.error('ToDoの作成に失敗しました')
      void mutateDueTomorrow()
    }
  }, [createForm, currentUser, isAdmin, mutateDueTomorrow, mutateTodos])

  const handleToggleStatus = useCallback(
    async (todo: TodoItem, nextStatus: 'OPEN' | 'DONE') => {
      const previousStatus = todo.status
      const optimisticUpdatedAt = new Date().toISOString()
      mutateTodos(
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === todo.id
                ? { ...item, status: nextStatus, updatedAt: optimisticUpdatedAt }
                : item,
            ),
          }
        },
        { revalidate: false },
      )

      try {
        const response = await fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })
        const text = await response.text()
        const data = text ? JSON.parse(text) : null
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || '更新に失敗しました')
        }
        toast.success(nextStatus === 'DONE' ? '完了にしました' : '未完了に戻しました')
        void mutateTodos()
        void mutateDueTomorrow()
      } catch (error) {
        console.error('[todos:update]', error)
        mutateTodos(
          (prev) => {
            if (!prev) return prev
            return {
              ...prev,
              items: prev.items.map((item) =>
                item.id === todo.id
                  ? { ...item, status: previousStatus, updatedAt: todo.updatedAt }
                  : item,
              ),
            }
          },
          { revalidate: false },
        )
        toast.error('更新に失敗しました')
        void mutateDueTomorrow()
      }
    },
    [mutateDueTomorrow, mutateTodos],
  )

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      if (!window.confirm('このToDoを削除します。よろしいですか？')) return
      const snapshot = [...todos]
      mutateTodos(
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.filter((item) => item.id !== id),
          }
        },
        { revalidate: false },
      )

      try {
        const response = await fetch(`/api/todos/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        const text = await response.text()
        const data = text ? JSON.parse(text) : null
        if (!response.ok || data?.error) {
          throw new Error(data?.error || '削除に失敗しました')
        }
        toast.success('削除しました')
        void mutateTodos()
        void mutateDueTomorrow()
      } catch (error) {
        console.error('[todos:delete]', error)
        mutateTodos(
          () => ({ items: snapshot, nextCursor: null }),
          { revalidate: true },
        )
        toast.error('削除に失敗しました')
        void mutateDueTomorrow()
      }
    },
    [mutateDueTomorrow, mutateTodos, todos],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">CS ToDo</h1>
        <p className="text-slate-500">明日期限のネクストアクションと、担当者ごとのToDoを確認・管理できます。</p>
      </div>

      <Card className="rounded-xl border border-[var(--fg-border)] bg-[var(--fg-card)] shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[20px] font-semibold text-slate-800">
            <CalendarClock className="h-5 w-5 text-brand" /> 明日が期限のネクストアクション
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            明日までに対応が必要なネクストアクションを確認し、完了済みにできます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-sm text-slate-600">対象CS</Label>
              <Select value={selectedTomorrowCs} onValueChange={(value) => setSelectedTomorrowCs(value)}>
                <SelectTrigger className="w-full border border-slate-300 bg-white text-slate-900 sm:w-60">
                  <SelectValue placeholder="対象を選択" />
                </SelectTrigger>
                <SelectContent className="border border-slate-300 bg-white text-slate-900">
                  <SelectItem value="all">全員</SelectItem>
                  <SelectItem value="me">自分</SelectItem>
                  {csAssignees.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tomorrowLoading || loadingUser ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中...
            </div>
          ) : tomorrowTodos.length === 0 ? (
            <div className="py-10 text-center text-slate-500">対象のネクストアクションはありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-slate-700">
                  <TableHead>タイトル</TableHead>
                  <TableHead>期日</TableHead>
                  <TableHead>担当</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tomorrowTodos.map((item) => (
                  <TableRow key={item.id} className="even:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-800">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-brand/10 text-brand">
                        {formatJstDate(item.dueOn)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {userNameMap.get(item.assigneeId) ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-sm text-slate-700">
                      {item.notes ? item.notes : <span className="text-slate-500">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-brand text-white hover:bg-brand-600"
                        onClick={() => void handleToggleStatus(item, 'DONE')}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> 完了にする
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-[var(--fg-border)] bg-[var(--fg-card)] shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-[20px] font-semibold text-slate-800">マイToDo</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            担当のToDoを作成・完了・削除できます。管理者はCSを選んで配布できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {isAdmin && (
                <Select value={assigneeFilter} onValueChange={(value) => setAssigneeFilter(value)}>
                  <SelectTrigger className="w-full border border-slate-300 bg-white text-slate-900 sm:w-56">
                    <SelectValue placeholder="担当者" />
                  </SelectTrigger>
                  <SelectContent className="border border-slate-300 bg-white text-slate-900">
                    <SelectItem value="all">全員</SelectItem>
                    <SelectItem value="me">自分</SelectItem>
                    {csAssignees.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-full border border-slate-300 bg-white text-slate-900 sm:w-48">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent className="border border-slate-300 bg-white text-slate-900">
                  <SelectItem value="OPEN">未完了</SelectItem>
                  <SelectItem value="DONE">完了済み</SelectItem>
                  <SelectItem value="ALL">すべて</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setCreateOpen(true)} className="bg-brand text-white shadow-xs hover:bg-brand-600">
              <Plus className="mr-2 h-4 w-4" /> 新規ToDo
            </Button>
          </div>

          {todosLoading || loadingUser ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中...
            </div>
          ) : todos.length === 0 ? (
            <div className="py-10 text-center text-slate-500">ToDoはありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-slate-700">
                  <TableHead>タイトル</TableHead>
                  <TableHead>期日</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead>担当</TableHead>
                  <TableHead className="w-40 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((todo) => (
                  <TableRow key={todo.id} className="even:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-800">{todo.title}</TableCell>
                    <TableCell>{formatJstDate(todo.dueOn)}</TableCell>
                    <TableCell className="max-w-md text-slate-700">
                      {todo.notes ? todo.notes : <span className="text-slate-500">—</span>}
                    </TableCell>
                    <TableCell>{userNameMap.get(todo.assigneeId) ?? '—'}</TableCell>
                    <TableCell className="flex justify-end gap-2 text-right">
                      {todo.status === 'OPEN' ? (
                        <Button
                          size="sm"
                          className="bg-brand text-white hover:bg-brand-600"
                          onClick={() => void handleToggleStatus(todo, 'DONE')}
                        >
                          完了
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => void handleToggleStatus(todo, 'OPEN')}
                        >
                          再開
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => void handleDeleteTodo(todo.id)}>
                        <Trash2 className="mr-1 h-4 w-4" /> 削除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold text-slate-800">ToDoを追加</DialogTitle>
          </DialogHeader>

          <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="todo-title">タイトル</Label>
              <Input
                id="todo-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="タスク名"
                className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="todo-notes">メモ（任意）</Label>
              <Textarea
                id="todo-notes"
                value={createForm.notes}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="補足情報があれば入力してください"
                rows={3}
                className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="todo-dueOn">期日（任意）</Label>
              <Input
                id="todo-dueOn"
                type="date"
                value={createForm.dueOn}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, dueOn: event.target.value }))}
                className="border border-slate-300 bg-white text-slate-900"
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>担当CS</Label>
                <Select
                  value={createForm.assigneeId}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, assigneeId: value }))}
                >
                  <SelectTrigger className="border border-slate-300 bg-white text-slate-900">
                    <SelectValue placeholder="担当者を選択" />
                  </SelectTrigger>
                  <SelectContent className="border border-slate-300 bg-white text-slate-900">
                    <SelectItem value={SELF_ASSIGNEE}>自分</SelectItem>
                    {csAssignees.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </Button>
            <Button className="bg-brand text-white hover:bg-brand-600" onClick={() => void handleCreateSubmit()}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

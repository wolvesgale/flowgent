'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

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

const MS_PER_DAY = 86_400_000
const JST_OFFSET = 9 * 60 * 60 * 1000
const SELF_ASSIGNEE = '__SELF__'

type UserSummary = {
  id: string
  name: string
  role: 'ADMIN' | 'CS'
}

type CurrentUser = {
  id: string
  role: 'ADMIN' | 'CS'
}

type TodoItem = {
  id: string
  title: string
  notes: string | null
  dueOn: string | null
  status: 'OPEN' | 'DONE'
  assigneeId: string
  assignee: UserSummary | null
  createdById: string
  createdBy: UserSummary | null
  createdAt: string
  updatedAt: string
}

type TodoListResponse = {
  ok: true
  items: TodoItem[]
  currentUser: CurrentUser
  filters: {
    assigneeId: string
    status: 'OPEN' | 'DONE' | 'ALL'
  }
  assignees?: UserSummary[]
}

type TodoErrorResponse = {
  ok?: false
  error?: string
}

type EvangelistSummary = {
  id: string
  firstName?: string | null
  lastName?: string | null
  displayName?: string | null
  nextAction?: string | null
  nextActionDueOn?: string | null
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getTomorrowRangeUtc() {
  const now = Date.now()
  const startOfTodayUtc = Math.floor((now + JST_OFFSET) / MS_PER_DAY) * MS_PER_DAY - JST_OFFSET
  const startOfTomorrowUtc = startOfTodayUtc + MS_PER_DAY
  return { start: startOfTomorrowUtc, end: startOfTomorrowUtc + MS_PER_DAY }
}

function isDueTomorrow(value: string | null | undefined) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return false
  const { start, end } = getTomorrowRangeUtc()
  return timestamp >= start && timestamp < end
}

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
    window.location.href = '/login'
    return null
  }
  const data = contentType.includes('application/json') && raw ? JSON.parse(raw) : null
  return { response, data } as const
}

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loadingTodos, setLoadingTodos] = useState(true)
  const [tomorrowItems, setTomorrowItems] = useState<EvangelistSummary[]>([])
  const [tomorrowLoading, setTomorrowLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
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
  const initialLoadRef = useRef(false)

  const loadTodos = useCallback(
    async (override?: { assigneeId?: string; status?: string }) => {
      try {
        const targetStatus = (override?.status ?? statusFilter).toUpperCase()
        let targetAssignee = override?.assigneeId ?? assigneeFilter

        if (!currentUser || currentUser.role !== 'ADMIN') {
          targetAssignee = 'me'
        }

        setLoadingTodos(true)
        const params = new URLSearchParams()
        if (targetAssignee) params.set('assigneeId', targetAssignee)
        if (targetStatus) params.set('status', targetStatus)

        const result = await requestJson(`/api/todos?${params.toString()}`)
        if (!result) return
        const { response, data } = result
        if (!response.ok || !data?.ok) {
          const message = (data as TodoErrorResponse | null)?.error || 'ToDoの取得に失敗しました'
          toast.error(message)
          setTodos([])
          return
        }

        const payload = data as TodoListResponse
        setTodos(payload.items)
        setCurrentUser(payload.currentUser)
        if (Array.isArray(payload.assignees)) {
          setAssignees(payload.assignees)
        }

        const responseAssignee = payload.filters.assigneeId
        if (responseAssignee && responseAssignee !== assigneeFilter) {
          setAssigneeFilter(responseAssignee as 'me' | 'all' | string)
        }

        const responseStatus = payload.filters.status
        if (responseStatus && responseStatus !== statusFilter) {
          setStatusFilter(responseStatus)
        }
      } catch (error) {
        console.error('[todos:load]', error)
        toast.error('ToDoの取得に失敗しました')
      } finally {
        setLoadingTodos(false)
      }
    },
    [assigneeFilter, statusFilter, currentUser],
  )

  const loadTomorrow = useCallback(async () => {
    if (!currentUser) return
    try {
      setTomorrowLoading(true)
      const params = new URLSearchParams({ limit: '100' })
      let target: string | null = null
      if (currentUser.role === 'ADMIN') {
        if (selectedTomorrowCs === 'all') {
          target = null
        } else if (selectedTomorrowCs === 'me') {
          target = currentUser.id
        } else {
          target = selectedTomorrowCs
        }
      } else {
        target = currentUser.id
      }
      if (target) params.set('assignedCsId', target)
      const result = await requestJson(`/api/evangelists?${params.toString()}`)
      if (!result) return
      const { response, data } = result
      if (!response.ok || !data?.ok) {
        const message = (data as TodoErrorResponse | null)?.error || 'ネクストアクションの取得に失敗しました'
        toast.error(message)
        setTomorrowItems([])
        return
      }
      const rawItems = Array.isArray(data.items) ? (data.items as EvangelistSummary[]) : []
      const filtered = rawItems.filter((item) => isDueTomorrow(item.nextActionDueOn))
      setTomorrowItems(
        filtered.map((item) => {
          const fallbackName = [item.lastName, item.firstName].filter(Boolean).join(' ').trim()
          return {
            ...item,
            displayName: item.displayName || fallbackName || '氏名未設定',
          }
        }),
      )
    } catch (error) {
      console.error('[todos:tomorrow]', error)
      toast.error('ネクストアクションの取得に失敗しました')
      setTomorrowItems([])
    } finally {
      setTomorrowLoading(false)
    }
  }, [currentUser, selectedTomorrowCs])

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true
      void loadTodos()
    }
  }, [loadTodos])

  useEffect(() => {
    if (!currentUser) return
    void loadTodos()
  }, [currentUser, assigneeFilter, statusFilter, loadTodos])

  useEffect(() => {
    if (currentUser?.role === 'ADMIN' && assigneeFilter === 'me') {
      setAssigneeFilter('all')
    }
  }, [currentUser, assigneeFilter])

  useEffect(() => {
    if (!currentUser) return
    if (currentUser.role === 'ADMIN' && selectedTomorrowCs === 'me') {
      setSelectedTomorrowCs('all')
      return
    }
    void loadTomorrow()
  }, [currentUser, selectedTomorrowCs, loadTomorrow])

  const csAssignees = useMemo(
    () => assignees.filter((user) => user.role === 'CS'),
    [assignees],
  )

  const handleCompleteAction = useCallback(
    async (evangelistId: string) => {
      try {
        const result = await requestJson(`/api/evangelists/${evangelistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextAction: null, nextActionDueOn: null }),
        })
        if (!result) return
        const { response, data } = result
        if (!response.ok || data?.error) {
          const message = (data as TodoErrorResponse | null)?.error || '更新に失敗しました'
          toast.error(message)
          return
        }
        toast.success('ネクストアクションを完了しました')
        setTomorrowItems((prev) => prev.filter((item) => item.id !== evangelistId))
      } catch (error) {
        console.error('[todos:complete]', error)
        toast.error('更新に失敗しました')
      }
    },
    [],
  )

  const handleCreateSubmit = useCallback(async () => {
    if (!currentUser) return
    const title = createForm.title.trim()
    if (!title) {
      toast.error('タイトルを入力してください')
      return
    }
    const notes = createForm.notes.trim()
    const dueOn = createForm.dueOn.trim()

    let assigneeId: string = currentUser.id
    if (currentUser.role === 'ADMIN') {
      assigneeId = createForm.assigneeId === SELF_ASSIGNEE ? currentUser.id : createForm.assigneeId
      if (!assigneeId) {
        assigneeId = currentUser.id
      }
    }

    try {
      const result = await requestJson('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: notes || null,
          dueOn: dueOn || null,
          assigneeId,
        }),
      })
      if (!result) return
      const { response, data } = result
      if (!response.ok || !data?.ok) {
        const message = (data as TodoErrorResponse | null)?.error || 'ToDoの作成に失敗しました'
        toast.error(message)
        return
      }
      toast.success('ToDoを作成しました')
      const created = (data as { ok: true; item: TodoItem }).item
      if (created) {
        setTodos((prev) => [created, ...prev.filter((todo) => todo.id !== created.id)])
      }
      setCreateOpen(false)
      setCreateForm({ title: '', notes: '', dueOn: '', assigneeId: SELF_ASSIGNEE })
      void loadTodos()
    } catch (error) {
      console.error('[todos:create]', error)
      toast.error('ToDoの作成に失敗しました')
    }
  }, [createForm, currentUser, loadTodos])

  const handleToggleStatus = useCallback(
    async (todo: TodoItem, nextStatus: 'OPEN' | 'DONE') => {
      try {
        const result = await requestJson(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })
        if (!result) return
        const { response, data } = result
        if (!response.ok || !data?.ok) {
          const message = (data as TodoErrorResponse | null)?.error || '更新に失敗しました'
          toast.error(message)
          return
        }
        toast.success(nextStatus === 'DONE' ? '完了にしました' : '未完了に戻しました')
        void loadTodos()
      } catch (error) {
        console.error('[todos:update]', error)
        toast.error('更新に失敗しました')
      }
    },
    [loadTodos],
  )

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      if (!window.confirm('このToDoを削除します。よろしいですか？')) return
      try {
        const result = await requestJson(`/api/todos/${id}`, { method: 'DELETE' })
        if (!result) return
        const { response, data } = result
        if (!response.ok || data?.error) {
          const message = (data as TodoErrorResponse | null)?.error || '削除に失敗しました'
          toast.error(message)
          return
        }
        toast.success('削除しました')
        setTodos((prev) => prev.filter((todo) => todo.id !== id))
      } catch (error) {
        console.error('[todos:delete]', error)
        toast.error('削除に失敗しました')
      }
    },
    [],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">CS ToDo</h1>
        <p className="text-slate-500">
          明日期限のネクストアクションと、担当者ごとのToDoを確認・管理できます。
        </p>
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
          {currentUser?.role === 'ADMIN' && (
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

          {tomorrowLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中...
            </div>
          ) : tomorrowItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500">対象のネクストアクションはありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-slate-700">
                  <TableHead>氏名</TableHead>
                  <TableHead>ネクストアクション</TableHead>
                  <TableHead>期日</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tomorrowItems.map((item) => (
                  <TableRow key={item.id} className="even:bg-slate-50/50">
                    <TableCell>
                      <Link href={`/evangelists/${item.id}`} className="text-brand underline">
                        {item.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-md text-slate-700">
                      {item.nextAction ? (
                        <span>{item.nextAction}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-brand/10 text-brand">
                        {formatJstDate(item.nextActionDueOn)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-brand text-white hover:bg-brand-600"
                        onClick={() => void handleCompleteAction(item.id)}
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
              {currentUser?.role === 'ADMIN' && (
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

            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-brand text-white shadow-xs hover:bg-brand-600"
            >
              <Plus className="mr-2 h-4 w-4" /> 新規ToDo
            </Button>
          </div>

          {loadingTodos ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中...
            </div>
          ) : todos.length === 0 ? (
            <div className="py-10 text-center text-slate-500">対象のToDoはありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-slate-700">
                  <TableHead>タイトル</TableHead>
                  <TableHead>期日</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead>担当</TableHead>
                  <TableHead className="w-36 text-right">操作</TableHead>
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
                    <TableCell>{todo.assignee?.name ?? '—'}</TableCell>
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
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDeleteTodo(todo.id)}
                      >
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

            {currentUser?.role === 'ADMIN' && (
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

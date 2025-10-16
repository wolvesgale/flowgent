'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const TIER_OPTIONS = [
  { value: 'TIER1', label: 'TIER1' },
  { value: 'TIER2', label: 'TIER2' },
] as const

const STRENGTH_OPTIONS = [
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

const INITIAL_FORM = {
  innovatorId: '',
  startDate: '',
  endDate: '',
  tiers: [] as string[],
  strengths: [] as string[],
}

const formatDay = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ja-JP')
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type FormState = typeof INITIAL_FORM

type InnovatorOption = {
  id: number
  name: string
  url: string | null
  introPoint: string | null
}

type Rule = {
  id: string
  innovatorId: number
  startDate: string
  endDate: string
  tiers: string[]
  strengths: string[]
  createdAt: string
  updatedAt: string
  innovator: InnovatorOption
}

export default function RequiredIntroductionsPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [innovators, setInnovators] = useState<InnovatorOption[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<FormState>(INITIAL_FORM)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)

  const loadInnovators = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/innovators?limit=500', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json().catch(() => null)
      const items = Array.isArray(data?.items) ? (data.items as unknown[]) : []
      const parsed = items.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const id = Number(record.id)
        if (!Number.isFinite(id)) return []
        const name = typeof record.company === 'string' ? record.company : typeof record.name === 'string' ? record.name : ''
        if (!name) return []
        return [
          {
            id,
            name,
            url: typeof record.url === 'string' ? record.url : null,
            introPoint: typeof record.introPoint === 'string' ? record.introPoint : null,
          },
        ]
      })
      setInnovators(parsed)
    } catch (err) {
      console.error('Failed to load innovators', err)
    }
  }, [])

  const loadRules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/introductions/required', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('紹介必須ルールの取得に失敗しました')
      }
      const data = await response.json().catch(() => null)
      const rawRules = Array.isArray(data?.rules) ? (data.rules as unknown[]) : []
      const parsed = rawRules.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id : null
        const innovator = record.innovator as Record<string, unknown> | undefined
        if (!id || !innovator) return []
        const innovatorId = Number(record.innovatorId)
        if (!Number.isFinite(innovatorId)) return []
        return [
          {
            id,
            innovatorId,
            startDate: typeof record.startDate === 'string' ? record.startDate : '',
            endDate: typeof record.endDate === 'string' ? record.endDate : '',
            tiers: Array.isArray(record.tiers) ? (record.tiers as string[]) : [],
            strengths: Array.isArray(record.strengths) ? (record.strengths as string[]) : [],
            createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
            innovator: {
              id: Number(innovator.id),
              name: typeof innovator.name === 'string' ? innovator.name : '',
              url: typeof innovator.url === 'string' ? innovator.url : null,
              introPoint: typeof innovator.introPoint === 'string' ? innovator.introPoint : null,
            },
          },
        ]
      })
      setRules(parsed)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '紹介必須ルールの取得に失敗しました')
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInnovators()
    void loadRules()
  }, [loadInnovators, loadRules])

  const innovatorOptions = useMemo(() => innovators.sort((a, b) => a.name.localeCompare(b.name)), [innovators])

  const resetForm = () => setForm(INITIAL_FORM)

  const toggleSelection = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

  const submitRule = async () => {
    if (!form.innovatorId || !form.startDate || !form.endDate) {
      toast.error('イノベータ・期間を入力してください')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        innovatorId: Number(form.innovatorId),
        startDate: form.startDate,
        endDate: form.endDate,
        tiers: form.tiers,
        strengths: form.strengths,
      }
      const response = await fetch('/api/admin/introductions/required', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(typeof data?.error === 'string' ? data.error : 'ルールの作成に失敗しました')
      }
      toast.success('紹介必須ルールを作成しました')
      resetForm()
      await loadRules()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'ルールの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditDialog = (rule: Rule) => {
    setEditingRule(rule)
    setEditForm({
      innovatorId: rule.innovatorId.toString(),
      startDate: rule.startDate.slice(0, 10),
      endDate: rule.endDate.slice(0, 10),
      tiers: [...rule.tiers],
      strengths: [...rule.strengths],
    })
    setIsEditDialogOpen(true)
  }

  const updateRule = async () => {
    if (!editingRule) return
    if (!editForm.innovatorId || !editForm.startDate || !editForm.endDate) {
      toast.error('イノベータ・期間を入力してください')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        innovatorId: Number(editForm.innovatorId),
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        tiers: editForm.tiers,
        strengths: editForm.strengths,
      }
      const response = await fetch(`/api/admin/introductions/required/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(typeof data?.error === 'string' ? data.error : 'ルールの更新に失敗しました')
      }
      toast.success('紹介必須ルールを更新しました')
      setIsEditDialogOpen(false)
      setEditingRule(null)
      await loadRules()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'ルールの更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('この紹介必須ルールを削除しますか？')) return
    try {
      const response = await fetch(`/api/admin/introductions/required/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(typeof data?.error === 'string' ? data.error : 'ルールの削除に失敗しました')
      }
      toast.success('紹介必須ルールを削除しました')
      await loadRules()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'ルールの削除に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>紹介必須ルールの作成</CardTitle>
          <CardDescription>期間や条件を指定して、エヴァに紹介必須のイノベータを設定します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="innovator-select">イノベータ</Label>
              <select
                id="innovator-select"
                value={form.innovatorId}
                onChange={(event) => setForm((prev) => ({ ...prev, innovatorId: event.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="">選択してください</option>
                {innovatorOptions.map((innovator) => (
                  <option key={innovator.id} value={innovator.id}>
                    {innovator.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">開始日</Label>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">終了日</Label>
              <Input
                id="end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>対象ティア（複数選択可）</Label>
              <div className="flex flex-wrap gap-2">
                {TIER_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.tiers.includes(option.value)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          tiers: toggleSelection(prev.tiers, option.value),
                        }))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>対象強み（複数選択可）</Label>
              <div className="flex flex-wrap gap-2">
                {STRENGTH_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.strengths.includes(option.value)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          strengths: toggleSelection(prev.strengths, option.value),
                        }))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
              クリア
            </Button>
            <Button onClick={submitRule} disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : 'ルールを追加'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済みルール</CardTitle>
          <CardDescription>現在有効な紹介必須ルールの一覧です。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">読み込み中...</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">登録されたルールはありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>イノベータ</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>ティア条件</TableHead>
                    <TableHead>強み条件</TableHead>
                    <TableHead>更新日時</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{rule.innovator.name}</span>
                          {rule.innovator.url && (
                            <a
                              href={rule.innovator.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-600 underline"
                            >
                              {rule.innovator.url}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{formatDay(rule.startDate)}</span>
                          <span>〜 {formatDay(rule.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.tiers.length === 0 ? (
                            <span className="text-xs text-muted-foreground">全ティア</span>
                          ) : (
                            rule.tiers.map((tier) => (
                              <Badge key={tier} variant="secondary">
                                {tier}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.strengths.length === 0 ? (
                            <span className="text-xs text-muted-foreground">制限なし</span>
                          ) : (
                            rule.strengths.map((strength) => (
                              <Badge key={strength} variant="outline">
                                {STRENGTH_OPTIONS.find((option) => option.value === strength)?.label ?? strength}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(rule.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(rule)}>
                            編集
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteRule(rule.id)}>
                            削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>ルールを編集</DialogTitle>
            <DialogDescription>選択した紹介必須ルールを更新します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-innovator">イノベータ</Label>
              <select
                id="edit-innovator"
                value={editForm.innovatorId}
                onChange={(event) => setEditForm((prev) => ({ ...prev, innovatorId: event.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="">選択してください</option>
                {innovatorOptions.map((innovator) => (
                  <option key={innovator.id} value={innovator.id}>
                    {innovator.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">開始日</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={editForm.startDate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  className="bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-date">終了日</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={editForm.endDate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>対象ティア</Label>
              <div className="flex flex-wrap gap-2">
                {TIER_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.tiers.includes(option.value)}
                      onChange={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          tiers: toggleSelection(prev.tiers, option.value),
                        }))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>対象強み</Label>
              <div className="flex flex-wrap gap-2">
                {STRENGTH_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.strengths.includes(option.value)}
                      onChange={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          strengths: toggleSelection(prev.strengths, option.value),
                        }))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button onClick={updateRule} disabled={isSubmitting}>
              {isSubmitting ? '更新中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

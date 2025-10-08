'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  Edit, 
  Save, 
  X,
  Plus,
  MessageSquare
} from 'lucide-react'

interface Evangelist {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  contactPreference?: string | null
  strength?: string | null
  supportPriority?: string | null
  pattern?: string | null
  registrationStatus?: string | null
  listAcquired?: string | null
  meetingStatus?: string | null
  notes?: string | null
  tier: 'TIER1' | 'TIER2'
  assignedCsId?: string | null
  assignedCs?: {
    id: string
    name: string
  } | null
  phase?: string | null
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  name: string
  role: 'ADMIN' | 'CS'
}

type EditFormState = {
  firstName: string
  lastName: string
  email: string
  contactPreference?: string | null
  strength?: string | null
  pattern?: string | null
  registrationStatus?: string | null
  listAcquired?: string | null
  nextActionNote?: string | null
  nextActionDueOn?: string | null
  phase?: string | null
  notes: string
  tier: 'TIER1' | 'TIER2'
  assignedCsId?: string | null
}

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

const CONTACT_OPTIONS = [
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'LINE', label: 'LINE' },
  { value: 'EMAIL', label: 'メール' },
  { value: 'PHONE', label: '電話' },
  { value: 'SLACK', label: 'Slack' },
] as const

const PHASE_OPTIONS = [
  { value: 'INQUIRY', label: '問い合わせ' },
  { value: 'FIRST_MEETING', label: '初回面談' },
  { value: 'REGISTERED', label: '登録' },
  { value: 'LIST_MATCHING', label: 'リスト提供/突合' },
  { value: 'INNOVATOR_CONFIRM', label: 'イノベータ確認' },
  { value: 'INTRODUCTION', label: '紹介開始' },
  { value: 'DEAL_SETTING', label: '商談設定' },
  { value: 'FIRST_RESULT', label: '初回実績' },
  { value: 'CONTINUOUS_PROPOSAL', label: '継続提案' },
] as const

interface Meeting {
  id: string
  evangelistId: number
  date: string
  isFirst: boolean
  summary?: string
  nextActions?: string
  contactMethod?: string
  createdAt: string
}

const TIER_COLORS = {
  TIER1: 'bg-blue-100 text-blue-800',
  TIER2: 'bg-gray-100 text-gray-800'
}

export default function EvangelistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [evangelist, setEvangelist] = useState<Evangelist | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get('tab') === 'meetings' ? 'meetings' : 'overview'
  const [activeTab, setActiveTab] = useState<'overview' | 'meetings'>(initialTab)
  const [editForm, setEditForm] = useState<EditFormState>({
    firstName: '',
    lastName: '',
    email: '',
    contactPreference: undefined,
    strength: undefined,
    pattern: undefined,
    registrationStatus: undefined,
    listAcquired: undefined,
    nextActionNote: undefined,
    nextActionDueOn: undefined,
    phase: undefined,
    notes: '',
    tier: 'TIER2',
    assignedCsId: undefined,
  })

  // 新しい面談記録用の状態
  const [newMeeting, setNewMeeting] = useState({
    isFirst: false,
    summary: '',
    nextActions: '',
    contactMethod: ''
  })
  const [isAddingMeeting, setIsAddingMeeting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?role=CS', {
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

  const fetchEvangelistData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // EVA詳細データを取得
      const evangelistResponse = await fetch(`/api/evangelists/${params.id}`, {
        credentials: 'include',
      })
      if (!evangelistResponse.ok) {
        throw new Error('EVAデータの取得に失敗しました')
      }
      const evangelistData: Evangelist = await evangelistResponse.json()
      setEvangelist(evangelistData)
      setEditForm({
        firstName: evangelistData.firstName ?? '',
        lastName: evangelistData.lastName ?? '',
        email: evangelistData.email ?? '',
        contactPreference: evangelistData.contactPreference ?? undefined,
        strength: evangelistData.strength ?? undefined,
        pattern: evangelistData.pattern ?? undefined,
        registrationStatus: evangelistData.registrationStatus ?? undefined,
        listAcquired: evangelistData.listAcquired ?? undefined,
        nextActionNote: evangelistData.meetingStatus ?? undefined,
        nextActionDueOn: evangelistData.supportPriority ?? undefined,
        phase: evangelistData.phase ?? undefined,
        notes: evangelistData.notes ?? '',
        tier: evangelistData.tier,
        assignedCsId: evangelistData.assignedCsId ?? undefined,
      })

      // 面談履歴を取得
      const meetingsResponse = await fetch(`/api/evangelists/${params.id}/meetings`, {
        credentials: 'include',
      })
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json()
        setMeetings(meetingsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) {
      void fetchEvangelistData()
      void fetchUsers()
    }
  }, [params.id, fetchEvangelistData, fetchUsers])

  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    setActiveTab(tabParam === 'meetings' ? 'meetings' : 'overview')
  }, [searchParams])

  const handleSave = async () => {
    try {
      const trimmedFirstName = editForm.firstName.trim()
      const trimmedLastName = editForm.lastName.trim()
      const trimmedEmail = editForm.email.trim()
      const trimmedPattern = editForm.pattern?.trim() ?? ''
      const trimmedRegistrationStatus = editForm.registrationStatus?.trim() ?? ''
      const trimmedListAcquired = editForm.listAcquired?.trim() ?? ''
      const trimmedNextActionNote = editForm.nextActionNote?.trim() ?? ''
      const trimmedNextActionDueOn = editForm.nextActionDueOn?.trim() ?? ''
      const trimmedNotes = editForm.notes.trim()

      const payload = {
        ...(trimmedFirstName ? { firstName: trimmedFirstName } : {}),
        ...(trimmedLastName ? { lastName: trimmedLastName } : {}),
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        contactPreference: editForm.contactPreference ?? null,
        strength: editForm.strength ?? null,
        pattern: trimmedPattern || null,
        registrationStatus: trimmedRegistrationStatus || null,
        listAcquired: trimmedListAcquired || null,
        nextActionNote: trimmedNextActionNote || null,
        nextActionDueOn: trimmedNextActionDueOn || null,
        phase: editForm.phase,
        notes: trimmedNotes || null,
        tier: editForm.tier,
        assignedCsId: editForm.assignedCsId ?? null,
      }

      const response = await fetch(`/api/evangelists/${params.id}`, {
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

      const updatedData: Evangelist = await response.json()
      setEvangelist(updatedData)
      setEditForm({
        firstName: updatedData.firstName ?? '',
        lastName: updatedData.lastName ?? '',
        email: updatedData.email ?? '',
        contactPreference: updatedData.contactPreference ?? undefined,
        strength: updatedData.strength ?? undefined,
        pattern: updatedData.pattern ?? undefined,
        registrationStatus: updatedData.registrationStatus ?? undefined,
        listAcquired: updatedData.listAcquired ?? undefined,
        nextActionNote: updatedData.meetingStatus ?? undefined,
        nextActionDueOn: updatedData.supportPriority ?? undefined,
        phase: updatedData.phase ?? undefined,
        notes: updatedData.notes ?? '',
        tier: updatedData.tier,
        assignedCsId: updatedData.assignedCsId ?? undefined,
      })
      setIsEditing(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  const handleAddMeeting = async () => {
    try {
      const response = await fetch(`/api/evangelists/${params.id}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newMeeting),
      })

      if (!response.ok) {
        throw new Error('面談記録の追加に失敗しました')
      }

      const meetingData = await response.json()
      setMeetings(prev => [meetingData, ...prev])
      setNewMeeting({
        isFirst: false,
        summary: '',
        nextActions: '',
        contactMethod: ''
      })
      setIsAddingMeeting(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '面談記録の追加に失敗しました')
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!evangelist) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>EVAが見つかりませんでした</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {evangelist.firstName} {evangelist.lastName}
            </h1>
            <p className="text-muted-foreground">{evangelist.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={TIER_COLORS[evangelist.tier]}>
            {evangelist.tier}
          </Badge>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              編集
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  if (evangelist) {
                    setEditForm({
                      firstName: evangelist.firstName ?? '',
                      lastName: evangelist.lastName ?? '',
                      email: evangelist.email ?? '',
                      contactPreference: evangelist.contactPreference ?? undefined,
                      strength: evangelist.strength ?? undefined,
                      pattern: evangelist.pattern ?? undefined,
                      registrationStatus: evangelist.registrationStatus ?? undefined,
                      listAcquired: evangelist.listAcquired ?? undefined,
                      nextActionNote: evangelist.meetingStatus ?? undefined,
                      nextActionDueOn: evangelist.supportPriority ?? undefined,
                      phase: evangelist.phase ?? undefined,
                      notes: evangelist.notes ?? '',
                      tier: evangelist.tier,
                      assignedCsId: evangelist.assignedCsId ?? undefined,
                    })
                  }
                }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* タブコンテンツ */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'overview' | 'meetings')}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="meetings">面談シート</TabsTrigger>
        </TabsList>

        {/* 概要タブ */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                基本情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>氏名</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={editForm.firstName || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="姓"
                      />
                      <Input
                        value={editForm.lastName || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="名"
                      />
                    </div>
                  ) : (
                    <p className="text-sm">{evangelist.firstName} {evangelist.lastName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    メールアドレス
                  </Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{evangelist.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    連絡先
                  </Label>
                  {isEditing ? (
                    <Select
                      value={editForm.contactPreference ?? ''}
                      onValueChange={(value) =>
                        setEditForm(prev => ({
                          ...prev,
                          contactPreference: value || null,
                        }))
                      }
                    >
                    <SelectTrigger className="bg-white text-slate-900">
                      <SelectValue className="text-slate-900" placeholder="連絡手段を選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="">未設定</SelectItem>
                        {CONTACT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      {CONTACT_OPTIONS.find(option => option.value === evangelist.contactPreference)?.label || '未設定'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>ティア</Label>
                  {isEditing ? (
                    <Select
                      value={editForm.tier || 'TIER2'}
                      onValueChange={(value: 'TIER1' | 'TIER2') => 
                        setEditForm(prev => ({ ...prev, tier: value }))
                      }
                    >
                    <SelectTrigger className="text-slate-900">
                      <SelectValue className="text-slate-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="TIER1">TIER1</SelectItem>
                        <SelectItem value="TIER2">TIER2</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={TIER_COLORS[evangelist.tier]}>
                      {evangelist.tier}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>強み・専門分野</Label>
                {isEditing ? (
                  <Select
                    value={editForm.strength ?? ''}
                    onValueChange={(value) =>
                      setEditForm(prev => ({
                        ...prev,
                        strength: value || null,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900">
                      <SelectValue className="text-slate-900" placeholder="強みを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="">未設定</SelectItem>
                      {STRENGTH_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {STRENGTH_OPTIONS.find(option => option.value === evangelist.strength)?.label || '未設定'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>フェーズ</Label>
                {isEditing ? (
                  <Select
                    value={editForm.phase ?? ''}
                    onValueChange={(value) =>
                      setEditForm(prev => ({
                        ...prev,
                        phase: value || null,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white text-slate-900">
                      <SelectValue className="text-slate-900" placeholder="フェーズを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="">未設定</SelectItem>
                      {PHASE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {PHASE_OPTIONS.find(option => option.value === evangelist.phase)?.label || '未設定'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>領域</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.pattern ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pattern: e.target.value }))}
                      placeholder="例：IT、人事 など"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.pattern || '未設定'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>登録有無</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.registrationStatus ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationStatus: e.target.value }))}
                      placeholder="例：登録済 / 未登録"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.registrationStatus || '未設定'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>リスト提出有無</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.listAcquired ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, listAcquired: e.target.value }))}
                      placeholder="例：提出済 / 未提出"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.listAcquired || '未設定'}</p>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>

          {/* 担当CS情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                担当CS情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-2">
                  <Label>担当CS</Label>
                  <Select
                    value={editForm.assignedCsId ?? ''}
                    onValueChange={(value) =>
                      setEditForm(prev => ({
                        ...prev,
                        assignedCsId: value || null,
                      }))
                    }
                  >
                    <SelectTrigger className="text-slate-900">
                      <SelectValue className="text-slate-900" placeholder="CSを選択してください" />
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
                </div>
              ) : (
                <p className="text-sm">
                  {evangelist.assignedCs ? evangelist.assignedCs.name : '未割り当て'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 面談シートタブ */}
        <TabsContent value="meetings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                面談シート
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>連絡手段</Label>
                  {isEditing ? (
                    <Select
                      value={editForm.contactPreference ?? ''}
                      onValueChange={(value) =>
                        setEditForm(prev => ({
                          ...prev,
                          contactPreference: value || null,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white text-slate-900">
                        <SelectValue className="text-slate-900" placeholder="連絡手段を選択" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900">
                        <SelectItem value="">未設定</SelectItem>
                        {CONTACT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {CONTACT_OPTIONS.find(option => option.value === evangelist.contactPreference)?.label || '未設定'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>強み</Label>
                  {isEditing ? (
                    <Select
                      value={editForm.strength ?? ''}
                      onValueChange={(value) =>
                        setEditForm(prev => ({
                          ...prev,
                          strength: value || null,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white text-slate-900">
                        <SelectValue className="text-slate-900" placeholder="強みを選択" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900">
                        <SelectItem value="">未設定</SelectItem>
                        {STRENGTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {STRENGTH_OPTIONS.find(option => option.value === evangelist.strength)?.label || '未設定'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>リスト提供有無</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.listAcquired ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, listAcquired: e.target.value }))}
                      placeholder="例：提出済 / 未提出"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.listAcquired || '未設定'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>N/A（ネクストアクション）</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.nextActionNote ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nextActionNote: e.target.value }))}
                      placeholder="次のアクション内容を入力"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.meetingStatus || '未設定'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>N/A期日</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.nextActionDueOn ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nextActionDueOn: e.target.value }))}
                      placeholder="例：2024-05-01"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.supportPriority || '未設定'}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>メモ</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="面談メモを入力"
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{evangelist.notes || '未設定'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">面談履歴</h2>
            <Button
              onClick={() => setIsAddingMeeting(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              面談記録を追加
            </Button>
          </div>

          {/* 新しい面談記録の追加フォーム */}
          {isAddingMeeting && (
            <Card>
              <CardHeader>
                <CardTitle>新しい面談記録</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isFirst"
                    checked={newMeeting.isFirst}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMeeting(prev => ({ ...prev, isFirst: e.target.checked }))}
                  />
                  <Label htmlFor="isFirst">初回面談</Label>
                </div>

                <div className="space-y-2">
                  <Label>連絡方法</Label>
                  <Input
                    value={newMeeting.contactMethod}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMeeting(prev => ({ ...prev, contactMethod: e.target.value }))}
                    placeholder="電話、メール、対面など"
                  />
                </div>

                <div className="space-y-2">
                  <Label>面談サマリー</Label>
                  <Textarea
                    value={newMeeting.summary}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMeeting(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="面談の内容をまとめてください"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>次回アクション</Label>
                  <Textarea
                    value={newMeeting.nextActions}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMeeting(prev => ({ ...prev, nextActions: e.target.value }))}
                    placeholder="次回までに行うアクションを記載"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddMeeting}>
                    保存
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingMeeting(false)
                      setNewMeeting({
                        isFirst: false,
                        summary: '',
                        nextActions: '',
                        contactMethod: ''
                      })
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 面談履歴一覧 */}
          <div className="space-y-4">
            {meetings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>まだ面談記録がありません</p>
                </CardContent>
              </Card>
            ) : (
              meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(meeting.date).toLocaleDateString('ja-JP')}
                        {meeting.isFirst && (
                          <Badge variant="secondary" className="text-xs">初回</Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {meeting.contactMethod}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {meeting.summary && (
                      <div>
                        <h4 className="font-medium mb-2">面談サマリー</h4>
                        <p className="text-sm whitespace-pre-wrap">{meeting.summary}</p>
                      </div>
                    )}
                    {meeting.nextActions && (
                      <div>
                        <h4 className="font-medium mb-2">次回アクション</h4>
                        <p className="text-sm whitespace-pre-wrap">{meeting.nextActions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
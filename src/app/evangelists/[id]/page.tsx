'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
    id: number
    name: string
  }
  createdAt: string
  updatedAt: string
}

interface User {
  id: number
  name: string
  role: 'ADMIN' | 'CS'
}

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
  const [editForm, setEditForm] = useState<Partial<Evangelist>>({})

  // 新しい面談記録用の状態
  const [newMeeting, setNewMeeting] = useState({
    isFirst: false,
    summary: '',
    nextActions: '',
    contactMethod: ''
  })
  const [isAddingMeeting, setIsAddingMeeting] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchEvangelistData()
      fetchUsers()
    }
  }, [params.id])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users?role=CS')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchEvangelistData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // EVA詳細データを取得
      const evangelistResponse = await fetch(`/api/evangelists/${params.id}`)
      if (!evangelistResponse.ok) {
        throw new Error('EVAデータの取得に失敗しました')
      }
      const evangelistData = await evangelistResponse.json()
      setEvangelist(evangelistData)
      setEditForm(evangelistData)

      // 面談履歴を取得
      const meetingsResponse = await fetch(`/api/evangelists/${params.id}/meetings`)
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json()
        setMeetings(meetingsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/evangelists/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error('更新に失敗しました')
      }

      const updatedData = await response.json()
      setEvangelist(updatedData)
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
                  setEditForm(evangelist)
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
      <Tabs defaultValue="overview" className="space-y-6">
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
                    <Input
                      value={editForm.contactPref || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, contactPref: e.target.value }))}
                      placeholder="電話番号など"
                    />
                  ) : (
                    <p className="text-sm">{evangelist.contactPref || '未設定'}</p>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                  <Textarea
                    value={editForm.strengths || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, strengths: e.target.value }))}
                    placeholder="強みや専門分野を入力"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{evangelist.strengths || '未設定'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>備考</Label>
                {isEditing ? (
                  <Textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="備考を入力"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{evangelist.notes || '未設定'}</p>
                )}
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
                    value={editForm.assignedUserId?.toString() || ''}
                    onValueChange={(value) => 
                      setEditForm(prev => ({ 
                        ...prev, 
                        assignedUserId: value ? parseInt(value) : undefined 
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="CSを選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未割り当て</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm">
                  {evangelist.assignedUser ? evangelist.assignedUser.name : '未割り当て'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 面談シートタブ */}
        <TabsContent value="meetings" className="space-y-6">
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
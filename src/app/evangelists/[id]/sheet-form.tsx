'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type SheetFormProps = {
  evangelist: {
    id: string
    strength: string
    contactPref: string
    managementPhase: string
  }
  latestMeeting: {
    id: string
    date: string
    isFirst: boolean
    summary: string
    nextActions: string
    contactMethod: string
  } | null
}

function toDateTimeLocalValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

export default function SheetForm({ evangelist, latestMeeting }: SheetFormProps) {
  const router = useRouter()
  const initialDate = toDateTimeLocalValue(latestMeeting?.date)
  const initialSummary = latestMeeting?.summary ?? ''
  const initialNextActions = latestMeeting?.nextActions ?? ''
  const initialContactMethod = latestMeeting?.contactMethod ?? ''
  const initialIsFirst = latestMeeting?.isFirst ?? false

  const initialMeetingRef = useRef({
    date: initialDate,
    isFirst: initialIsFirst,
    summary: initialSummary.trim(),
    nextActions: initialNextActions.trim(),
    contactMethod: initialContactMethod.trim(),
  })

  const [date, setDate] = useState<string>(initialDate)
  const [isFirst, setIsFirst] = useState<boolean>(initialIsFirst)
  const [summary, setSummary] = useState<string>(initialSummary)
  const [nextActions, setNextActions] = useState<string>(initialNextActions)
  const [contactMethod, setContactMethod] = useState<string>(initialContactMethod)
  const [strength, setStrength] = useState<string>(evangelist.strength ?? '')
  const [contactPref, setContactPref] = useState<string>(evangelist.contactPref ?? '')
  const [managementPhase, setManagementPhase] = useState<string>(evangelist.managementPhase ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const summaryValue = summary.trim()
      const nextActionsValue = nextActions.trim()
      const contactMethodValue = contactMethod.trim()
      const strengthValue = strength.trim()
      const contactPrefValue = contactPref.trim()
      const managementPhaseValue = managementPhase.trim()

      const meetingChanged =
        date !== initialMeetingRef.current.date ||
        isFirst !== initialMeetingRef.current.isFirst ||
        summaryValue !== initialMeetingRef.current.summary ||
        nextActionsValue !== initialMeetingRef.current.nextActions ||
        contactMethodValue !== initialMeetingRef.current.contactMethod

      const shouldCreateMeeting =
        meetingChanged &&
        (summaryValue.length > 0 ||
          nextActionsValue.length > 0 ||
          contactMethodValue.length > 0 ||
          Boolean(date) ||
          isFirst)

      const meetingPayload = shouldCreateMeeting
        ? {
            date: date ? new Date(date).toISOString() : undefined,
            isFirst,
            summary: summaryValue.length > 0 ? summaryValue : null,
            nextActions: nextActionsValue.length > 0 ? nextActionsValue : null,
            contactMethod: contactMethodValue.length > 0 ? contactMethodValue : null,
          }
        : undefined

      const evangelistPayload = {
        strength: strengthValue.length > 0 ? strengthValue : null,
        contactPref: contactPrefValue.length > 0 ? contactPrefValue : null,
        managementPhase: managementPhaseValue.length > 0 ? managementPhaseValue : null,
      }

      const response = await fetch(`/api/evangelists/${evangelist.id}/sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meeting: meetingPayload, evangelist: evangelistPayload }),
      })

      const text = await response.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }

      const responseBody =
        data && typeof data === 'object' ? (data as Record<string, unknown>) : null

      if (!response.ok || responseBody?.ok !== true) {
        const message =
          (responseBody &&
            (typeof responseBody.error === 'string'
              ? responseBody.error
              : typeof responseBody.message === 'string'
                ? responseBody.message
                : undefined)) ||
          text ||
          response.statusText ||
          `HTTP ${response.status}`
        throw new Error(message)
      }

      toast.success('面談内容を保存しました')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-lg font-semibold">面談メモ</h2>
          <p className="text-sm text-slate-500">面談内容と次回アクションを記録します。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">面談日時</span>
            <Input
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isFirst}
              onChange={(event) => setIsFirst(event.target.checked)}
              className="size-4"
            />
            初回面談
          </label>
          <label className="md:col-span-2 text-sm">
            <span className="mb-1 block text-slate-600">サマリー / メモ</span>
            <Textarea
              rows={4}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-sm">
            <span className="mb-1 block text-slate-600">次回アクション</span>
            <Textarea
              rows={3}
              value={nextActions}
              onChange={(event) => setNextActions(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">確認した連絡手段</span>
            <Input
              value={contactMethod}
              onChange={(event) => setContactMethod(event.target.value)}
              placeholder="例: LINE / メール"
            />
          </label>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">EVA 属性の更新</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">強み</span>
              <Input value={strength} onChange={(event) => setStrength(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">希望連絡手段</span>
              <Input
                value={contactPref}
                onChange={(event) => setContactPref(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">フェーズ</span>
              <Input
                value={managementPhase}
                onChange={(event) => setManagementPhase(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={isSubmitting}>
            {isSubmitting ? '保存中…' : '保存する'}
          </Button>
        </div>
      </form>
    </section>
  )
}

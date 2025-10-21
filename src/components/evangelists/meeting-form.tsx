"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export type MeetingRecord = {
  id: string
  evangelistId: string
  date: string
  isFirst: boolean
  summary?: string | null
  nextActions?: string | null
  contactMethod?: string | null
  createdAt: string
  updatedAt: string
}

type SavedEvangelistPayload = {
  id: string
  nextAction: string | null
  nextActionDueOn: string | null
  [key: string]: unknown
}

export type MeetingSaveResult = {
  meeting: MeetingRecord
  evangelist: SavedEvangelistPayload
}

export type RequiredIntroduction = {
  id: string
  startDate: string
  endDate: string
  tiers: string[]
  strengths: string[]
  innovator: {
    id: number
    name: string
    url: string | null
    introPoint: string | null
  }
}

const defaultMeetingState = {
  isFirst: false,
  contactMethod: "",
  summary: "",
  nextAction: "",
  nextActionDueOn: "",
}

type MeetingFormMode = "inline" | "sheet"

type MeetingFormProps = {
  evangelistId: string
  onSaved?: (result: MeetingSaveResult) => void
  mode?: MeetingFormMode
  onSubmitted?: () => void
}

export function MeetingForm({ evangelistId, onSaved, mode = "inline", onSubmitted }: MeetingFormProps) {
  const router = useRouter()
  const [meeting, setMeeting] = useState(defaultMeetingState)
  const [submitting, setSubmitting] = useState(false)
  const [requiredIntroductions, setRequiredIntroductions] = useState<RequiredIntroduction[]>([])
  const [requiredIntroError, setRequiredIntroError] = useState<string | null>(null)
  const [requiredIntroLoading, setRequiredIntroLoading] = useState(false)

  const fetchRequiredIntroductions = useCallback(async () => {
    if (!evangelistId) return
    setRequiredIntroLoading(true)
    setRequiredIntroError(null)
    try {
      const params = new URLSearchParams({
        evangelistId,
        at: new Date().toISOString(),
      })
      const response = await fetch(`/api/admin/introductions/required/active?${params.toString()}`, {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error("紹介必須ルールの取得に失敗しました")
      }
      const data = (await response.json().catch(() => null)) as { rules?: unknown }
      const rawRules = (data?.rules ?? []) as unknown
      const rules = Array.isArray(rawRules) ? (rawRules as RequiredIntroduction[]) : []
      setRequiredIntroductions(rules)
    } catch (error) {
      console.error("Failed to load required introductions", error)
      setRequiredIntroductions([])
      setRequiredIntroError("紹介必須ルールを取得できませんでした")
    } finally {
      setRequiredIntroLoading(false)
    }
  }, [evangelistId])

  useEffect(() => {
    void fetchRequiredIntroductions()
  }, [fetchRequiredIntroductions])

  const hasRequiredIntroductions = requiredIntroductions.length > 0

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!evangelistId || submitting) return

    const payload = {
      isInitial: meeting.isFirst,
      contactMethod: meeting.contactMethod.trim() || undefined,
      summary: meeting.summary.trim() || undefined,
      nextAction: meeting.nextAction.trim() || undefined,
      nextActionDueOn: meeting.nextActionDueOn.trim() || undefined,
    }

    try {
      setSubmitting(true)
      const response = await fetch(`/api/evangelists/${evangelistId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get("content-type") || ""
      const rawBody = await response.text()
      const parsed = contentType.includes("application/json") && rawBody ? JSON.parse(rawBody) : null

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !parsed?.ok) {
        const message = parsed?.error || "面談記録の保存に失敗しました"
        throw new Error(message)
      }

      const { meeting: createdMeeting, evangelist } = parsed as {
        meeting: MeetingRecord
        evangelist: SavedEvangelistPayload
      }

      toast.success("面談記録を保存しました")
      setMeeting(defaultMeetingState)
      onSaved?.({ meeting: createdMeeting, evangelist })
      router.refresh()
      onSubmitted?.()
    } catch (error) {
      console.error("Failed to save meeting", error)
      toast.error(error instanceof Error ? error.message : "面談記録の保存に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = useCallback(() => {
    setMeeting(defaultMeetingState)
  }, [])

  const requiredIntroContent = useMemo(() => {
    if (requiredIntroLoading) {
      return <p className="text-sm text-muted-foreground">読み込み中...</p>
    }
    if (requiredIntroError) {
      return <p className="text-sm text-destructive">{requiredIntroError}</p>
    }
    if (!hasRequiredIntroductions) {
      return <p className="text-sm text-muted-foreground">現在、紹介必須のイノベータはありません。</p>
    }

    return (
      <ul className="mt-3 space-y-3">
        {requiredIntroductions.map((rule) => (
          <li key={rule.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-900">
                  紹介必須
                </Badge>
                <span className="font-semibold">{rule.innovator.name}</span>
              </div>
              <span className="text-xs text-amber-700">
                {new Date(rule.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(rule.endDate).toLocaleDateString("ja-JP")}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-amber-800">
              {rule.innovator.url && (
                <p>
                  URL: {" "}
                  <a
                    href={rule.innovator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {rule.innovator.url}
                  </a>
                </p>
              )}
              <p>紹介ポイント: {rule.innovator.introPoint || "—"}</p>
            </div>
          </li>
        ))}
      </ul>
    )
  }, [hasRequiredIntroductions, requiredIntroError, requiredIntroLoading, requiredIntroductions])

  return (
    <form className="flex h-full w-full flex-col" onSubmit={handleSubmit}>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-4">
          <div className="rounded-lg border border-amber-300 bg-amber-100/60 p-4">
            <h3 className="text-sm font-semibold text-amber-900">紹介必須イノベータ</h3>
            {requiredIntroContent}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="meeting-is-first"
              type="checkbox"
              className="h-4 w-4 rounded border border-slate-300"
              checked={meeting.isFirst}
              onChange={(event) => setMeeting((prev) => ({ ...prev, isFirst: event.target.checked }))}
            />
            <Label htmlFor="meeting-is-first" className="text-sm">
              初回面談
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-contact-method">連絡方法</Label>
            <Input
              id="meeting-contact-method"
              value={meeting.contactMethod}
              onChange={(event) => setMeeting((prev) => ({ ...prev, contactMethod: event.target.value }))}
              placeholder="電話、メール、対面など"
              className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-summary">面談サマリー</Label>
            <Textarea
              id="meeting-summary"
              value={meeting.summary}
              onChange={(event) => setMeeting((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="面談の内容をまとめてください"
              rows={4}
              className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-next-actions">次回アクション</Label>
            <Textarea
              id="meeting-next-actions"
              value={meeting.nextAction}
              onChange={(event) => setMeeting((prev) => ({ ...prev, nextAction: event.target.value }))}
              placeholder="次回までに行うアクションを記載"
              rows={3}
              className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-next-action-due-on">次回アクション期日</Label>
            <Input
              id="meeting-next-action-due-on"
              type="date"
              value={meeting.nextActionDueOn}
              onChange={(event) => setMeeting((prev) => ({ ...prev, nextActionDueOn: event.target.value }))}
              className="border border-slate-300 bg-white text-slate-900"
            />
          </div>
        </div>
      <div className="border-t border-line bg-white/90 px-4 py-3 sticky bottom-0">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={submitting}
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            リセット
          </Button>
          {mode === "sheet" && (
            <Button
              type="button"
              variant="ghost"
              className="btn--ghost"
              onClick={() => onSubmitted?.()}
            >
              閉じる
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="bg-brand text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default MeetingForm

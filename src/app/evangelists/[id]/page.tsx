import { notFound } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import {
  buildEvangelistSelect,
  getEvangelistColumnSet,
  normalizeEvangelistResult,
} from '@/lib/evangelist-columns'

import SheetForm from './sheet-form'

export const dynamic = 'force-dynamic'

function formatFullName(firstName?: string | null, lastName?: string | null) {
  const parts = [lastName, firstName].filter((value) => Boolean(value && value.trim()))
  return parts.length > 0 ? parts.join(' ') : '—'
}

function formatDate(value?: string) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function parseTags(tags?: string | null): string[] {
  if (!tags) return []

  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
  } catch (error) {
    console.error('[evangelists:sheet:tags]', error)
    return []
  }
}

export default async function EvangelistSheetPage({
  params,
}: {
  params: { id: string }
}) {
  const columns = await getEvangelistColumnSet()
  const select = buildEvangelistSelect(columns, {
    includeAssignedCs: true,
  })

  const evangelist = await prisma.evangelist.findUnique({
    where: { id: params.id },
    select: {
      ...select,
      meetings: {
        select: {
          id: true,
          date: true,
          isFirst: true,
          summary: true,
          nextActions: true,
          contactMethod: true,
        },
        orderBy: { date: 'desc' },
        take: 1,
      },
      requiredIntros: {
        select: {
          id: true,
          status: true,
          note: true,
          innovator: {
            select: {
              id: true,
              company: true,
              url: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!evangelist) {
    notFound()
  }

  const normalized = normalizeEvangelistResult(evangelist)
  const latestMeeting = evangelist.meetings[0]
  const tags = parseTags((normalized as { tags?: string | null }).tags)

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">面談シート</h1>
          <p className="text-sm text-slate-500">EVAの最新情報と面談メモを記録します。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/evangelists">← 一覧へ戻る</Link>
        </Button>
      </div>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">基本情報</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">氏名</dt>
            <dd className="font-medium">{formatFullName(normalized.firstName, normalized.lastName)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">メール</dt>
            <dd className="font-medium">{normalized.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tier</dt>
            <dd className="font-medium">{normalized.tier}</dd>
          </div>
          <div>
            <dt className="text-slate-500">担当CS</dt>
            <dd className="font-medium">
              {normalized.assignedCs?.name ?? (normalized.assignedCsId ? '割り当て済み' : '未割り当て')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">強み</dt>
            <dd className="font-medium">{normalized.strength ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">希望連絡手段</dt>
            <dd className="font-medium">{normalized.contactMethod ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">フェーズ</dt>
            <dd className="font-medium">{normalized.managementPhase ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">最終更新</dt>
            <dd className="font-medium">{formatDate(normalized.updatedAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">タグ</dt>
            <dd className="flex flex-wrap gap-2 pt-1 text-xs font-medium">
              {tags.length === 0 ? (
                <span className="text-slate-500">設定なし</span>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                  >
                    {tag}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">紹介必須イノベータ</h2>
        {evangelist.requiredIntros.length === 0 ? (
          <p className="text-sm text-slate-500">現在設定されているイノベータはありません。</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {evangelist.requiredIntros.map((intro) => (
              <li key={intro.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{intro.innovator.company}</p>
                  <span className="text-xs font-semibold uppercase text-slate-500">{intro.status}</span>
                </div>
                {intro.innovator.url ? (
                  <a
                    href={intro.innovator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    {intro.innovator.url}
                  </a>
                ) : null}
                {intro.note ? <p className="mt-2 text-xs text-slate-600">備考: {intro.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SheetForm
        evangelist={{
          id: normalized.id,
          strength: normalized.strength ?? '',
          contactPref: normalized.contactMethod ?? '',
          managementPhase: normalized.managementPhase ?? '',
        }}
        latestMeeting={
          latestMeeting
            ? {
                id: latestMeeting.id,
                date: latestMeeting.date.toISOString(),
                isFirst: latestMeeting.isFirst,
                summary: latestMeeting.summary ?? '',
                nextActions: latestMeeting.nextActions ?? '',
                contactMethod: latestMeeting.contactMethod ?? '',
              }
            : null
        }
      />
    </div>
  )
}

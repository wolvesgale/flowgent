import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaSource } from '@/lib/prisma'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'

type EvangelistRow = {
  id: string
  recordId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  contactPref: string | null
  supportPriority: string | null
  pattern: string | null
  meetingStatus: string | null
  registrationStatus: string | null
  lineRegistered: boolean | null
  phoneNumber: string | null
  acquisitionSource: string | null
  facebookUrl: string | null
  listAcquired: boolean | null
  listProvided: boolean | null
  matchingListUrl: string | null
  contactOwner: string | null
  marketingContactStatus: string | null
  sourceCreatedAt: Date | null
  strengths: string | null
  notes: string | null
  nextAction: string | null
  nextActionDueOn: Date | null
  managementPhase: string | null
  tier: string | null
  assignedCsId: string | null
  tags: string[] | null
  createdAt: Date | null
  updatedAt: Date | null
}

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  })
  if (!session.isLoggedIn || session.role !== 'ADMIN') throw new Error('Unauthorized')
}

function requireToken(req: NextRequest) {
  const t = req.headers.get('x-setup-token')
  if (!t || t !== process.env.SETUP_TOKEN) throw new Error('Forbidden')
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    requireToken(req)
    if (!prismaSource) return NextResponse.json({ error: 'SOURCE_DATABASE_URL not set' }, { status: 400 })

    // User
    const users = await prismaSource.user.findMany()
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        create: { ...u },
        update: { ...u },
      })
    }

    // Innovator（name/company 吸収）
    const innovators: Array<{
      id: number | string
      createdAt: Date | string | null
      updatedAt: Date | string | null
      name: string | null
      url: string | null
      introPoint: string | null
    }> = await prismaSource!.$queryRaw`
      SELECT
        (id)::int                    AS id,
        "createdAt"                  AS "createdAt",
        "updatedAt"                  AS "updatedAt",
        COALESCE("company","name")   AS "name",
        "url",
        "introPoint"
      FROM "Innovator"
    `

    const toDate = (v: Date | string | null | undefined) =>
      v ? (v instanceof Date ? v : new Date(v)) : undefined

    for (const i of innovators) {
      const id = typeof i.id === 'number' ? i.id : Number(i.id)

      await prisma.innovator.upsert({
        where: { id },
        create: {
          id,
          name: i.name ?? '',
          url: i.url ?? null,
          introPoint: i.introPoint ?? null,
          createdAt: toDate(i.createdAt),
          updatedAt: toDate(i.updatedAt),
        },
        update: {
          name: i.name ?? '',
          url: i.url ?? null,
          introPoint: i.introPoint ?? null,
          updatedAt: new Date(),
        },
      })
    }

    // Evangelist（テーブル名が小文字 plural 想定: evangelists）
    const evs = await prismaSource.$queryRaw<EvangelistRow[]>`SELECT * FROM "evangelists"`
    for (const e of evs) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "evangelists" (id, recordId, firstName, lastName, email, contactPref, supportPriority, pattern, meetingStatus, registrationStatus, lineRegistered, phoneNumber, acquisitionSource, facebookUrl, listAcquired, listProvided, matchingListUrl, contactOwner, marketingContactStatus, sourceCreatedAt, strengths, notes, nextAction, nextActionDueOn, managementPhase, tier, assignedCsId, tags, createdAt, updatedAt)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
         ON CONFLICT (id) DO NOTHING`,
        e.id,
        e.recordId,
        e.firstName,
        e.lastName,
        e.email,
        e.contactPref,
        e.supportPriority,
        e.pattern,
        e.meetingStatus,
        e.registrationStatus,
        e.lineRegistered,
        e.phoneNumber,
        e.acquisitionSource,
        e.facebookUrl,
        e.listAcquired,
        e.listProvided,
        e.matchingListUrl,
        e.contactOwner,
        e.marketingContactStatus,
        e.sourceCreatedAt,
        e.strengths,
        e.notes,
        e.nextAction,
        e.nextActionDueOn,
        e.managementPhase,
        e.tier,
        e.assignedCsId,
        e.tags,
        e.createdAt,
        e.updatedAt
      )
    }

    return NextResponse.json({ ok: true, users: users.length, innovators: innovators.length, evangelists: evs.length })
  } catch (error: unknown) {
    console.error('[ops:salvage]', error)
    const message = error instanceof Error ? error.message : 'error'
    const code = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: message }, { status: code })
  }
}

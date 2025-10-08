import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { SessionData } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSessionUserOrThrow() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  });

  if (!session.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized');
  }

  return session;
}

function requireRole(user: SessionData, roles: string[]) {
  if (!roles.includes(user.role || '')) {
    throw new Error('Forbidden');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    requireRole(user, ["ADMIN", "CS"]);

    const { rows } = await req.json(); // すでにクライアントでマッピング済み [{recordId, firstName,...}]
    if (!Array.isArray(rows)) return NextResponse.json({ error: "invalid" }, { status: 400 });

    interface ImportRow {
      recordId?: string
      firstName?: string
      lastName?: string
      email?: string
      contactPref?: string
      supportPriority?: string
      pattern?: string
      meetingStatus?: string
      registrationStatus?: string
      lineRegistered?: string
      phoneNumber?: string
      acquisitionSource?: string
      facebookUrl?: string
      listAcquired?: string
      matchingListUrl?: string
      contactOwner?: string
      marketingContactStatus?: string
      sourceCreatedAt?: string
      strengths?: string
      notes?: string
      tier?: string
      tags?: string[] | string
    }

    const parseSourceCreatedAt = (value?: string | null) => {
      if (!value) return null;
      const normalized = value.replace(/\//g, '-').replace(' ', 'T');
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return date;
    };

    const buildCreateData = (r: ImportRow) => ({
      recordId: r.recordId || null,
      firstName: r.firstName || null,
      lastName: r.lastName || null,
      email: r.email || null,
      contactPref: r.contactPref || null,
      supportPriority: r.supportPriority || null,
      pattern: r.pattern || null,
      meetingStatus: r.meetingStatus || null,
      registrationStatus: r.registrationStatus || null,
      lineRegistered: r.lineRegistered || null,
      phoneNumber: r.phoneNumber || null,
      acquisitionSource: r.acquisitionSource || null,
      facebookUrl: r.facebookUrl || null,
      listAcquired: r.listAcquired || null,
      matchingListUrl: r.matchingListUrl || null,
      contactOwner: r.contactOwner || null,
      marketingContactStatus: r.marketingContactStatus || null,
      sourceCreatedAt: parseSourceCreatedAt(r.sourceCreatedAt) || null,
      strengths: r.strengths || null,
      notes: r.notes || null,
      tier: (r.tier as 'TIER1' | 'TIER2') || "TIER2",
      tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags ? JSON.stringify([r.tags]) : null),
      assignedCsId: user.role === 'CS' ? user.userId : null,
    });

    const buildUpdateData = (r: ImportRow) => ({
      recordId: r.recordId || undefined,
      firstName: r.firstName || undefined,
      lastName: r.lastName || undefined,
      contactPref: r.contactPref || undefined,
      supportPriority: r.supportPriority || undefined,
      pattern: r.pattern || undefined,
      meetingStatus: r.meetingStatus || undefined,
      registrationStatus: r.registrationStatus || undefined,
      lineRegistered: r.lineRegistered || undefined,
      phoneNumber: r.phoneNumber || undefined,
      acquisitionSource: r.acquisitionSource || undefined,
      facebookUrl: r.facebookUrl || undefined,
      listAcquired: r.listAcquired || undefined,
      matchingListUrl: r.matchingListUrl || undefined,
      contactOwner: r.contactOwner || undefined,
      marketingContactStatus: r.marketingContactStatus || undefined,
      sourceCreatedAt: parseSourceCreatedAt(r.sourceCreatedAt) || undefined,
      strengths: r.strengths || undefined,
      notes: r.notes || undefined,
      tier: (r.tier as 'TIER1' | 'TIER2') || undefined,
      tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags ? JSON.stringify([r.tags]) : undefined),
    });

    const operations = rows.reduce((acc, row: ImportRow) => {
      const createData = buildCreateData(row);
      const updateData = buildUpdateData(row);

      if (row.recordId) {
        acc.push(
          prisma.evangelist.upsert({
            where: { recordId: row.recordId },
            create: createData,
            update: updateData,
          })
        );
        return acc;
      }

      if (row.email) {
        acc.push(
          prisma.evangelist.upsert({
            where: { email: row.email },
            create: createData,
            update: updateData,
          })
        );
        return acc;
      }

      acc.push(prisma.evangelist.create({ data: createData }));
      return acc;
    }, [] as Promise<unknown>[]);

    await prisma.$transaction(operations);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (error) {
    console.error('CSV import error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
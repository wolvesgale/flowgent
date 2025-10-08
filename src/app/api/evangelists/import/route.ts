// src/app/api/evangelists/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions } from '@/lib/session-config';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { SessionData } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSessionUserOrThrow(): Promise<SessionData> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
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

// クライアント側 CSV マッピング後の行型（main 仕様）
type ImportRow = {
  // 識別系
  recordId?: string;
  email?: string;

  // プロフィール/状態系
  firstName?: string;
  lastName?: string;
  contactMethod?: string;
  supportPriority?: string;
  pattern?: string;
  meetingStatus?: string;
  registrationStatus?: string;
  lineRegistered?: string;
  phoneNumber?: string;
  acquisitionSource?: string;
  facebookUrl?: string;
  listAcquired?: string;
  matchingListUrl?: string;
  contactOwner?: string;
  marketingContactStatus?: string;
  sourceCreatedAt?: string; // CSVは文字列で来る想定
  strength?: string;
  notes?: string;
  tier?: string;            // "TIER1" | "TIER2" 以外は無視
  tags?: string[] | string; // UIで配列/文字列どちらでも
};

function parseSourceCreatedAt(value?: string | null): Date | null {
  if (!value) return null;
  // 例: "2025/10/06 12:34" → "2025-10-06T12:34"
  const normalized = value.replace(/\//g, '-').replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTier(input?: string | null): 'TIER1' | 'TIER2' | null {
  if (!input) return null;
  const up = String(input).toUpperCase();
  return up === 'TIER1' || up === 'TIER2' ? up : null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    requireRole(user, ['ADMIN', 'CS']);

    const body = await req.json();
    const rows: unknown = (body ?? {}).rows;
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const records = rows as ImportRow[];
    let processedCount = 0;
    let skippedCount = 0;
    let duplicateConflicts = 0;

    const buildCreateData = (r: ImportRow) => ({
      recordId: r.recordId || null,
      firstName: r.firstName || null,
      lastName: r.lastName || null,
      email: r.email || null,
      contactMethod: r.contactMethod || null,
      supportPriority: r.supportPriority || null,
      pattern: r.pattern || null,
      meetingStatus: r.meetingStatus || null,
      registrationStatus: r.registrationStatus || null,
      lineRegistered: r.lineRegistered || null,
      phoneNumber: r.phoneNumber || null,
      acquisitionSource: r.acquisitionSource || null,
      facebookUrl: r.facebookUrl || null,
      listAcquired: r.listAcquired || null,
      listProvided: false,
      matchingListUrl: r.matchingListUrl || null,
      contactOwner: r.contactOwner || null,
      marketingContactStatus: r.marketingContactStatus || null,
      sourceCreatedAt: parseSourceCreatedAt(r.sourceCreatedAt) || null,
      strength: r.strength || null,
      notes: r.notes || null,
      tier: normalizeTier(r.tier) ?? 'TIER2',
      tags: Array.isArray(r.tags)
        ? JSON.stringify(r.tags)
        : r.tags
          ? JSON.stringify([r.tags])
          : null,
      // CS であれば自動割当、Admin は空で作る
      assignedCsId: user.role === 'CS' ? user.userId : null,
    });

    const buildUpdateData = (r: ImportRow) => ({
      recordId: r.recordId || undefined,
      firstName: r.firstName || undefined,
      lastName: r.lastName || undefined,
      email: r.email || undefined,
      contactMethod: r.contactMethod || undefined,
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
      strength: r.strength || undefined,
      notes: r.notes || undefined,
      tier: normalizeTier(r.tier) || undefined,
      tags: Array.isArray(r.tags)
        ? JSON.stringify(r.tags)
        : r.tags
          ? JSON.stringify([r.tags])
          : undefined,
      // 既存の assignedCsId は基本触らない（暗黙更新を避ける）
    });

    for (const r of records) {
      const firstName = r.firstName?.trim() ?? '';
      const lastName = r.lastName?.trim() ?? '';

      if (!firstName || !lastName) {
        skippedCount += 1;
        continue;
      }

      const normalizedRow: ImportRow = { ...r, firstName, lastName };
      const createData = buildCreateData(normalizedRow);
      const updateData = buildUpdateData(normalizedRow);

      try {
        if (r.recordId) {
          await prisma.evangelist.upsert({
            where: { recordId: r.recordId },
            create: createData,
            update: updateData,
          });
          processedCount += 1;
          continue;
        }

        if (r.email) {
          await prisma.evangelist.upsert({
            where: { email: r.email },
            create: createData,
            update: updateData,
          });
          processedCount += 1;
          continue;
        }

        // recordId / email が無い行は新規作成（重複は運用で回避）
        await prisma.evangelist.create({ data: createData });
        processedCount += 1;
      } catch (dbError) {
        if (
          dbError instanceof PrismaClientKnownRequestError &&
          dbError.code === 'P2002'
        ) {
          duplicateConflicts += 1;
          continue;
        }

        throw dbError;
      }
    }

    return NextResponse.json({
      ok: true,
      count: processedCount,
      skippedCount: skippedCount + duplicateConflicts,
      duplicateCount: duplicateConflicts,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2021') {
        return NextResponse.json(
          {
            error: 'Database table is missing. Please run prisma migrate deploy on the configured database.',
            code: 'MISSING_TABLE',
          },
          { status: 500 },
        );
      }

      if (error.code === 'P1001') {
        return NextResponse.json(
          { error: 'Database connection failed. Verify DATABASE_URL configuration.', code: 'DB_UNAVAILABLE' },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

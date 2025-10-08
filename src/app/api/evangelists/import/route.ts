// src/app/api/evangelists/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { PrismaPromise } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { SessionData } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSessionUserOrThrow(): Promise<SessionData> {
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

// クライアント側 CSV マッピング後の行型
type ImportRow = {
  recordId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  meetingStatus?: string;
};

type SanitizedRow = {
  recordId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  meetingStatus: string | null;
};

function normalizeString(value?: unknown): string | null {
  if (value === null || value === undefined) return null;
  const asString = typeof value === 'string' ? value : String(value);
  const trimmed = asString.trim();
  return trimmed.length > 0 ? trimmed : null;
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

    const prelimRows = (rows as ImportRow[]).map((row, index) => ({
      index,
      recordId: normalizeString(row.recordId),
      firstName: normalizeString(row.firstName),
      lastName: normalizeString(row.lastName),
      email: normalizeString(row.email),
      meetingStatus: normalizeString(row.meetingStatus),
    }));

    const invalidRows = prelimRows
      .filter((row) => !row.firstName || !row.lastName)
      .map((row) => row.index + 1);

    if (invalidRows.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', rows: invalidRows },
        { status: 400 },
      );
    }

    const sanitizedRows: SanitizedRow[] = prelimRows.map((row) => ({
      recordId: row.recordId,
      firstName: row.firstName!,
      lastName: row.lastName!,
      email: row.email,
      meetingStatus: row.meetingStatus,
    }));

    if (sanitizedRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows provided' }, { status: 400 });
    }

    const buildCreateData = (r: SanitizedRow) => ({
      recordId: r.recordId ?? null,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? null,
      meetingStatus: r.meetingStatus ?? null,
      assignedCsId: null,
    });

    const buildUpdateData = (r: SanitizedRow) => ({
      recordId: r.recordId ?? undefined,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? undefined,
      meetingStatus: r.meetingStatus ?? undefined,
    });

    const operations: PrismaPromise<unknown>[] = sanitizedRows.map((row) => {
      const createData = buildCreateData(row);
      const updateData = buildUpdateData(row);

      if (row.recordId) {
        return prisma.evangelist.upsert({
          where: { recordId: row.recordId },
          create: createData,
          update: updateData,
        });
      }

      if (row.email) {
        return prisma.evangelist.upsert({
          where: { email: row.email },
          create: createData,
          update: updateData,
        });
      }

      return prisma.evangelist.create({ data: createData });
    });

    await prisma.$transaction(operations);
    return NextResponse.json({ ok: true, count: operations.length });
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

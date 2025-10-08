// src/app/api/evangelists/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// クライアント側 CSV マッピング後の行型
type ImportRow = {
  __lineNumber?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type SanitizedRow = {
  lineNumber: number;
  firstName: string;
  lastName: string;
  email: string | null;
};

function normalizeString(value?: unknown): string | null {
  if (value === null || value === undefined) return null;
  const asString = typeof value === 'string' ? value : String(value);
  const trimmed = asString.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value?: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const rows: unknown = (body ?? {}).rows;
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const prelimRows = (rows as ImportRow[]).map((row, index) => ({
      lineNumber:
        typeof row.__lineNumber === 'number' && Number.isFinite(row.__lineNumber)
          ? Math.max(1, Math.floor(row.__lineNumber))
          : index + 1,
      firstName: normalizeString(row.firstName),
      lastName: normalizeString(row.lastName),
      email: normalizeEmail(row.email),
    }));

    const sanitizedRows: SanitizedRow[] = [];
    const skippedRowNumbers: number[] = [];

    prelimRows.forEach((row) => {
      if (!row.firstName || !row.lastName) {
        skippedRowNumbers.push(row.lineNumber);
        return;
      }

      sanitizedRows.push({
        lineNumber: row.lineNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
      });
    });

    if (sanitizedRows.length === 0) {
      return NextResponse.json({ ok: true, count: 0, skippedRowNumbers }, { status: 200 });
    }

    const failedRowNumbers: number[] = [];
    let successCount = 0;

    for (const row of sanitizedRows) {
      try {
        if (row.email) {
          await prisma.evangelist.upsert({
            where: { email: row.email },
            update: {
              firstName: row.firstName,
              lastName: row.lastName,
            },
            create: {
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              assignedCsId: null,
            },
          });
        } else {
          await prisma.evangelist.create({
            data: {
              firstName: row.firstName,
              lastName: row.lastName,
              assignedCsId: null,
            },
          });
        }

        successCount += 1;
      } catch (err) {
        console.error('CSV row import error:', {
          lineNumber: row.lineNumber,
          error: err instanceof Error ? err.message : String(err),
        });
        failedRowNumbers.push(row.lineNumber);
      }
    }

    return NextResponse.json({ ok: true, count: successCount, skippedRowNumbers, failedRowNumbers });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

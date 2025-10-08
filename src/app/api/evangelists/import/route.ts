// src/app/api/evangelists/import/route.ts
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// クライアント側 CSV マッピング後の行型
type ImportRow = {
  __lineNumber?: number;
  recordId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  supportPriority?: string;
  meetingStatus?: string;
};

type SanitizedRow = {
  lineNumber: number;
  recordId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  supportPriority: string | null;
  meetingStatus: string | null;
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
    const session = await getSession();

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
      recordId: normalizeString(row.recordId),
      firstName: normalizeString(row.firstName),
      lastName: normalizeString(row.lastName),
      email: normalizeEmail(row.email),
      supportPriority: normalizeString(row.supportPriority),
      meetingStatus: normalizeString(row.meetingStatus),
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
        recordId: row.recordId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        supportPriority: row.supportPriority,
        meetingStatus: row.meetingStatus,
      });
    });

    if (sanitizedRows.length === 0) {
      return NextResponse.json({ ok: true, count: 0, skippedRowNumbers }, { status: 200 });
    }

    const buildCreateData = (r: SanitizedRow) => ({
      recordId: r.recordId ?? null,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? null,
      supportPriority: r.supportPriority ?? null,
      meetingStatus: r.meetingStatus ?? null,
      assignedCsId: null,
    });

    const buildUpdateData = (r: SanitizedRow) => ({
      recordId: r.recordId ?? undefined,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? undefined,
      supportPriority: r.supportPriority ?? undefined,
      meetingStatus: r.meetingStatus ?? undefined,
    });

    const failedRowNumbers: number[] = [];
    let successCount = 0;

    for (const row of sanitizedRows) {
      try {
        const createData = buildCreateData(row);
        const updateData = buildUpdateData(row);

        try {
          if (row.recordId) {
            await prisma.evangelist.upsert({
              where: { recordId: row.recordId },
              create: { ...createData, recordId: row.recordId },
              update: updateData,
            });
            successCount += 1;
            continue;
          }

          if (row.email) {
            await prisma.evangelist.upsert({
              where: { email: row.email },
              create: { ...createData, email: row.email },
              update: { ...updateData, recordId: row.recordId ?? undefined },
            });
            successCount += 1;
            continue;
          }

          await prisma.evangelist.create({ data: createData });
          successCount += 1;
        } catch (innerErr) {
          const isUniqueError =
            innerErr instanceof Prisma.PrismaClientKnownRequestError && innerErr.code === 'P2002';

          if (isUniqueError && row.email) {
            try {
              await prisma.evangelist.upsert({
                where: { email: row.email },
                create: { ...createData, email: row.email },
                update: { ...updateData, recordId: row.recordId ?? undefined },
              });
              successCount += 1;
              continue;
            } catch (retryErr) {
              console.error('CSV row retry error:', {
                lineNumber: row.lineNumber,
                error: retryErr instanceof Error ? retryErr.message : String(retryErr),
              });
              failedRowNumbers.push(row.lineNumber);
              continue;
            }
          }

          throw innerErr;
        }
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

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth';

export const runtime = 'nodejs';

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return 'id,email,lastName,firstName,assignedCsId,assignedCsName,tier\n';
  }

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: unknown) => {
    if (value == null) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const body = rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','));

  return [headers.join(','), ...body].join('\n') + '\n';
}

export async function GET(req: NextRequest) {
  const authRes = await requireAdminForApi(req);
  if (authRes) return authRes;

  try {

    const evangelists = await prisma.evangelist.findMany({
      select: {
        id: true,
        email: true,
        lastName: true,
        firstName: true,
        assignedCsId: true,
        tier: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const assignedIds = Array.from(
      new Set(evangelists.map((ev) => ev.assignedCsId).filter((value): value is string => Boolean(value))),
    );

    const users = assignedIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, name: true },
        })
      : [];

    const nameById = new Map(users.map((user) => [user.id, user.name]));

    const rows = evangelists.map((ev) => ({
      id: ev.id,
      email: ev.email ?? '',
      lastName: ev.lastName ?? '',
      firstName: ev.firstName ?? '',
      assignedCsId: ev.assignedCsId ?? '',
      assignedCsName: ev.assignedCsId ? nameById.get(ev.assignedCsId) ?? '' : '',
      tier: ev.tier ?? '',
    }));

    const csv = toCsv(rows);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `evangelists-backup-${timestamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

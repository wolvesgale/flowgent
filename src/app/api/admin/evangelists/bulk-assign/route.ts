import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth';

export const runtime = 'nodejs';

type Row = {
  assignedCsName?: string;
  tier?: string | number;
  lastName?: string;
  firstName?: string;
  email?: string;
};

function normalizeHeader(row: Record<string, unknown>): Row {
  if ('assignedCsName' in row || 'email' in row) {
    return row as Row;
  }

  return {
    assignedCsName:
      (row['担当'] as string | undefined) ??
      (row['cs'] as string | undefined) ??
      (row['CS'] as string | undefined) ??
      (row['担当者'] as string | undefined),
    tier: (row['Tier'] as string | undefined) ?? (row['tier'] as string | undefined),
    lastName:
      (row['姓'] as string | undefined) ??
      (row['苗字'] as string | undefined) ??
      (row['lastName'] as string | undefined),
    firstName:
      (row['名'] as string | undefined) ??
      (row['firstName'] as string | undefined) ??
      (row['名前'] as string | undefined),
    email:
      (row['Eメール'] as string | undefined) ??
      (row['メール'] as string | undefined) ??
      (row['email'] as string | undefined) ??
      (row['メールアドレス'] as string | undefined),
  };
}

function getBool(value: string | null, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off', ''].includes(normalized)) return false;
  return fallback;
}

function normalizeTier(input?: string | number | null) {
  if (input == null) return null;
  const value = String(input).trim().toUpperCase();
  if (value === '1' || value === 'TIER1') return 'TIER1';
  if (value === '2' || value === 'TIER2') return 'TIER2';
  return null;
}

function cleanName(value?: string | null) {
  if (!value) return '';
  return value.replace(/[\s\u3000]+/g, '').replace(/[()（）]/g, '').trim();
}

function parseCsv(text: string): Row[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || 'CSV parsing error');
  }

  return parsed.data.map((row) => normalizeHeader(row));
}

async function readBodyAsRows(req: NextRequest): Promise<Row[]> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      throw new Error('CSVファイル（file）が必要です。');
    }
    const text = await (file as File).text();
    return parseCsv(text);
  }

  if (contentType.includes('text/csv')) {
    const text = await req.text();
    return parseCsv(text);
  }

  const json = await req.json();
  if (!Array.isArray(json)) {
    throw new Error('配列(JSON)を送ってください。');
  }

  return json.map((row) => normalizeHeader(row as Record<string, unknown>));
}

const CS_ALIAS: Record<string, string> = {
  徳永: '徳永渉',
  中崎: '中崎功大',
  遠藤: '遠藤亜沙子',
  今岡: 'Misaki Imaoka',
  飯田: '飯田省吾',
};

export async function POST(req: NextRequest) {
  const authRes = await requireAdminForApi(req);
  if (authRes) return authRes;

  try {
    const dryRun = getBool(req.nextUrl.searchParams.get('dryRun'), false);
    const mode = dryRun ? 'DRY_RUN' : 'EXECUTE';
    const rows = await readBodyAsRows(req);

    const users = await prisma.user.findMany({
      where: { role: { in: ['CS', 'ADMIN'] } },
      select: { id: true, name: true, role: true },
    });

    const userByNormalizedName = new Map<string, { id: string; name: string; role: string }>();
    users.forEach((user) => {
      userByNormalizedName.set(cleanName(user.name), user);
    });

    const aliasToId = new Map<string, string>();
    for (const [alias, displayName] of Object.entries(CS_ALIAS)) {
      const resolved = userByNormalizedName.get(cleanName(displayName));
      if (resolved) {
        aliasToId.set(cleanName(alias), resolved.id);
      }
    }

    const summary = {
      mode,
      received: rows.length,
      matched: 0,
      updated: 0,
      skipped: 0,
      wouldChangeAssignedCs: 0,
      wouldChangeTier: 0,
      notFound: [] as Array<{ key: string; reason: string }>,
      csNotFound: [] as Array<{ name: string }>,
      invalidTier: [] as Array<{ value: string }>,
      multiMatched: [] as Array<{ key: string; count: number }>,
      details: [] as Array<{
        key: string;
        changed: Partial<{ assignedCsId: string; tier: string }>;
        dryRun: boolean;
      }>,
      whySkipped: [] as Array<{
        key: string;
        reason: string;
        current?: { assignedCsId: string | null; tier: string | null };
        incoming?: { assignedCsName: string | null; resolvedCsId: string | null; tier: string | null };
      }>,
    };

    for (const rawRow of rows) {
      const row: Row = {
        assignedCsName: rawRow.assignedCsName ?? '',
        tier: rawRow.tier,
        lastName: rawRow.lastName ?? '',
        firstName: rawRow.firstName ?? '',
        email: rawRow.email ?? '',
      };

      const email = row.email?.trim() ?? '';
      const lastName = row.lastName?.trim() ?? '';
      const firstName = row.firstName?.trim() ?? '';

      let evangelist: { id: string; assignedCsId: string | null; tier: string | null } | null = null;

      if (email) {
        evangelist = await prisma.evangelist.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, assignedCsId: true, tier: true },
        });

        if (!evangelist) {
          summary.notFound.push({ key: `email:${email}`, reason: 'Evangelist not found' });
          summary.skipped++;
          continue;
        }
      } else {
        if (!lastName || !firstName) {
          summary.notFound.push({ key: `name:${lastName}${firstName}`, reason: 'emailが空・氏名不足' });
          summary.skipped++;
          continue;
        }

        const candidates = await prisma.evangelist.findMany({
          where: { lastName, firstName },
          select: { id: true, assignedCsId: true, tier: true },
        });

        if (candidates.length === 0) {
          summary.notFound.push({ key: `name:${lastName}${firstName}`, reason: 'Evangelist not found' });
          summary.skipped++;
          continue;
        }

        if (candidates.length > 1) {
          summary.multiMatched.push({ key: `name:${lastName}${firstName}`, count: candidates.length });
          summary.skipped++;
          continue;
        }

        evangelist = candidates[0];
      }

      summary.matched++;

      let resolvedAssignedCsId: string | undefined;
      if (row.assignedCsName) {
        const normalized = cleanName(row.assignedCsName);
        resolvedAssignedCsId = aliasToId.get(normalized);
        if (!resolvedAssignedCsId) {
          const direct = userByNormalizedName.get(normalized);
          if (direct) {
            resolvedAssignedCsId = direct.id;
          }
        }

        if (!resolvedAssignedCsId) {
          summary.csNotFound.push({ name: row.assignedCsName });
        }
      }

      const tierValue = row.tier;
      const hasTierValue = tierValue != null && String(tierValue).trim() !== '';
      const normalizedTier = hasTierValue ? normalizeTier(tierValue) : null;
      if (hasTierValue && !normalizedTier) {
        summary.invalidTier.push({ value: String(tierValue) });
      }

      const changed: Record<string, string> = {};

      if (resolvedAssignedCsId && resolvedAssignedCsId !== evangelist!.assignedCsId) {
        changed.assignedCsId = resolvedAssignedCsId;
        summary.wouldChangeAssignedCs++;
      }

      if (normalizedTier && normalizedTier !== evangelist!.tier) {
        changed.tier = normalizedTier;
        summary.wouldChangeTier++;
      }

      if (Object.keys(changed).length === 0) {
        summary.skipped++;
        summary.whySkipped.push({
          key: email ? `email:${email}` : `name:${lastName}${firstName}`,
          reason:
            (!resolvedAssignedCsId && row.assignedCsName)
              ? 'CS解決不可（assignedCsName未解決）'
              : normalizedTier == null && hasTierValue
                ? 'Tier不正値'
                : '差分なし（現状と同じ）',
          current: { assignedCsId: evangelist!.assignedCsId, tier: evangelist!.tier },
          incoming: {
            assignedCsName: row.assignedCsName || null,
            resolvedCsId: resolvedAssignedCsId || null,
            tier: normalizedTier,
          },
        });
        continue;
      }

      summary.details.push({
        key: email ? `email:${email}` : `name:${lastName}${firstName}`,
        changed,
        dryRun,
      });

      if (!dryRun) {
        await prisma.evangelist.update({
          where: email ? { email } : { id: evangelist!.id },
          data: changed,
          select: { id: true },
        });
        summary.updated++;
      }
    }

    return NextResponse.json({
      ...summary,
      summary: {
        toUpdate: summary.details.length,
        notFound: summary.notFound.length,
        csNotFound: summary.csNotFound.length,
        invalidTier: summary.invalidTier.length,
        multiMatched: summary.multiMatched.length,
        wouldChangeAssignedCs: summary.wouldChangeAssignedCs,
        wouldChangeTier: summary.wouldChangeTier,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

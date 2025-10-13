import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { SessionData } from '@/lib/session';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSessionUserOrThrow(): Promise<SessionData> {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: 'flowgent-session',
  });
  if (!session.isLoggedIn || !session.userId) throw new Error('Unauthorized');
  return session;
}
function requireRole(user: SessionData, roles: string[]) {
  if (!roles.includes(user.role || '')) throw new Error('Forbidden');
}

/** 情報スキーマから実在カラムを取得（大小文字違いも考慮） */
async function getInnovatorColumns(): Promise<Set<string>> {
  // PrismaがPostgresに "Innovator" のようにQuotedで作るケースと、"innovators" のケースを両方ケア
  const rows: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('Innovator','innovators')
    `
  );
  return new Set(rows.map(r => r.column_name));
}

const ALLOWED_DOMAIN = new Set([
  'HR','IT','ACCOUNTING','ADVERTISING','MANAGEMENT','SALES','MANUFACTURING','MEDICAL','FINANCE'
]);

type CreateBody = {
  company?: string;       // UI側は company を送ってOK（DB側が name でも吸収）
  name?: string;          // name を直接送ってもOK
  url?: string;
  introductionPoint?: string;
  domain?: string;
};

/** 入力を実在カラムにマッピング */
type DataField = 'name' | 'company' | 'url' | 'introductionPoint' | 'domain';

function mapToData(input: CreateBody, cols: Set<string>) {
  const data: Partial<Record<DataField, string>> = {};

  // name/company の相互マッピング（DBにある方へ入れる）
  const nameCandidate = (input.name ?? input.company ?? '').trim();
  if (nameCandidate) {
    if (cols.has('name')) data.name = nameCandidate;
    else if (cols.has('company')) data.company = nameCandidate;
  }

  if (input.url && cols.has('url')) data.url = String(input.url).trim();
  if (input.introductionPoint && cols.has('introductionPoint')) {
    data.introductionPoint = String(input.introductionPoint).trim();
  }
  if (input.domain && cols.has('domain')) {
    const up = String(input.domain).toUpperCase();
    if (ALLOWED_DOMAIN.has(up)) data.domain = up;
  }
  return data;
}

/** select句は存在カラムのみ */
function selectFor(cols: Set<string>) {
  return {
    ...(cols.has('id') ? { id: true } : {}),
    ...(cols.has('createdAt') ? { createdAt: true } : {}),
    ...(cols.has('updatedAt') ? { updatedAt: true } : {}),
    ...(cols.has('name') ? { name: true } : {}),
    ...(cols.has('company') ? { company: true } : {}),
    ...(cols.has('url') ? { url: true } : {}),
    ...(cols.has('introductionPoint') ? { introductionPoint: true } : {}),
    ...(cols.has('domain') ? { domain: true } : {}),
  } satisfies Record<string, true>;
}

/** GET /api/admin/innovators?page=&limit=&search=&domain= */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    requireRole(user, ['ADMIN', 'CS']);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? '10')));
    const search = (url.searchParams.get('search') ?? '').trim();
    const domain = (url.searchParams.get('domain') ?? '').trim().toUpperCase();

    const cols = await getInnovatorColumns();

    const where: Record<string, unknown> = {};
    if (search) {
      const or: Record<string, unknown>[] = [];
      if (cols.has('name')) or.push({ name: { contains: search } });
      if (cols.has('company')) or.push({ company: { contains: search } });
      if (cols.has('url')) or.push({ url: { contains: search } });
      if (cols.has('introductionPoint')) or.push({ introductionPoint: { contains: search } });
      if (or.length) where.OR = or;
    }
    if (domain && cols.has('domain') && ALLOWED_DOMAIN.has(domain)) {
      where.domain = domain;
    }

    const whereInput = where as unknown as Prisma.InnovatorWhereInput;
    const select = selectFor(cols) as unknown as Prisma.InnovatorSelect;

    const [total, items] = await Promise.all([
      prisma.innovator.count({ where: whereInput }),
      prisma.innovator.findMany({
        where: whereInput,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select,
      }),
    ]);

    return NextResponse.json({ total, items, page, limit });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : undefined;
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[innovators:list]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/admin/innovators  { company|name, url?, introductionPoint?, domain? } */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    requireRole(user, ['ADMIN', 'CS']);

    const body = (await req.json()) as CreateBody;
    const cols = await getInnovatorColumns();
    const data = mapToData(body, cols);

    // 非NULL制約の name/company を満たす（どちらかがDBに存在して値が入っている）
    const hasNameValue =
      (cols.has('name') && typeof data.name === 'string' && data.name.trim() !== '') ||
      (cols.has('company') && typeof data.company === 'string' && data.company.trim() !== '');
    if (!hasNameValue) {
      return NextResponse.json({ error: 'name/company is required' }, { status: 400 });
    }

    const created = await prisma.innovator.create({
      data: data as unknown as Prisma.InnovatorCreateInput,
      select: selectFor(cols) as unknown as Prisma.InnovatorSelect,
    });

    return NextResponse.json(created, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : undefined;
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[innovators:create]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

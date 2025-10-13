import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { SessionData } from '@/lib/session';
import { mapBusinessDomain } from '@/lib/business-domain';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT_FIELDS = {
  id: true,
  company: true,
  url: true,
  introductionPoint: true,
  domain: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InnovatorSelect;

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

function buildWhere({
  search,
  domain,
}: {
  search: string;
  domain: Prisma.InnovatorWhereInput['domain'];
}): Prisma.InnovatorWhereInput {
  const where: Prisma.InnovatorWhereInput = {};

  if (search) {
    where.OR = [
      { company: { contains: search, mode: 'insensitive' } },
      { url: { contains: search, mode: 'insensitive' } },
      { introductionPoint: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (domain) {
    where.domain = domain;
  }

  return where;
}

function parseDomain(input: string | null): Prisma.InnovatorWhereInput['domain'] {
  const mapped = mapBusinessDomain(input);
  return mapped ? mapped : undefined;
}

type CreateBody = {
  company?: string;
  name?: string;
  url?: string;
  introductionPoint?: string;
  domain?: string;
};

function buildCreateData(body: CreateBody): Prisma.InnovatorCreateInput {
  const company = (body.company ?? body.name ?? '').trim();
  if (!company) {
    throw new Error('company is required');
  }

  const createInput: Prisma.InnovatorCreateInput = {
    company,
  };

  if (typeof body.url === 'string' && body.url.trim()) {
    createInput.url = body.url.trim();
  }

  if (typeof body.introductionPoint === 'string' && body.introductionPoint.trim()) {
    createInput.introductionPoint = body.introductionPoint.trim();
  }

  const mappedDomain = mapBusinessDomain(body.domain);
  if (mappedDomain) {
    createInput.domain = mappedDomain;
  }

  return createInput;
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
    const domainParam = url.searchParams.get('domain');
    const domain = parseDomain(domainParam);

    const where = buildWhere({ search, domain });

    const [total, innovators] = await Promise.all([
      prisma.innovator.count({ where }),
      prisma.innovator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: SELECT_FIELDS,
      }),
    ]);

    return NextResponse.json({ total, innovators, page, limit });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : undefined;
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
    let data: Prisma.InnovatorCreateInput;

    try {
      data = buildCreateData(body);
    } catch (validationError) {
      if (validationError instanceof Error && validationError.message === 'company is required') {
        return NextResponse.json({ error: 'company is required' }, { status: 400 });
      }
      throw validationError;
    }

    const created = await prisma.innovator.create({
      data,
      select: SELECT_FIELDS,
    });

    return NextResponse.json(created, { status: 200 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : undefined;
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[innovators:create]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

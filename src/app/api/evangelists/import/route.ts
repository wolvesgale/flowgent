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

    const { rows } = await req.json(); // すでにクライアントでマッピング済み
    if (!Array.isArray(rows)) return NextResponse.json({ error: "invalid" }, { status: 400 });

    interface ImportRow {
      firstName?: string
      lastName?: string
      email?: string
      strength?: string
      contactPreference?: string
      phase?: string
    }

    const VALID_STRENGTHS = [
      'HR',
      'IT',
      'ACCOUNTING',
      'ADVERTISING',
      'MANAGEMENT',
      'SALES',
      'MANUFACTURING',
      'MEDICAL',
      'FINANCE',
    ] as const;

    const VALID_CONTACTS = ['FACEBOOK', 'LINE', 'EMAIL', 'PHONE', 'SLACK'] as const;

    const VALID_PHASES = [
      'FIRST_CONTACT',
      'REGISTERED',
      'LIST_SHARED',
      'CANDIDATE_SELECTION',
      'INNOVATOR_REVIEW',
      'INTRODUCING',
      'FOLLOW_UP',
    ] as const;

    const validStrengths = new Set<typeof VALID_STRENGTHS[number]>(VALID_STRENGTHS);
    const validContacts = new Set<typeof VALID_CONTACTS[number]>(VALID_CONTACTS);
    const validPhases = new Set<typeof VALID_PHASES[number]>(VALID_PHASES);

    const sanitizeStrength = (value?: string | null): typeof VALID_STRENGTHS[number] | null => {
      if (!value) return null;
      const upper = value.trim().toUpperCase() as typeof VALID_STRENGTHS[number];
      return validStrengths.has(upper) ? upper : null;
    };

    const sanitizeContact = (value?: string | null): typeof VALID_CONTACTS[number] | null => {
      if (!value) return null;
      const upper = value.trim().toUpperCase() as typeof VALID_CONTACTS[number];
      return validContacts.has(upper) ? upper : null;
    };

    const sanitizePhase = (value?: string | null): typeof VALID_PHASES[number] | undefined => {
      if (!value) return undefined;
      const upper = value.trim().toUpperCase() as typeof VALID_PHASES[number];
      return validPhases.has(upper) ? upper : undefined;
    };

    const buildCreateData = (r: ImportRow) => ({
      firstName: r.firstName || null,
      lastName: r.lastName || null,
      email: r.email || null,
      strength: sanitizeStrength(r.strength),
      contactPreference: sanitizeContact(r.contactPreference),
      phase: sanitizePhase(r.phase),
      assignedCsId: null,
    });

    const buildUpdateData = (r: ImportRow) => ({
      firstName: r.firstName || undefined,
      lastName: r.lastName || undefined,
      strength: sanitizeStrength(r.strength) || undefined,
      contactPreference: sanitizeContact(r.contactPreference) || undefined,
      phase: sanitizePhase(r.phase),
    });

    const operations = rows.reduce((acc, row: ImportRow) => {
      const createData = buildCreateData(row);
      const updateData = buildUpdateData(row);

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
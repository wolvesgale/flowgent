import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { SessionData } from '@/lib/session';

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

    const ops = rows.map((r: any) =>
      prisma.evangelist.upsert({
        where: { email: r.email ?? "__no_email__" }, // email優先
        create: {
          recordId: r.recordId || null,
          firstName: r.firstName || null,
          lastName: r.lastName || null,
          email: r.email || null,
          contactPref: r.contactPref || null,
          strengths: r.strengths || null,
          notes: r.notes || null,
          tier: r.tier || "TIER2",
          tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags ? JSON.stringify([r.tags]) : null),
          assignedCsId: user.role === 'CS' ? user.userId : null,
        },
        update: {
          recordId: r.recordId || undefined,
          firstName: r.firstName || undefined,
          lastName: r.lastName || undefined,
          contactPref: r.contactPref || undefined,
          strengths: r.strengths || undefined,
          notes: r.notes || undefined,
          tier: r.tier || undefined,
          tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags ? JSON.stringify([r.tags]) : undefined),
        }
      })
    );

    await prisma.$transaction(ops);
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
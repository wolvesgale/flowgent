export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const role = url.searchParams.get('role') as 'ADMIN'|'CS'|null;
    const token = url.searchParams.get('token');

    if (!email || !role || !token) {
      return NextResponse.json({ ok:false, error:'missing params' }, { status:400 });
    }
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json({ ok:false, error:'invalid token' }, { status:401 });
    }

    const user = await prisma.user.update({
      where: { email },
      data: { role },
      select: { id:true, email:true, role:true, name:true },
    });

    return NextResponse.json({ ok:true, user });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ ok:false, error: errorMessage }, { status:500 });
  }
}
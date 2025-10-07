export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');
    const password = searchParams.get('password');

    if (!email || !token || !password) {
      return NextResponse.json({ ok:false, error:'Missing params: email, token, password' }, { status:400 });
    }
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json({ ok:false, error:'Invalid setup token' }, { status:403 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id:true, email:true, name:true, role:true },
    });
    if (existing) return NextResponse.json({ ok:true, note:'already exists', user: existing }, { status:200 });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name:'Administrator', password: hash, role:'ADMIN' },
      select: { id:true, email:true, name:true, role:true },
    });

    return NextResponse.json({ ok:true, note:'created', user }, { status:201 });
  } catch (e) {
    console.error('setup error', e);
    return NextResponse.json({ ok:false, error:'Internal server error' }, { status:500 });
  }
}

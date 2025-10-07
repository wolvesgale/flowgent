import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
// 先頭付近に追加
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');
    const password = searchParams.get('password');

    if (!email || !token || !password) {
      return NextResponse.json(
        { ok: false, error: 'Missing params: email, token, password' },
        { status: 400 }
      );
    }
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Invalid setup token' }, { status: 403 });
    }

    // 既にそのメールのユーザーがいるなら情報返して終了（冪等）
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });
    if (existingByEmail) {
      return NextResponse.json({ ok: true, note: 'already exists', user: existingByEmail }, { status: 200 });
    }

    // 管理者は複数許容（要件通り）
    const hashedPassword = await bcrypt.hash(password, 12);
    const adminUser = await prisma.user.create({
      data: { email, name: 'Administrator', password: hashedPassword, role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ ok: true, note: 'created', user: adminUser }, { status: 201 });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

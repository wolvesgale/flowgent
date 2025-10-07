import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETUP_TOKEN = 'flowgent_setup_7c8f1e9b3d2a4';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const role = searchParams.get('role');
    const token = searchParams.get('token');

    // パラメータ検証
    if (!email || !role || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters: email, role, token' },
        { status: 400 }
      );
    }

    // トークン検証
    if (token !== SETUP_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // ロール検証
    if (!['ADMIN', 'CS', 'USER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN, CS, or USER' },
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // ロール更新（冪等）
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: role as 'ADMIN' | 'CS' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Role updated successfully',
        user: updatedUser,
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Promote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
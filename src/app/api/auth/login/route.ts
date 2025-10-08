import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let credentials: Partial<{ email: string; password: string }> = {};

    try {
      credentials = await request.json();
    } catch (parseError) {
      console.error('Login payload parse error:', parseError);
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const email = credentials.email?.trim();
    const password = credentials.password ?? '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedPassword = String(password);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(normalizedPassword, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    // Create session
    const session = await getSession(request, response);
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
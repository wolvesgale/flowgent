import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');
    const password = searchParams.get('password');

    // Validate required parameters
    if (!email || !token || !password) {
      return NextResponse.json(
        { error: 'Missing required parameters: email, token, password' },
        { status: 400 }
      );
    }

    // Validate setup token
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 403 }
      );
    }

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Admin user already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email,
        name: 'Administrator',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    return NextResponse.json(
      {
        message: 'Admin user created successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
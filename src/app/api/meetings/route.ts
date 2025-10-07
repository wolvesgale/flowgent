import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Check if user has ADMIN or CS role
    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    if (!body.evangelistId) {
      return NextResponse.json(
        { error: "evangelistId is required" },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        evangelistId: body.evangelistId,
        date: body.date ? new Date(body.date) : new Date(),
        isFirst: !!body.isFirst,
        summary: body.summary || null,
        nextActions: body.nextActions || null,
        contactMethod: body.contactMethod || null,
      },
      include: {
        evangelist: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Failed to create meeting:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Check if user has ADMIN or CS role
    if (session.role !== 'ADMIN' && session.role !== 'CS') {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const evangelistId = searchParams.get("evangelistId");

    if (!evangelistId) {
      return NextResponse.json(
        { error: "evangelistId is required" },
        { status: 400 }
      );
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        evangelistId: evangelistId,
      },
      orderBy: {
        date: "desc",
      },
      include: {
        evangelist: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error("Failed to fetch meetings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { name, challengeId } = await request.json();
    if (!name || !challengeId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const solved = await prisma.flagSubmission.findFirst({
      where: {
        userName: name,
        challengeId,
        correct: true,
      },
    });
    return NextResponse.json({ solved: !!solved });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 
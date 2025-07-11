import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { name, challengeId } = await request.json();
    if (!name || !challengeId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const maxAttempts = 2;
    const attemptsUsed = await prisma.challengeSubmission.count({
      where: { userName: name, challengeId },
    });
    const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);
    return NextResponse.json({ attemptsUsed, attemptsRemaining });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 
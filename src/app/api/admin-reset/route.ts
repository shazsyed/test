import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { isAdminSession } from '@/lib/isAdminSession';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  if (!(await isAdminSession(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.challengeSubmission.deleteMany();
    await prisma.flagSubmission.deleteMany();
    await prisma.leaderboardUser.deleteMany();
    await prisma.challengeLock.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
} 
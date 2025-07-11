import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// GET: Return leaderboard (top users by score)
export async function GET() {
  const users = await prisma.leaderboardUser.findMany({
    orderBy: { score: 'desc' },
    take: 10,
  });
  return NextResponse.json(users);
}

// POST: Create or update a user's score
export async function POST(req: NextRequest) {
  const { name, avatar, score } = await req.json();
  if (typeof name !== 'string' || typeof avatar !== 'string' || typeof score !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  // Upsert by name (or you can use a unique id if available)
  const user = await prisma.leaderboardUser.upsert({
    where: { name },
    update: { score, avatar },
    create: { name, avatar, score },
  });
  return NextResponse.json(user);
} 
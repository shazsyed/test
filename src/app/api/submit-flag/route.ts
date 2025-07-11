import { NextRequest, NextResponse } from 'next/server';
import { challenges } from '@/data/challenges';
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { challengeId, flag, name } = await req.json();
  if (!challengeId || !flag || !name) {
    return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
  }

  // Flags are now read from environment variables for each challenge
  // Convention: FLAG_<CHALLENGE_ID> (e.g., FLAG_CHALLENGE1, FLAG_CHALLENGE2)
  const envVarName = `FLAG_${challengeId}`;
  const expectedFlag = process.env[envVarName];
  if (!expectedFlag) {
    return NextResponse.json({ success: false, error: `Flag for challenge not set in ENV (${envVarName})` }, { status: 500 });
  }
  const challenge = challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
  }

  // Check if challenge is locked
  const lock = await prisma.challengeLock.findUnique({ where: { id: challengeId } });
  if (lock && lock.locked) {
    return NextResponse.json({ success: false, error: 'Challenge is locked' }, { status: 423 });
  }

  // Check if user already solved this flag
  const existing = await prisma.flagSubmission.findFirst({
    where: { userName: name, challengeId, correct: true },
  });
  if (existing) {
    // Already solved
    const user = await prisma.leaderboardUser.findUnique({ where: { name } });
    return NextResponse.json({ success: true, correct: true, alreadySolved: true, score: user?.score ?? 0 });
  }

  // Check flag
  const correct = flag.trim() === expectedFlag;
  let score = 0;
  if (correct) {
    // Award 5 points and mark as solved
    await prisma.flagSubmission.create({
      data: {
        userName: name,
        challengeId,
        flag,
        correct: true,
      },
    });
    const user = await prisma.leaderboardUser.upsert({
      where: { name },
      update: { score: { increment: 5 } },
      create: { name, score: 5, avatar: "" },
    });
    score = user.score;
  } else {
    // Incorrect flag, record attempt
    await prisma.flagSubmission.create({
      data: {
        userName: name,
        challengeId,
        flag,
        correct: false,
      },
    });
    const user = await prisma.leaderboardUser.findUnique({ where: { name } });
    score = user?.score ?? 0;
  }
  return NextResponse.json({ success: true, correct, alreadySolved: false, score });
} 
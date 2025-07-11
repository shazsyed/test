import { NextRequest, NextResponse } from 'next/server';
import { challenges } from '@/data/challenges';

import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { name, avatar, challengeId, selectedLine } = await req.json();
  if (typeof name !== 'string' || typeof avatar !== 'string' || typeof challengeId !== 'string' || typeof selectedLine !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Find the challenge
  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  // Check if challenge is locked
  const lock = await prisma.challengeLock.findUnique({ where: { id: challengeId } });
  if (lock && lock.locked) {
    return NextResponse.json({ error: 'Challenge is locked' }, { status: 423 });
  }

  // Validate the answer
  const isCorrect = challenge.vulnerableLines.includes(selectedLine);

  // Check if user already solved this challenge correctly
  if (isCorrect) {
    const alreadySolved = await prisma.challengeSubmission.findFirst({
      where: {
        userName: name,
        challengeId,
        correct: true,
      },
    });
    if (alreadySolved) {
      return NextResponse.json({ error: 'Challenge already solved', alreadySolved: true }, { status: 403 });
    }
  }

  // Count attempts for this user/challenge
  const attempts = await prisma.challengeSubmission.count({
    where: { userName: name, challengeId },
  });
  const maxAttempts = 2;
  const attemptsRemaining = Math.max(0, maxAttempts - attempts);

  if (attempts >= maxAttempts) {
    return NextResponse.json({
      error: 'No attempts remaining',
      attemptsUsed: attempts,
      attemptsRemaining: 0,
    }, { status: 403 });
  }

  // Store the submission
  await prisma.challengeSubmission.create({
    data: {
      userName: name,
      challengeId,
      selectedLine,
      correct: isCorrect,
    },
  });

  // Re-count attempts after the new submission
  const attemptsAfter = await prisma.challengeSubmission.count({
    where: { userName: name, challengeId },
  });

  // Update the leaderboard score if correct
  let user;
  if (isCorrect) {
    // +1 for correct
    user = await prisma.leaderboardUser.upsert({
      where: { name },
      update: { score: { increment: 1 }, avatar },
      create: { name, avatar, score: 1 },
    });
  } else {
    // No penalty for incorrect answers; just return the current score
    user = await prisma.leaderboardUser.findUnique({ where: { name } });
    // If user doesn't exist yet, create with score 0
    if (!user) {
      user = await prisma.leaderboardUser.create({ data: { name, avatar, score: 0 } });
    }
  }

  return NextResponse.json({ correct: isCorrect, score: user.score, attemptsUsed: attemptsAfter, attemptsRemaining: Math.max(0, maxAttempts - attemptsAfter) });
} 
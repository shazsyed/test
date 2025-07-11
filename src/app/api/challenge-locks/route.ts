import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { isAdminSession } from '@/lib/isAdminSession';

const prisma = new PrismaClient();

// GET: Return all challenge lock states
export async function GET() {
  const locks = await prisma.challengeLock.findMany();
  // Return as { [id]: locked }
  const lockMap = Object.fromEntries(locks.map(l => [l.id, l.locked]));
  return NextResponse.json(lockMap);
}

// POST: Update lock state for a challenge
export async function POST(req: NextRequest) {
  if (!(await isAdminSession(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, locked } = await req.json();
  if (typeof id !== 'string' || typeof locked !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const updated = await prisma.challengeLock.upsert({
    where: { id },
    update: { locked },
    create: { id, locked },
  });
  return NextResponse.json({ id: updated.id, locked: updated.locked });
} 
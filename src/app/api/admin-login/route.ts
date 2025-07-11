export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import { isAdminSession } from '@/lib/isAdminSession';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_COOKIE = 'admin_session';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'complex_password_at_least_32_characters_long';

export const sessionOptions: SessionOptions = {
  cookieName: SESSION_COOKIE,
  password: SESSION_SECRET,
  cookieOptions: {
    maxAge: 60 * 60 * 24, // 1 day
  // Set secure to false because we're on http (not https)
    secure: false,
  },
};

type AdminSession = {
  isAdmin?: boolean;
};

export async function POST(request: NextRequest) {
  console.log('[ADMIN-LOGIN] POST called');
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.log('[ADMIN-LOGIN] Error parsing JSON:', err);
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { password, logout } = body;
  console.log('[ADMIN-LOGIN] password:', password, 'logout:', logout);

  // Prepare the response object you will return
  const res = NextResponse.json({ success: true });
  const session = await getIronSession<AdminSession>(request, res, sessionOptions);
  console.log('[ADMIN-LOGIN] Incoming cookies:', request.cookies.getAll());
  console.log('[ADMIN-LOGIN] Session before:', session);

  if (logout) {
    session.destroy();
    await session.save();
    console.log('[ADMIN-LOGIN] Session destroyed and saved.');
    console.log('[ADMIN-LOGIN] Set-Cookie header:', res.headers.get('set-cookie'));
    return res;
  }

  if (!password) {
    console.log('[ADMIN-LOGIN] Missing password');
    return NextResponse.json({ success: false, error: 'Missing password' }, { status: 400 });
  }
  if (password === ADMIN_PASSWORD) {
    session.isAdmin = true;
    await session.save();
    console.log('[ADMIN-LOGIN] Login success. Session after:', session);
    console.log('[ADMIN-LOGIN] Set-Cookie header:', res.headers.get('set-cookie'));
    return res;
  } else {
    console.log('[ADMIN-LOGIN] Incorrect password');
    return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
  }
}

export async function GET(request: NextRequest) {
  console.log('[ADMIN-LOGIN] GET called');
  const session = await getIronSession<AdminSession>(request.cookies as any, sessionOptions);
  console.log('[ADMIN-LOGIN] Session in GET:', session);
  if (session.isAdmin) {
    return NextResponse.json({ authenticated: true });
  } else {
    return NextResponse.json({ authenticated: false });
  }
}

// Helper for other endpoints to check admin session
// export async function isAdminSession(request: NextRequest) {
//   const session = await getIronSession<AdminSession>(request.cookies as any, sessionOptions);
//   console.log('[ADMIN-LOGIN] isAdminSession:', session);
//   return !!session.isAdmin;
// } 
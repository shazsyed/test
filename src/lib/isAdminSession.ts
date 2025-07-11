import { NextRequest } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';

const SESSION_COOKIE = 'admin_session';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'complex_password_at_least_32_characters_long';

export const sessionOptions: SessionOptions = {
  cookieName: SESSION_COOKIE,
  password: SESSION_SECRET,
  cookieOptions: {
    maxAge: 60 * 60 * 24, // 1 day
  },
};

type AdminSession = {
  isAdmin?: boolean;
};

export async function isAdminSession(request: NextRequest) {
  const session = await getIronSession<AdminSession>(request.cookies as any, sessionOptions);
  console.log('[ADMIN-LOGIN] isAdminSession:', session);
  return !!session.isAdmin;
} 
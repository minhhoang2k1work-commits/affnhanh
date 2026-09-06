import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  // This one machine-to-machine endpoint authenticates its own Telegram secret before reading data.
  if (request.nextUrl.pathname === '/api/telegram/webhook') return NextResponse.next();
  const username = process.env.APP_BASIC_AUTH_USER;
  const password = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!username || !password) return NextResponse.next();

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    try {
      const [providedUser, providedPassword] = atob(authorization.slice(6)).split(':', 2);
      if (providedUser === username && providedPassword === password) return NextResponse.next();
    } catch {
      // Fall through to a new browser authentication challenge.
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Affiliate Automation Hub", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|generated/).*)'],
};

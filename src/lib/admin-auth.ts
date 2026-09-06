import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSigningKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be configured with at least 32 characters.');
  }
  return key;
}

function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    throw new Error('ADMIN_PASSWORD must be configured in environment variables.');
  }
  return pw;
}

/**
 * Verify password against ADMIN_PASSWORD env variable.
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = getAdminPassword();
  // Use timing-safe comparison to prevent timing attacks
  if (password.length !== adminPassword.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(password, 'utf8'),
    Buffer.from(adminPassword, 'utf8')
  );
}

/**
 * Create a signed session token.
 * Format: expiresAt:signature
 */
function createToken(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `admin:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Verify a session token is valid and not expired.
 */
function verifyToken(token: string): boolean {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [role, expiresAtStr, providedSignature] = parts;
    if (role !== 'admin') return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const payload = `${role}:${expiresAtStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', getSigningKey())
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Create admin session and set httpOnly cookie.
 * Must be called from a Server Action or Route Handler.
 */
export async function createAdminSession(): Promise<void> {
  const token = createToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

/**
 * Verify admin session from cookies() (for Server Components / Server Actions).
 */
export async function verifyAdminSessionFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return false;
  return verifyToken(sessionCookie.value);
}

/**
 * Verify admin session from NextRequest (for Route Handlers).
 */
export function verifyAdminSessionFromRequest(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie?.value) return false;
  return verifyToken(sessionCookie.value);
}

/**
 * Delete admin session cookie (logout).
 * Must be called from a Server Action or Route Handler.
 */
export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

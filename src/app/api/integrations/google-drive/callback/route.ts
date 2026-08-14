import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { exchangeGoogleDriveAuthorizationCode } from '@/lib/storage/google-drive-oauth';

function stateMatches(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function GET(request: NextRequest) {
  const returnUrl = new URL('/ai-video', process.env.APP_BASE_URL || request.url);
  try {
    const state = request.nextUrl.searchParams.get('state') || '';
    const code = request.nextUrl.searchParams.get('code') || '';
    const oauthError = request.nextUrl.searchParams.get('error');
    const expectedState = request.cookies.get('google_drive_oauth_state')?.value || '';
    if (oauthError) throw new Error('Bạn đã hủy hoặc Google từ chối cấp quyền.');
    if (!state || !expectedState || !stateMatches(expectedState, state)) throw new Error('Phiên kết nối Google Drive không hợp lệ hoặc đã hết hạn.');
    if (!code) throw new Error('Google không trả về mã xác thực.');

    const user = await getOrCreateUser();
    await exchangeGoogleDriveAuthorizationCode(user.id, request, code);
    returnUrl.searchParams.set('drive', 'connected');
  } catch (error) {
    returnUrl.searchParams.set('drive', 'error');
    returnUrl.searchParams.set('message', error instanceof Error ? error.message : 'Kết nối Google Drive thất bại.');
  }
  const response = NextResponse.redirect(returnUrl);
  response.cookies.delete('google_drive_oauth_state');
  return response;
}

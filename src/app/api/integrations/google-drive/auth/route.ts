import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { createGoogleDriveAuthorizationUrl } from '@/lib/storage/google-drive-oauth';

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const state = crypto.randomBytes(32).toString('hex');
    const authorizationUrl = await createGoogleDriveAuthorizationUrl(user.id, request, state);
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set('google_drive_oauth_state', state, {
      httpOnly: true,
      secure: new URL(process.env.APP_BASE_URL || request.url).protocol === 'https:',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/api/integrations/google-drive',
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể bắt đầu kết nối Google Drive.';
    const url = new URL('/ai-video', request.url);
    url.searchParams.set('drive', 'error');
    url.searchParams.set('message', message);
    return NextResponse.redirect(url);
  }
}

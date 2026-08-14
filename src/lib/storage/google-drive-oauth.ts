import { getGoogleDriveOAuthSecret, saveGoogleDriveAuthorization } from './google-drive';

export function getGoogleDriveRedirectUri(request: Request): string {
  const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin;
  return new URL('/api/integrations/google-drive/callback', baseUrl).toString();
}

export async function createGoogleDriveAuthorizationUrl(userId: string, request: Request, state: string) {
  const secret = await getGoogleDriveOAuthSecret(userId);
  const params = new URLSearchParams({
    client_id: secret.clientId,
    redirect_uri: getGoogleDriveRedirectUri(request),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleDriveAuthorizationCode(userId: string, request: Request, code: string) {
  const secret = await getGoogleDriveOAuthSecret(userId);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: secret.clientId,
      client_secret: secret.clientSecret,
      code,
      redirect_uri: getGoogleDriveRedirectUri(request),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google từ chối kết nối OAuth (${tokenResponse.status}).`);
  const tokens = await tokenResponse.json();
  const refreshToken = tokens.refresh_token || secret.refreshToken;
  if (!refreshToken) throw new Error('Google không trả về refresh token. Hãy cấp lại quyền với chế độ offline.');

  let accountEmail = '';
  let accountName = '';
  if (tokens.access_token) {
    const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (aboutResponse.ok) {
      const about = await aboutResponse.json();
      accountEmail = about.user?.emailAddress || '';
      accountName = about.user?.displayName || '';
    }
  }
  await saveGoogleDriveAuthorization(userId, { refreshToken, accountEmail, accountName });
  return { accountEmail, accountName };
}

import { createReadStream, promises as fs } from 'fs';
import { db } from '@/lib/db';
import { decryptText, encryptText } from '@/lib/crypto';

const PROVIDER_NAME = 'google_drive';

type GoogleDriveSecret = {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
};

type GoogleDriveProviderConfig = {
  folderId?: string;
  autoUpload?: boolean;
  accountEmail?: string;
  accountName?: string;
};

export interface GoogleDriveUploadInput {
  filePath: string;
  name: string;
  folderId?: string;
  projectId: string;
  userId: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
}

function parseSecret(value?: string | null): GoogleDriveSecret | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decryptText(value));
    if (parsed?.clientId && parsed?.clientSecret) return parsed as GoogleDriveSecret;
  } catch {
    return null;
  }
  return null;
}

async function getStoredIntegration(userId: string) {
  const provider = await db.aIProvider.findUnique({ where: { userId_name: { userId, name: PROVIDER_NAME } } });
  return {
    provider,
    secret: parseSecret(provider?.apiKeyEnc),
    config: (provider?.config || {}) as GoogleDriveProviderConfig,
  };
}

function getEnvironmentSecret(): GoogleDriveSecret | null {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || undefined };
}

export async function getGoogleDriveIntegrationStatus(userId: string) {
  const stored = await getStoredIntegration(userId);
  const environmentSecret = getEnvironmentSecret();
  const secret = stored.secret || environmentSecret;
  const source = stored.secret ? 'database' : environmentSecret ? 'environment' : null;
  const config = stored.provider ? stored.config : {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    autoUpload: process.env.GOOGLE_DRIVE_AUTO_UPLOAD === 'true',
  };
  return {
    configured: Boolean(secret?.clientId && secret?.clientSecret),
    connected: Boolean(secret?.refreshToken),
    clientId: secret?.clientId || '',
    folderId: config.folderId || '',
    autoUpload: config.autoUpload === true,
    accountEmail: config.accountEmail || '',
    accountName: config.accountName || '',
    source,
    hasClientSecret: Boolean(secret?.clientSecret),
  };
}

export async function saveGoogleDriveConfiguration(userId: string, input: {
  clientId?: string;
  clientSecret?: string;
  folderId?: string;
  autoUpload?: boolean;
}) {
  const stored = await getStoredIntegration(userId);
  const existingSecret = stored.secret;
  const clientId = input.clientId?.trim() || existingSecret?.clientId;
  const clientSecret = input.clientSecret?.trim() || existingSecret?.clientSecret;
  if (!clientId || !clientSecret) throw new Error('Client ID và Client Secret là bắt buộc.');
  const secret: GoogleDriveSecret = { clientId, clientSecret, refreshToken: existingSecret?.refreshToken };
  const config: GoogleDriveProviderConfig = {
    ...stored.config,
    folderId: input.folderId?.trim() || '',
    autoUpload: input.autoUpload !== false,
  };
  await db.aIProvider.upsert({
    where: { userId_name: { userId, name: PROVIDER_NAME } },
    update: { type: 'storage', mode: 'api', apiKeyEnc: encryptText(JSON.stringify(secret)), config: config as any, isActive: true },
    create: {
      userId,
      name: PROVIDER_NAME,
      type: 'storage',
      mode: 'api',
      apiKeyEnc: encryptText(JSON.stringify(secret)),
      config: config as any,
      isActive: true,
    },
  });
  return getGoogleDriveIntegrationStatus(userId);
}

export async function getGoogleDriveOAuthSecret(userId: string): Promise<GoogleDriveSecret> {
  const stored = await getStoredIntegration(userId);
  const secret = stored.secret || getEnvironmentSecret();
  if (!secret?.clientId || !secret.clientSecret) throw new Error('Google Drive OAuth client chưa được cấu hình.');
  return secret;
}

export async function saveGoogleDriveAuthorization(userId: string, input: {
  refreshToken: string;
  accountEmail?: string;
  accountName?: string;
}) {
  const stored = await getStoredIntegration(userId);
  const baseSecret = stored.secret || getEnvironmentSecret();
  if (!baseSecret) throw new Error('Google Drive OAuth client chưa được cấu hình.');
  const secret = { ...baseSecret, refreshToken: input.refreshToken };
  const config: GoogleDriveProviderConfig = {
    ...stored.config,
    autoUpload: stored.config.autoUpload !== false,
    accountEmail: input.accountEmail || stored.config.accountEmail,
    accountName: input.accountName || stored.config.accountName,
  };
  await db.aIProvider.upsert({
    where: { userId_name: { userId, name: PROVIDER_NAME } },
    update: { type: 'storage', mode: 'api', apiKeyEnc: encryptText(JSON.stringify(secret)), config: config as any, isActive: true },
    create: {
      userId,
      name: PROVIDER_NAME,
      type: 'storage',
      mode: 'api',
      apiKeyEnc: encryptText(JSON.stringify(secret)),
      config: config as any,
      isActive: true,
    },
  });
}

export async function disconnectGoogleDrive(userId: string) {
  await db.aIProvider.deleteMany({ where: { userId, name: PROVIDER_NAME } });
}

export async function isGoogleDriveConfigured(userId: string): Promise<boolean> {
  return (await getGoogleDriveIntegrationStatus(userId)).connected;
}

export async function isGoogleDriveAutoUploadEnabled(userId: string): Promise<boolean> {
  return (await getGoogleDriveIntegrationStatus(userId)).autoUpload;
}

async function getAccessToken(userId: string): Promise<string> {
  const secret = await getGoogleDriveOAuthSecret(userId);
  if (!secret.refreshToken) throw new Error('Google Drive chưa được kết nối với tài khoản Google.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: secret.clientId,
      client_secret: secret.clientSecret,
      refresh_token: secret.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error(`Google Drive OAuth refresh failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Google Drive OAuth response did not include an access token.');
  return data.access_token as string;
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findExistingFile(accessToken: string, projectId: string): Promise<GoogleDriveFile | null> {
  const query = `trashed = false and appProperties has { key='aiProjectId' and value='${escapeDriveQuery(projectId)}' }`;
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    pageSize: '1',
    fields: 'files(id,name,webViewLink,webContentLink,size,createdTime)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google Drive file lookup failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] as GoogleDriveFile : null;
}

export async function uploadFileToGoogleDrive(input: GoogleDriveUploadInput): Promise<GoogleDriveFile> {
  const accessToken = await getAccessToken(input.userId);
  const existing = await findExistingFile(accessToken, input.projectId);
  if (existing) return existing;

  const stat = await fs.stat(input.filePath);
  const status = await getGoogleDriveIntegrationStatus(input.userId);
  const folderId = input.folderId || status.folderId;
  const metadata = {
    name: input.name,
    mimeType: 'video/mp4',
    ...(folderId ? { parents: [folderId] } : {}),
    appProperties: { aiProjectId: input.projectId, source: 'AFF Video Automation' },
  };
  const params = new URLSearchParams({
    uploadType: 'resumable',
    supportsAllDrives: 'true',
    fields: 'id,name,webViewLink,webContentLink,size,createdTime',
  });
  const initialize = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(stat.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!initialize.ok) throw new Error(`Google Drive upload initialization failed (${initialize.status}): ${await initialize.text()}`);
  const uploadUrl = initialize.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not return a resumable upload URL.');

  const uploaded = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(stat.size) },
    body: createReadStream(input.filePath) as any,
    duplex: 'half',
  } as any);
  if (!uploaded.ok) throw new Error(`Google Drive upload failed (${uploaded.status}): ${await uploaded.text()}`);
  const file = await uploaded.json() as GoogleDriveFile;
  if (!file.id || !file.webViewLink) throw new Error('Google Drive upload completed without a file link.');
  return file;
}

import { createReadStream, promises as fs } from 'fs';

export interface GoogleDriveUploadInput {
  filePath: string;
  name: string;
  folderId?: string;
  projectId: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID
    && process.env.GOOGLE_DRIVE_CLIENT_SECRET
    && process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

export function isGoogleDriveAutoUploadEnabled(): boolean {
  return process.env.GOOGLE_DRIVE_AUTO_UPLOAD === 'true';
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth is not configured.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
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
  const accessToken = await getAccessToken();
  const existing = await findExistingFile(accessToken, input.projectId);
  if (existing) return existing;

  const stat = await fs.stat(input.filePath);
  const folderId = input.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
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

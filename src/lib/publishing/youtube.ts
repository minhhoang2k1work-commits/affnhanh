import { createReadStream, promises as fs } from 'fs';

export type YouTubePrivacy = 'private' | 'unlisted' | 'public';

export interface YouTubeUploadInput {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: YouTubePrivacy;
  publishAt?: string;
}

export function isYouTubeConfigured(): boolean {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID
    && process.env.YOUTUBE_CLIENT_SECRET
    && process.env.YOUTUBE_REFRESH_TOKEN,
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!isYouTubeConfigured() || !clientId || !clientSecret || !refreshToken) {
    throw new Error('YouTube OAuth is not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`YouTube OAuth refresh failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('YouTube OAuth response did not include an access token.');
  return data.access_token;
}

export async function uploadYouTubeVideo(input: YouTubeUploadInput) {
  const accessToken = await getAccessToken();
  const stat = await fs.stat(input.filePath);
  const privacyStatus = input.privacyStatus || 'private';
  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: (input.tags || []).slice(0, 30),
      categoryId: '22',
      defaultLanguage: 'vi',
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
      ...(input.publishAt && privacyStatus === 'private' ? { publishAt: input.publishAt } : {}),
    },
  };

  const initialize = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(stat.size),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!initialize.ok) throw new Error(`YouTube upload initialization failed (${initialize.status}): ${await initialize.text()}`);
  const uploadUrl = initialize.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL.');

  const uploaded = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(stat.size) },
    body: createReadStream(input.filePath) as any,
    duplex: 'half',
  } as any);
  if (!uploaded.ok) throw new Error(`YouTube video upload failed (${uploaded.status}): ${await uploaded.text()}`);
  const video = await uploaded.json();
  if (!video.id) throw new Error('YouTube upload completed without a video ID.');
  return { id: video.id as string, url: `https://www.youtube.com/watch?v=${video.id}`, privacyStatus };
}

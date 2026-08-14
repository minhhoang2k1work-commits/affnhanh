import path from 'path';
import { db } from '@/lib/db';
import { uploadFileToGoogleDrive } from './google-drive';

function safeFileName(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ').trim();
  return `${normalized.slice(0, 100) || 'affiliate-video'}.mp4`;
}

export async function archiveProjectToGoogleDrive(projectId: string, userId: string) {
  const project = await db.aIVideoProject.findFirst({ where: { id: projectId, userId } });
  if (!project?.videoUrl || !project.videoUrl.startsWith('/generated/')) {
    throw new Error('A locally assembled video is required before Google Drive upload.');
  }

  const generatedRoot = path.resolve(process.cwd(), 'public', 'generated');
  const filePath = path.resolve(process.cwd(), 'public', project.videoUrl.replace(/^\/+/, ''));
  if (!filePath.startsWith(`${generatedRoot}${path.sep}`)) {
    throw new Error('Generated video path is outside the allowed directory.');
  }

  const file = await uploadFileToGoogleDrive({
    filePath,
    name: safeFileName(project.title),
    projectId: project.id,
    userId,
  });
  const note = JSON.stringify({ aiProjectId: project.id, driveFileId: file.id });
  const existingRecord = await db.video.findFirst({
    where: { userId, platform: 'GOOGLE_DRIVE', note: { contains: project.id } },
  });
  const record = existingRecord
    ? await db.video.update({ where: { id: existingRecord.id }, data: { title: project.title, targetUrl: file.webViewLink, note } })
    : await db.video.create({ data: { userId, title: project.title, platform: 'GOOGLE_DRIVE', targetUrl: file.webViewLink, note } });

  return {
    provider: 'google_drive',
    fileId: file.id,
    name: file.name,
    url: file.webViewLink,
    downloadUrl: file.webContentLink || null,
    recordId: record.id,
    uploaded: true,
  };
}

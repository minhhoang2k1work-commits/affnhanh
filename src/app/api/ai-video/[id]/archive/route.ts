import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { archiveProjectToGoogleDrive } from '@/lib/storage/archive-project';
import { isGoogleDriveConfigured } from '@/lib/storage/google-drive';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser();
    if (!(await isGoogleDriveConfigured(user.id))) {
      return NextResponse.json({
        error: 'Google Drive chưa được cấu hình. Hãy thêm Client ID, Client Secret và Refresh Token.',
      }, { status: 400 });
    }
    const { id } = await params;
    const storage = await archiveProjectToGoogleDrive(id, user.id);
    return NextResponse.json({ success: true, storage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải video lên Google Drive.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

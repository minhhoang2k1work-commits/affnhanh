import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import {
  disconnectGoogleDrive,
  getGoogleDriveIntegrationStatus,
  saveGoogleDriveConfiguration,
} from '@/lib/storage/google-drive';
import { getGoogleDriveRedirectUri } from '@/lib/storage/google-drive-oauth';

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const status = await getGoogleDriveIntegrationStatus(user.id);
    return NextResponse.json({ success: true, status, redirectUri: getGoogleDriveRedirectUri(request) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đọc trạng thái Google Drive.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const status = await saveGoogleDriveConfiguration(user.id, {
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      folderId: body.folderId,
      autoUpload: body.autoUpload,
    });
    return NextResponse.json({ success: true, status, redirectUri: getGoogleDriveRedirectUri(request) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lưu cấu hình Google Drive.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await getOrCreateUser();
    const status = await getGoogleDriveIntegrationStatus(user.id);
    if (status.source === 'environment') {
      return NextResponse.json({ error: 'Kết nối này được quản lý bằng biến môi trường và không thể xóa từ UI.' }, { status: 400 });
    }
    await disconnectGoogleDrive(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể ngắt kết nối Google Drive.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

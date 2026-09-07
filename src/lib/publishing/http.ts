import { NextResponse } from 'next/server';
import { PublishingError } from './manager';

export function publishingFailure(error: unknown) {
  if (error instanceof PublishingError) return NextResponse.json({ error: error.message }, { status: error.status });
  const code = (error as { code?: string })?.code;
  if (['P2021', 'P2022'].includes(code || '')) return NextResponse.json({ error: 'Cơ sở dữ liệu chưa có bảng quản lý đăng bài. Chạy migration publishing-manager trước khi sử dụng.' }, { status: 503 });
  if (code === 'P2002') return NextResponse.json({ error: 'Page hoặc yêu cầu này đã tồn tại. Tải lại danh sách để kiểm tra.' }, { status: 409 });
  if (code === 'P2034') return NextResponse.json({ error: 'Lịch vừa được thay đổi ở phiên khác. Tải lại rồi thử lại.' }, { status: 409 });
  return NextResponse.json({ error: error instanceof Error && !code && !error.message.includes('prisma') ? error.message : 'Chưa kết nối được cơ sở dữ liệu quản lý đăng bài.' }, { status: 400 });
}


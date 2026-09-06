import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  createAdminSession,
  verifyAdminSessionFromRequest,
  deleteAdminSession,
} from '@/lib/admin-auth';

/**
 * GET /api/admin/auth — Check current admin session status
 */
export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = verifyAdminSessionFromRequest(request);
    return NextResponse.json({ authenticated: isAuthenticated });
  } catch (error: any) {
    console.error('[Admin Auth GET Error]:', error?.message || error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * POST /api/admin/auth — Login with password
 * Body: { password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Vui lòng nhập mật khẩu.' },
        { status: 400 }
      );
    }

    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Mật khẩu không đúng.' },
        { status: 401 }
      );
    }

    await createAdminSession();

    return NextResponse.json({ success: true, message: 'Đăng nhập thành công.' });
  } catch (error: any) {
    console.error('[Admin Auth POST Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'Lỗi server nội bộ.', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth — Logout (delete session cookie)
 */
export async function DELETE() {
  try {
    await deleteAdminSession();
    return NextResponse.json({ success: true, message: 'Đã đăng xuất.' });
  } catch (error: any) {
    console.error('[Admin Auth DELETE Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'Lỗi server nội bộ.', detail: error?.message },
      { status: 500 }
    );
  }
}

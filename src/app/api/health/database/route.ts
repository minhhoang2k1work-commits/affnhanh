import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Task 4: Execute real db.user.findFirst() query
    const firstUser = await db.user.findFirst();
    const userCount = await db.user.count();

    return NextResponse.json({
      status: 'connected',
      message: 'Kết nối cơ sở dữ liệu thành công!',
      userCount,
      activeUser: firstUser ? { id: firstUser.id, email: firstUser.email } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DATABASE HEALTH CHECK FAILED]:', error);
    
    // Task 7: Return sanitized localized user error message
    return NextResponse.json(
      {
        status: 'error',
        message: 'Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình hệ thống.',
        ...(process.env.NODE_ENV === 'development' ? { technicalDetails: error?.message } : {}),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/bridge/status
 * Endpoint để AutoCut kiểm tra AFF có đang chạy và sẵn sàng không
 * Trả về trạng thái hệ thống và danh sách tính năng khả dụng
 */
export async function GET() {
  try {
    // Kiểm tra database connection
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      success: true,
      app: 'AFF',
      version: '1.0.0',
      status: 'ready',
      capabilities: [
        'ai_video_generation',      // Tạo video AI (Veo, Kling, Runway)
        'ai_script_generation',      // Tạo kịch bản AI (OpenAI structured output)
        'storyboard_generation',     // Tạo storyboard (Style/Character Bible)
        'product_lookup',            // Tra cứu sản phẩm Shopee/TikTok
        'affiliate_link',            // Tạo link affiliate
        'commission_enrichment',     // Làm giàu dữ liệu hoa hồng
        'youtube_publishing',        // Upload YouTube
        'google_drive_archive',      // Lưu trữ Google Drive
        'flow_workflow',             // DAG workflow engine
        'video_merge',               // Ghép video FFmpeg
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        app: 'AFF',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

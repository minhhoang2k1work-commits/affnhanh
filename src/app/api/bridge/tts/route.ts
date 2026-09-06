/**
 * Bridge TTS API — Endpoint chung cho AutoCut gọi TTS qua AFF
 *
 * POST /api/bridge/tts
 *
 * Body:
 *   - text: string (bắt buộc) — Văn bản cần đọc
 *   - provider: 'google_tts' | 'elevenlabs' | 'fishaudio' (mặc định: auto-detect)
 *   - language: string (mặc định: 'vi')
 *   - voiceId: string (cho ElevenLabs/Fish Audio)
 *   - generateSRT: boolean (mặc định: true) — Tạo SRT phụ đề
 *
 * Response:
 *   - audioUrl: string — Base64 data URL
 *   - srtContent: string — Nội dung file SRT (nếu generateSRT=true)
 *   - provider: string — Provider đã sử dụng
 *   - cost: number — Ước tính chi phí (USD)
 *   - characterCount: number
 */
import { NextResponse } from 'next/server';
import { AIProviderManager } from '@/lib/ai/providers';
import { generateSRT, cleanScriptForTTS } from '@/lib/ai/google-tts-client';

const providerManager = AIProviderManager.getInstance();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      text,
      provider: preferredProvider,
      language = 'vi',
      voiceId,
      generateSrt = true,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Thiếu trường "text". Cần cung cấp văn bản để tạo giọng nói.' },
        { status: 400 }
      );
    }

    // Lấy voiceover client theo provider ưu tiên
    const client = await providerManager.getVoiceoverClient(preferredProvider);

    // Tạo audio
    const result = await client.generateVoiceover({
      text: cleanScriptForTTS(text),
      language,
      ...(voiceId ? { voiceId } : {}),
    });

    // Tính chi phí
    const cost = client.getEstimatedCost(text.length);

    // Tạo SRT nếu yêu cầu
    const srtContent = generateSrt ? generateSRT(text) : undefined;

    return NextResponse.json({
      success: true,
      audioUrl: result.audioUrl,
      srtContent,
      provider: client.providerName,
      cost,
      characterCount: ('characterCount' in (result as any) ? (result as any).characterCount : text.length),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Bridge TTS] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/bridge/tts — Lấy danh sách TTS providers và voices có sẵn
 */
export async function GET() {
  try {
    const providers = [
      {
        name: 'google_tts',
        displayName: 'Google TTS (miễn phí)',
        requiresKey: false,
        maxChars: 5000,
        costPer1000Chars: 0,
        languages: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'],
      },
      {
        name: 'fishaudio',
        displayName: 'Fish Audio (voice cloning)',
        requiresKey: true,
        maxChars: 8000,
        costPer1000Chars: 0.015,
        languages: ['vi', 'en', 'ja', 'ko', 'zh'],
      },
      {
        name: 'elevenlabs',
        displayName: 'ElevenLabs (chất lượng cao)',
        requiresKey: true,
        maxChars: 10000,
        costPer1000Chars: 0.30,
        languages: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es', 'pt', 'ar'],
      },
    ];

    // Kiểm tra xem provider nào đã cấu hình API key
    const configured: string[] = ['google_tts']; // Google TTS luôn sẵn sàng
    try {
      await providerManager.getProviderConfig('voiceover', 'elevenlabs');
      configured.push('elevenlabs');
    } catch { /* chưa cấu hình */ }
    try {
      await providerManager.getProviderConfig('voiceover', 'fishaudio');
      configured.push('fishaudio');
    } catch { /* chưa cấu hình */ }

    return NextResponse.json({
      success: true,
      providers: providers.map((p) => ({
        ...p,
        configured: configured.includes(p.name),
      })),
      recommended: configured.includes('fishaudio')
        ? 'fishaudio'
        : configured.includes('elevenlabs')
          ? 'elevenlabs'
          : 'google_tts',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

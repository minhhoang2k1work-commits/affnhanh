/**
 * Fish Audio TTS Client — Text-to-Speech qua Fish Audio API
 * Port từ AutoCut AudioSubtitleManager._synthesize_fishaudio()
 *
 * Fish Audio hỗ trợ:
 * - Voice cloning chất lượng cao
 * - Nhiều giọng tiếng Việt tự nhiên
 * - API key mode (ổn định) hoặc browser mode (miễn phí nhưng cần tương tác)
 *
 * API Docs: https://docs.fish.audio/
 */

const FISH_AUDIO_API_BASE = 'https://api.fish.audio/v1';

export interface FishAudioParams {
  text: string;
  voiceId?: string;     // Reference voice ID (cho voice cloning)
  language?: string;    // 'vi', 'en', 'ja', etc.
  apiKey: string;
  format?: 'mp3' | 'wav' | 'opus';
  speed?: number;       // 0.5 - 2.0
}

export interface FishAudioResponse {
  audioUrl: string;     // data:audio/mpeg;base64,...
  characterCount: number;
  requestId?: string;
}

export interface FishAudioVoice {
  id: string;
  name: string;
  language: string;
  description: string;
  previewUrl?: string;
}

/**
 * Tạo audio TTS từ Fish Audio API
 *
 * @param params.text - Văn bản cần đọc (tối đa 8000 ký tự)
 * @param params.voiceId - ID giọng nói (mặc định: giọng Việt Nam mặc định)
 * @param params.apiKey - API key của Fish Audio
 */
export async function generateVoiceover(params: FishAudioParams): Promise<FishAudioResponse> {
  const {
    text,
    voiceId,
    apiKey,
    format = 'mp3',
    speed = 1.0,
  } = params;

  if (!text?.trim()) {
    throw new Error('Text is empty');
  }

  if (text.length > 8000) {
    throw new Error('Fish Audio giới hạn 8000 ký tự mỗi request');
  }

  const body: Record<string, unknown> = {
    text: text.trim(),
    format,
    speed: Math.max(0.5, Math.min(2.0, speed)),
  };

  if (voiceId) {
    body.reference_id = voiceId;
  }

  const response = await fetch(`${FISH_AUDIO_API_BASE}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Fish Audio API error (${response.status}): ${errorText || response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/opus' : 'audio/mpeg';
  const audioUrl = `data:${mimeType};base64,${base64}`;

  return {
    audioUrl,
    characterCount: text.length,
    requestId: response.headers.get('x-request-id') || undefined,
  };
}

/**
 * Lấy danh sách giọng nói có sẵn
 */
export async function listVoices(apiKey: string): Promise<FishAudioVoice[]> {
  const response = await fetch(`${FISH_AUDIO_API_BASE}/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fish Audio API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  return (data.items || data.models || []).map((voice: Record<string, unknown>) => ({
    id: voice.id || voice._id,
    name: voice.title || voice.name || 'Unknown',
    language: (voice.languages as string[])?.[0] || 'vi',
    description: voice.description || '',
    previewUrl: voice.sample_audio_url || undefined,
  }));
}

/**
 * Ước tính chi phí
 * Fish Audio: ~$0.015 / 1000 ký tự (rẻ hơn ElevenLabs ~20x)
 */
export function getEstimatedCost(textLength: number): number {
  return (textLength / 1000) * 0.015;
}

/**
 * Google TTS Client — Text-to-Speech miễn phí qua Google Translate API
 * Port từ AutoCut AudioSubtitleManager._synthesize_google()
 *
 * Ưu điểm: Miễn phí, không cần API key, hỗ trợ tiếng Việt tốt
 * Nhược điểm: Chất lượng thấp hơn ElevenLabs, giới hạn 5000 ký tự
 */

const GOOGLE_TTS_BASE = 'https://translate.google.com/translate_tts';
const MAX_CHUNK_LENGTH = 200; // Google TTS giới hạn mỗi request ~200 ký tự

export interface GoogleTTSParams {
  text: string;
  language?: string; // Mặc định: 'vi'
  speed?: number;    // 0.5 - 2.0, mặc định 1.0
}

export interface GoogleTTSResponse {
  audioUrl: string;  // data:audio/mpeg;base64,...
  characterCount: number;
}

/**
 * Chia text thành các chunk nhỏ theo câu, không quá maxLength ký tự
 */
function splitTextToChunks(text: string, maxLength: number = MAX_CHUNK_LENGTH): string[] {
  const sentences = text
    .replace(/([.!?。])\s*/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      // Câu quá dài — chia theo dấu phẩy hoặc khoảng trắng
      if (current) { chunks.push(current); current = ''; }
      const words = sentence.split(/([,，]\s*|\s+)/);
      for (const word of words) {
        if ((current + word).length > maxLength) {
          if (current) chunks.push(current.trim());
          current = word;
        } else {
          current += word;
        }
      }
    } else if ((current + ' ' + sentence).length > maxLength) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/**
 * Lấy audio từ Google Translate TTS cho 1 chunk text
 */
async function fetchChunkAudio(text: string, language: string): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: language,
    q: text,
  });

  const response = await fetch(`${GOOGLE_TTS_BASE}?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://translate.google.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Google TTS error: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Tạo audio TTS từ Google Translate — miễn phí, không cần API key
 * Tự động chia text dài thành nhiều chunk và nối lại
 *
 * @param params.text - Văn bản cần đọc
 * @param params.language - Ngôn ngữ (mặc định: 'vi')
 * @returns Audio dạng base64 data URL
 */
export async function generateVoiceover(params: GoogleTTSParams): Promise<GoogleTTSResponse> {
  const { text, language = 'vi' } = params;

  if (!text?.trim()) {
    throw new Error('Text is empty');
  }

  const cleanText = cleanScriptForTTS(text);
  const chunks = splitTextToChunks(cleanText);
  const audioBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const buffer = await fetchChunkAudio(chunk, language);
    audioBuffers.push(buffer);
    // Delay nhỏ giữa các request để tránh bị rate limit
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Nối tất cả buffers
  const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  const base64 = Buffer.from(combined).toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64}`;

  return {
    audioUrl,
    characterCount: cleanText.length,
  };
}

/**
 * Làm sạch kịch bản cho TTS — loại bỏ stage directions, markup
 * Port từ AutoCut AudioSubtitleManager._clean_script_for_tts()
 */
export function cleanScriptForTTS(script: string): string {
  return script
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      // Bỏ heading (toàn chữ in hoa, ngắn)
      if (line === line.toUpperCase() && line.length < 60) return false;
      // Bỏ stage directions [...]
      if (line.startsWith('[') && line.endsWith(']')) return false;
      return true;
    })
    .map((line) => line.replace(/^\d+\.\s*/, '')) // Bỏ số thứ tự đầu dòng
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tạo nội dung file SRT từ script
 * Port từ AutoCut AudioSubtitleManager._generate_srt()
 *
 * @param script - Kịch bản gốc
 * @param wordsPerSec - Tốc độ đọc (mặc định 2.5 từ/giây cho tiếng Việt)
 */
export function generateSRT(script: string, wordsPerSec: number = 2.5): string {
  const lines = script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !(l === l.toUpperCase() && l.length < 60));

  let currentTime = 0;
  const entries: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const words = line.split(/\s+/).length;
    const duration = Math.max(1.5, words / wordsPerSec);
    const start = currentTime;
    const end = currentTime + duration;

    entries.push(
      `${i + 1}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${line}\n`
    );

    currentTime = end + 0.3;
  }

  return entries.join('\n');
}

function formatSRTTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs - Math.floor(secs)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function getEstimatedCost(): number {
  return 0; // Miễn phí
}

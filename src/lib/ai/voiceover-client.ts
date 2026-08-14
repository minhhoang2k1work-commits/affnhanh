export interface GenerateVoiceoverParams {
  text: string;
  language?: string;
  voiceId?: string;
  apiKey: string;
}

export interface GenerateVoiceoverResponse {
  audioUrl: string;
  characterCost?: number;
  requestId?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
}

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export async function generateVoiceover(params: GenerateVoiceoverParams): Promise<GenerateVoiceoverResponse> {
  const { text, voiceId = 'pNInz6obpgDQGcFmaJgB', apiKey } = params; // Default voiceId as fallback

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`ElevenLabs API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    // Usually returns audio buffer. We can return it as blob or base64 data URL for client to use.
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    const characterCostHeader = response.headers.get('character-cost');
    return {
      audioUrl,
      characterCost: characterCostHeader ? Number(characterCostHeader) : undefined,
      requestId: response.headers.get('request-id') || undefined,
    };
  } catch (error) {
    console.error('ElevenLabs generateVoiceover error:', error);
    throw error;
  }
}

export async function listVoices(apiKey: string): Promise<Voice[]> {
  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`ElevenLabs API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      preview_url: voice.preview_url
    }));
  } catch (error) {
    console.error('ElevenLabs listVoices error:', error);
    throw error;
  }
}

export function getEstimatedCost(textLength: number): number {
  // Approximate cost estimation for ElevenLabs
  // Usually around $0.30 per 1000 characters
  return (textLength / 1000) * 0.30;
}

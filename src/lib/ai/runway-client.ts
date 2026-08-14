export interface RunwayGenerateParams {
  prompt: string;
  referenceImageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  model?: string;
  apiKey: string;
}

export interface RunwayGenerateResponse {
  taskId: string;
}

export interface RunwayStatusParams {
  taskId: string;
  apiKey: string;
}

export interface RunwayStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';

export async function generateVideo(params: RunwayGenerateParams): Promise<RunwayGenerateResponse> {
  const { prompt, referenceImageUrl, duration = 5, aspectRatio = '9:16', apiKey, model = 'gen4.5' } = params;

  try {
    const endpoint = referenceImageUrl ? 'image_to_video' : 'text_to_video';
    const ratio = aspectRatio === '9:16' ? '720:1280' : '1280:720';
    const response = await fetch(`${RUNWAY_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model,
        promptText: prompt,
        ...(referenceImageUrl ? { promptImage: referenceImageUrl } : {}),
        ratio,
        duration: Math.max(5, Math.min(10, Math.round(duration))),
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Runway API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return {
      taskId: data.id
    };
  } catch (error) {
    console.error('Runway generateVideo error:', error);
    throw error;
  }
}

export async function checkStatus(params: RunwayStatusParams): Promise<RunwayStatusResponse> {
  const { taskId, apiKey } = params;

  try {
    const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Runway API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    let status: RunwayStatusResponse['status'] = 'PENDING';
    if (data.status === 'SUCCEEDED') {
      status = 'COMPLETED';
    } else if (data.status === 'FAILED') {
      status = 'FAILED';
    } else if (data.status === 'RUNNING') {
      status = 'PROCESSING';
    }

    return {
      status,
      progress: typeof data.progress === 'number' ? data.progress * 100 : undefined,
      videoUrl: data.output?.[0] || data.output,
      error: data.failure || data.error
    };
  } catch (error) {
    console.error('Runway checkStatus error:', error);
    throw error;
  }
}

export function getEstimatedCost(duration: number, quality: string = 'standard'): number {
  // Approximate cost estimation for Runway Gen
  const costPerSecond = 0.05;
  return duration * costPerSecond;
}

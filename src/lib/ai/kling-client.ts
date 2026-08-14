export interface KlingGenerateParams {
  prompt: string;
  referenceImageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  apiKey: string;
}

export interface KlingGenerateResponse {
  taskId: string;
}

export interface KlingStatusParams {
  taskId: string;
  apiKey: string;
}

export interface KlingStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

const KLING_API_BASE = 'https://api.klingai.com/v1';

export async function generateVideo(params: KlingGenerateParams): Promise<KlingGenerateResponse> {
  const { prompt, referenceImageUrl, duration, aspectRatio, apiKey } = params;

  try {
    const response = await fetch(`${KLING_API_BASE}/videos/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt,
        image_url: referenceImageUrl,
        duration: duration || 5,
        aspect_ratio: aspectRatio || '16:9'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Kling API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return {
      taskId: data.task_id || data.id
    };
  } catch (error) {
    console.error('Kling generateVideo error:', error);
    throw error;
  }
}

export async function checkStatus(params: KlingStatusParams): Promise<KlingStatusResponse> {
  const { taskId, apiKey } = params;

  try {
    const response = await fetch(`${KLING_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Kling API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    let status: KlingStatusResponse['status'] = 'PENDING';
    if (data.status === 'completed' || data.status === 'success') {
      status = 'COMPLETED';
    } else if (data.status === 'failed' || data.status === 'error') {
      status = 'FAILED';
    } else if (data.status === 'processing' || data.status === 'running') {
      status = 'PROCESSING';
    }

    return {
      status,
      progress: data.progress,
      videoUrl: data.result?.video_url || data.video_url,
      error: data.error?.message || data.error
    };
  } catch (error) {
    console.error('Kling checkStatus error:', error);
    throw error;
  }
}

export function getEstimatedCost(duration: number, quality: string = 'standard'): number {
  // Approximate cost estimation for Kling AI
  const costPerSecond = quality === 'high' ? 0.05 : 0.03;
  return duration * costPerSecond;
}

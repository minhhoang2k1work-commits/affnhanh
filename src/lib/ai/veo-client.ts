export interface VeoGenerateParams {
  prompt: string;
  referenceImageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  apiKey: string; // Google OAuth access token
  projectId?: string;
  location?: string;
  model?: string;
  outputStorageUri?: string;
  resolution?: '720p' | '1080p';
}

export interface VeoGenerateResponse { taskId: string }

export interface VeoStatusParams {
  taskId: string;
  apiKey: string;
  projectId?: string;
  location?: string;
  model?: string;
}

export interface VeoStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

function config(params: { projectId?: string; location?: string; model?: string }) {
  if (!params.projectId) throw new Error('Google Veo provider config requires projectId.');
  return {
    projectId: params.projectId,
    location: params.location || 'us-central1',
    model: params.model || 'veo-3.0-fast-generate-001',
  };
}

function modelEndpoint(params: { projectId?: string; location?: string; model?: string }) {
  const value = config(params);
  return `https://${value.location}-aiplatform.googleapis.com/v1/projects/${value.projectId}/locations/${value.location}/publishers/google/models/${value.model}`;
}

export async function generateVideo(params: VeoGenerateParams): Promise<VeoGenerateResponse> {
  const { prompt, referenceImageUrl, duration, aspectRatio, apiKey, outputStorageUri, resolution } = params;
  if (!outputStorageUri?.startsWith('gs://')) throw new Error('Google Veo provider config requires outputStorageUri (gs:// bucket/path).');

  const instance: Record<string, unknown> = { prompt };
  if (referenceImageUrl) instance.image = { uri: referenceImageUrl, mimeType: 'image/jpeg' };
  const response = await fetch(`${modelEndpoint(params)}:predictLongRunning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        storageUri: outputStorageUri,
        sampleCount: 1,
        aspectRatio: aspectRatio || '9:16',
        durationSeconds: [4, 6, 8].includes(duration || 0) ? duration : 8,
        resolution: resolution || '720p',
      },
    }),
  });
  if (!response.ok) throw new Error(`Veo API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (!data.name) throw new Error('Veo did not return an operation name.');
  return { taskId: data.name };
}

export async function checkStatus(params: VeoStatusParams): Promise<VeoStatusResponse> {
  const response = await fetch(`${modelEndpoint(params)}:fetchPredictOperation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({ operationName: params.taskId }),
  });
  if (!response.ok) throw new Error(`Veo status error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (data.error) return { status: 'FAILED', error: data.error.message || JSON.stringify(data.error) };
  if (!data.done) return { status: 'PROCESSING', progress: data.metadata?.progressPercent };
  const videoUrl = data.response?.videos?.[0]?.gcsUri;
  if (!videoUrl) return { status: 'FAILED', error: 'Veo completed without a video URI.' };
  return { status: 'COMPLETED', progress: 100, videoUrl };
}

export async function downloadVideo(gcsUri: string, apiKey: string): Promise<Buffer> {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Unsupported Veo output URI: ${gcsUri}`);
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(match[1])}/o/${encodeURIComponent(match[2])}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`Could not download Veo output (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export function getEstimatedCost(duration: number, quality = 'standard'): number {
  return duration * (quality === 'high' ? 0.08 : 0.05);
}

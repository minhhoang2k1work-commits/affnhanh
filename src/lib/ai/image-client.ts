const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

export interface GenerateReferenceImageParams {
  prompt: string;
  apiKey: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
}

function imageSize(aspectRatio: GenerateReferenceImageParams['aspectRatio']): string {
  if (aspectRatio === '16:9') return '1536x1024';
  if (aspectRatio === '1:1') return '1024x1024';
  return '1024x1536';
}

export async function generateReferenceImage(params: GenerateReferenceImageParams): Promise<string> {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: params.prompt,
      size: imageSize(params.aspectRatio),
      quality: 'medium',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI image API error (${response.status}): ${detail || response.statusText}`);
  }

  const payload = await response.json();
  const image = payload?.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  throw new Error('OpenAI image API returned no image.');
}

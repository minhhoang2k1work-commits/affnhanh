export interface GenerateScriptParams {
  productName: string;
  productDescription: string;
  style: string;
  duration: number;
  language: string;
  apiKey: string;
}

export interface ScriptSection {
  type: 'intro' | 'highlight' | 'demo' | 'testimonial' | 'cta';
  content: string;
  visualDescription: string;
  duration: number;
}

export interface ScriptResponse {
  title: string;
  hook: string;
  sections: ScriptSection[];
  callToAction: string;
  totalDuration: number;
}

export interface CharacterBible {
  id: string;
  name: string;
  role: string;
  appearance: string;
  wardrobe: string;
  signatureDetails: string;
  referencePrompt: string;
}

export interface StyleBible {
  visualStyle: string;
  palette: string;
  lighting: string;
  aspectRatio: string;
  continuityRules: string;
  negativePrompt: string;
}

export interface GenerateStoryboardParams {
  script: ScriptResponse;
  duration: number;
  style: string;
  apiKey: string;
}

export interface StoryboardScene {
  sceneNumber: number;
  visualPrompt: string;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
  narration: string;
  cameraAngle: string;
  duration: number;
  transition: string;
  characterIds: string[];
  setting: string;
  continuityNotes: string;
}

export interface StoryboardResponse {
  styleBible: StyleBible;
  characters: CharacterBible[];
  scenes: StoryboardScene[];
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.4-mini';

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI returned no text output.');
}

async function createStructuredResponse<T>(params: {
  apiKey: string;
  name: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
}): Promise<T> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      input: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: params.name,
          schema: params.schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI API error (${response.status}): ${detail || response.statusText}`);
  }

  return JSON.parse(extractOutputText(await response.json())) as T;
}

const scriptSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hook: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['intro', 'highlight', 'demo', 'testimonial', 'cta'] },
          content: { type: 'string' },
          visualDescription: { type: 'string' },
          duration: { type: 'number' },
        },
        required: ['type', 'content', 'visualDescription', 'duration'],
        additionalProperties: false,
      },
    },
    callToAction: { type: 'string' },
    totalDuration: { type: 'number' },
  },
  required: ['title', 'hook', 'sections', 'callToAction', 'totalDuration'],
  additionalProperties: false,
};

const storyboardSchema = {
  type: 'object',
  properties: {
    styleBible: {
      type: 'object',
      properties: {
        visualStyle: { type: 'string' },
        palette: { type: 'string' },
        lighting: { type: 'string' },
        aspectRatio: { type: 'string' },
        continuityRules: { type: 'string' },
        negativePrompt: { type: 'string' },
      },
      required: ['visualStyle', 'palette', 'lighting', 'aspectRatio', 'continuityRules', 'negativePrompt'],
      additionalProperties: false,
    },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          appearance: { type: 'string' },
          wardrobe: { type: 'string' },
          signatureDetails: { type: 'string' },
          referencePrompt: { type: 'string' },
        },
        required: ['id', 'name', 'role', 'appearance', 'wardrobe', 'signatureDetails', 'referencePrompt'],
        additionalProperties: false,
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sceneNumber: { type: 'number' },
          visualPrompt: { type: 'string' },
          imagePrompt: { type: 'string' },
          videoPrompt: { type: 'string' },
          negativePrompt: { type: 'string' },
          narration: { type: 'string' },
          cameraAngle: { type: 'string' },
          duration: { type: 'number' },
          transition: { type: 'string' },
          characterIds: { type: 'array', items: { type: 'string' } },
          setting: { type: 'string' },
          continuityNotes: { type: 'string' },
        },
        required: [
          'sceneNumber', 'visualPrompt', 'imagePrompt', 'videoPrompt', 'negativePrompt', 'narration',
          'cameraAngle', 'duration', 'transition', 'characterIds', 'setting', 'continuityNotes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['styleBible', 'characters', 'scenes'],
  additionalProperties: false,
};

export async function generateScript(params: GenerateScriptParams): Promise<ScriptResponse> {
  return createStructuredResponse<ScriptResponse>({
    apiKey: params.apiKey,
    name: 'video_script',
    schema: scriptSchema,
    system: [
      'You are the creative director and conversion-focused scriptwriter for short vertical videos.',
      `Write in ${params.language}. Target duration: ${params.duration} seconds. Tone/style: ${params.style}.`,
      'Use a strong first-three-second hook, a clear narrative arc, natural spoken copy, and one concrete CTA.',
    ].join(' '),
    user: `Product or story brief: ${params.productName}\nDetails: ${params.productDescription}`,
  });
}

export async function generateStoryboard(params: GenerateStoryboardParams): Promise<StoryboardResponse> {
  return createStructuredResponse<StoryboardResponse>({
    apiKey: params.apiKey,
    name: 'continuity_storyboard',
    schema: storyboardSchema,
    system: [
      'You are a film director creating a production-ready storyboard for a vertical AI video.',
      'First lock a style bible and immutable character identities. Then write every scene prompt using the exact same identity details.',
      'imagePrompt describes one clean keyframe. videoPrompt describes only motion, camera, timing, facial action, and physics starting from that keyframe.',
      'Keep wardrobe, age, face, hair, props, palette, lighting, spatial direction, and story continuity stable unless the story explicitly changes them.',
      `Target duration: ${params.duration} seconds. Requested style: ${params.style}. Aspect ratio: 9:16.`,
      'Negative prompts must prevent identity drift, extra fingers/limbs, text artifacts, logos, flicker, morphing, and abrupt scene changes.',
    ].join(' '),
    user: JSON.stringify(params.script),
  });
}

export async function enhancePrompt(rawPrompt: string, targetModel: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      input: [
        { role: 'system', content: `Rewrite the prompt for ${targetModel}. Preserve the subject identity and add concise camera, lighting, motion, timing, and continuity instructions. Return only the final prompt.` },
        { role: 'user', content: rawPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
  return extractOutputText(await response.json()).trim();
}

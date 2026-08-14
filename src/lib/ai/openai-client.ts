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

export interface GenerateStoryboardParams {
  script: ScriptResponse;
  duration: number;
  style: string;
  apiKey: string;
}

export interface StoryboardScene {
  sceneNumber: number;
  visualPrompt: string;
  narration: string;
  cameraAngle: string;
  duration: number;
  transition: string;
}

export interface StoryboardResponse {
  scenes: StoryboardScene[];
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function generateScript(params: GenerateScriptParams): Promise<ScriptResponse> {
  const { productName, productDescription, style, duration, language, apiKey } = params;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert video commercial scriptwriter. Generate a script for a ${duration}-second video in ${language}. The style should be ${style}.`
          },
          {
            role: 'user',
            content: `Product: ${productName}\nDescription: ${productDescription}`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'script_schema',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                hook: { type: 'string', description: 'first 3 seconds attention grabber' },
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['intro', 'highlight', 'demo', 'testimonial', 'cta'] },
                      content: { type: 'string' },
                      visualDescription: { type: 'string' },
                      duration: { type: 'number' }
                    },
                    required: ['type', 'content', 'visualDescription', 'duration'],
                    additionalProperties: false
                  }
                },
                callToAction: { type: 'string' },
                totalDuration: { type: 'number' }
              },
              required: ['title', 'hook', 'sections', 'callToAction', 'totalDuration'],
              additionalProperties: false
            },
            strict: true
          }
        },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('generateScript error:', error);
    throw error;
  }
}

export async function generateStoryboard(params: GenerateStoryboardParams): Promise<StoryboardResponse> {
  const { script, duration, style, apiKey } = params;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert storyboard artist. Create a storyboard for a ${duration}-second video commercial. Style: ${style}. Translate the given script into compelling visual scenes.`
          },
          {
            role: 'user',
            content: JSON.stringify(script)
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'storyboard_schema',
            schema: {
              type: 'object',
              properties: {
                scenes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      sceneNumber: { type: 'number' },
                      visualPrompt: { type: 'string' },
                      narration: { type: 'string' },
                      cameraAngle: { type: 'string' },
                      duration: { type: 'number' },
                      transition: { type: 'string' }
                    },
                    required: ['sceneNumber', 'visualPrompt', 'narration', 'cameraAngle', 'duration', 'transition'],
                    additionalProperties: false
                  }
                }
              },
              required: ['scenes'],
              additionalProperties: false
            },
            strict: true
          }
        },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('generateStoryboard error:', error);
    throw error;
  }
}

export async function enhancePrompt(rawPrompt: string, targetModel: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at writing prompts for AI video generators like ${targetModel}. Take the user's raw prompt and enhance it with cinematic details, lighting, and camera instructions for the best output.`
          },
          {
            role: 'user',
            content: rawPrompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('enhancePrompt error:', error);
    throw error;
  }
}

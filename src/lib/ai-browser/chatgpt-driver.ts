import { Page } from 'playwright';

export interface ChatGPTDriverResult {
  response: string;
  parsedJSON?: any;
}

export async function sendPrompt(page: Page, prompt: string): Promise<ChatGPTDriverResult> {
  console.log('Navigating to chatgpt.com...');
  try {
    if (!page.url().includes('chatgpt.com')) {
      await page.goto('https://chatgpt.com', { waitUntil: 'networkidle', timeout: 30000 });
    }

    console.log('Waiting for prompt input...');
    const inputSelector = '#prompt-textarea, div[contenteditable="true"], textarea[data-id="root"]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    
    // Clear any existing text and fill the new prompt
    console.log('Filling prompt...');
    await page.fill(inputSelector, '');
    await page.fill(inputSelector, prompt);

    console.log('Clicking send...');
    const sendButtonSelector = 'button[data-testid="send-button"], button[aria-label="Send prompt"]';
    await page.waitForSelector(sendButtonSelector, { timeout: 5000 });
    await page.click(sendButtonSelector);

    console.log('Waiting for response to start streaming...');
    // Wait a moment for generation to start and stop button to appear
    await page.waitForTimeout(2000);

    console.log('Waiting for generation to complete...');
    // We can check if the send button reappears, or if the stop button disappears.
    // Let's poll for the send button to be visible again, which means generation stopped.
    let isGenerating = true;
    let attempts = 0;
    while (isGenerating && attempts < 120) { // Up to 2 minutes
      const sendButtonVisible = await page.isVisible(sendButtonSelector);
      if (sendButtonVisible) {
        isGenerating = false;
      } else {
        await page.waitForTimeout(1000);
        attempts++;
      }
    }

    if (attempts >= 120) {
      console.warn('Timeout waiting for response generation to complete.');
    }

    console.log('Extracting response...');
    const responseSelectors = 'div[data-message-author-role="assistant"], .markdown.prose';
    const responseElements = await page.$$(responseSelectors);
    
    if (responseElements.length === 0) {
      throw new Error('No assistant response found.');
    }

    const lastResponse = responseElements[responseElements.length - 1];
    const responseText = await lastResponse.innerText();
    
    console.log('Response successfully extracted.');
    let parsedJSON;
    try {
      parsedJSON = extractJSON(responseText);
    } catch (e) {
      console.log('No valid JSON extracted from response.');
    }

    return {
      response: responseText,
      parsedJSON
    };
  } catch (error) {
    console.error('Error in sendPrompt:', error);
    throw error;
  }
}

export function extractJSON(responseText: string): any {
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = responseText.match(jsonBlockRegex);
  
  if (match && match[1]) {
    return JSON.parse(match[1].trim());
  }
  
  // Attempt to parse the whole text if no code block found
  try {
    return JSON.parse(responseText.trim());
  } catch (e) {
    throw new Error('Could not parse JSON from the response text.');
  }
}

export function buildScriptPrompt(params: {
  productName: string;
  productDescription: string;
  style: string;
  duration: number;
  language: string;
}): string {
  return `
You are a professional video script writer. Please generate a highly engaging video script for the following product:

Product Name: ${params.productName}
Description: ${params.productDescription}
Style/Tone: ${params.style}
Target Duration: ${params.duration} seconds
Language: ${params.language}

Your output MUST be entirely in valid JSON format, without any markdown formatting around it if possible, but if you must, use \`\`\`json block. The JSON should match this TypeScript interface:

{
  "title": "String - A catchy title for the video",
  "hook": "String - The opening hook to grab attention",
  "sections": [
    {
      "type": "String - e.g., 'intro', 'problem', 'solution', 'features', 'outro'",
      "content": "String - The actual spoken text or on-screen text",
      "visualDescription": "String - What should be seen on screen",
      "duration": "Number - Estimated duration of this section in seconds"
    }
  ],
  "callToAction": "String - The final call to action",
  "totalDuration": "Number - Should be close to the target duration"
}
`.trim();
}

export function buildStoryboardPrompt(params: {
  script: any;
  duration: number;
  style: string;
}): string {
  return `
Based on the following video script, create a detailed storyboard. The visual style should be: ${params.style}. Total duration is approximately ${params.duration} seconds.

Script:
${JSON.stringify(params.script, null, 2)}

Your output MUST be entirely in valid JSON format. The JSON should match this structure:

{
  "scenes": [
    {
      "sceneNumber": "Number - Sequential scene number",
      "visualPrompt": "String - Detailed prompt for an AI video/image generator describing the visual",
      "narration": "String - Corresponding voiceover or text",
      "cameraAngle": "String - E.g., Close up, Wide shot, Panning",
      "duration": "Number - Duration in seconds",
      "transition": "String - E.g., Cut, Fade in, Swipe"
    }
  ]
}
`.trim();
}

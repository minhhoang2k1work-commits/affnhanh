import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface AIStudioBrowserResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export async function generateVideo(page: Page, params: {
  prompt: string;
}): Promise<AIStudioBrowserResult> {
  console.log('Starting Google AI Studio (Veo) video generation...');
  try {
    if (!page.url().includes('aistudio.google.com')) {
      await page.goto('https://aistudio.google.com', { waitUntil: 'networkidle', timeout: 30000 });
    }

    const promptInput = 'textarea, [contenteditable="true"]';
    await page.waitForSelector(promptInput, { timeout: 15000 });
    await page.fill(promptInput, params.prompt);

    const generateBtn = 'button:has-text("Generate"), button:has-text("Run")';
    await page.waitForSelector(generateBtn, { timeout: 5000 });
    await page.click(generateBtn);

    console.log('Generation request submitted.');
    await page.waitForTimeout(2000);

    return { status: 'pending' };
  } catch (error: any) {
    console.error('Error in generateVideo:', error);
    return { status: 'failed', error: error.message };
  }
}

export async function waitAndDownload(page: Page, outputDir: string): Promise<string | null> {
  console.log('Waiting for AI Studio generation to complete and download...');
  try {
    let attempts = 0;
    let videoUrl: string | null = null;
    
    while (attempts < 60) {
      const hasError = await page.isVisible('.error-message-class');
      if (hasError) {
        console.error('Generation failed in UI.');
        return null;
      }

      const videoElement = await page.$('video');
      if (videoElement) {
        const src = await videoElement.getAttribute('src');
        if (src) {
          videoUrl = src;
          break;
        }
      }
      
      await page.waitForTimeout(5000);
      attempts++;
    }

    if (!videoUrl) {
      console.warn('Timeout waiting for video to be generated.');
      return null;
    }

    console.log('Video generated. Fetching data...');
    const base64Data = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }, videoUrl);

    const base64Video = base64Data.split(',')[1];
    const buffer = Buffer.from(base64Video, 'base64');
    const filename = `veo_video_${Date.now()}.mp4`;
    const filepath = path.join(outputDir, filename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filepath, buffer);
    console.log(`Successfully downloaded to ${filepath}`);
    
    return filepath;
  } catch (error) {
    console.error('Error in waitAndDownload:', error);
    return null;
  }
}

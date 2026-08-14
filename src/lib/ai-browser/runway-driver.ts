import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface RunwayBrowserResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export async function createGeneration(page: Page, params: {
  prompt: string;
  imageUrl?: string;
  duration?: number;
}): Promise<RunwayBrowserResult> {
  console.log('Starting Runway generation...');
  try {
    if (!page.url().includes('app.runwayml.com')) {
      await page.goto('https://app.runwayml.com', { waitUntil: 'networkidle', timeout: 30000 });
    }

    const promptInputSelector = 'textarea[name="prompt"], [data-testid="prompt-input"]';
    await page.waitForSelector(promptInputSelector, { timeout: 15000 });
    await page.fill(promptInputSelector, params.prompt);

    const generateButton = 'button:has-text("Generate"), [data-testid="generate-button"]';
    await page.waitForSelector(generateButton);
    await page.click(generateButton);

    console.log('Generation started.');
    await page.waitForTimeout(2000);

    return { status: 'pending' };
  } catch (error: any) {
    console.error('Error starting Runway generation:', error);
    return { status: 'failed', error: error.message };
  }
}

export async function checkGenerationStatus(page: Page): Promise<RunwayBrowserResult> {
  console.log('Checking Runway generation status...');
  try {
    const isCompleted = await page.isVisible('video.result-video'); 
    const isFailed = await page.isVisible('.error-state');

    if (isCompleted) {
      const videoUrl = await page.getAttribute('video.result-video', 'src');
      return { status: 'completed', videoUrl: videoUrl || undefined };
    }

    if (isFailed) {
      return { status: 'failed', error: 'Generation failed or returned an error.' };
    }

    return { status: 'processing' };
  } catch (error: any) {
    console.error('Error checking status:', error);
    return { status: 'failed', error: error.message };
  }
}

export async function downloadResult(page: Page, outputDir: string): Promise<string | null> {
  console.log('Downloading Runway generation result...');
  try {
    const status = await checkGenerationStatus(page);
    if (status.status !== 'completed' || !status.videoUrl) {
      console.log('Result not ready for download.');
      return null;
    }

    const url = status.videoUrl;
    
    const base64Data = await page.evaluate(async (videoUrl) => {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }, url);

    const base64Video = base64Data.split(',')[1];
    const buffer = Buffer.from(base64Video, 'base64');
    const filename = `runway_video_${Date.now()}.mp4`;
    const filepath = path.join(outputDir, filename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filepath, buffer);
    console.log(`Successfully downloaded to ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Error downloading result:', error);
    return null;
  }
}

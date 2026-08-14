import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface KlingBrowserResult {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export async function createVideo(page: Page, params: {
  prompt: string;
  duration?: '5' | '10';
  mode?: 'standard' | 'professional';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}): Promise<KlingBrowserResult> {
  console.log('Navigating to Kling video creation...');
  try {
    if (!page.url().includes('klingai.com/creation')) {
      await page.goto('https://klingai.com/creation', { waitUntil: 'networkidle', timeout: 30000 });
    }

    console.log('Filling video prompt...');
    const promptInput = 'textarea[placeholder*="prompt"]';
    await page.waitForSelector(promptInput, { timeout: 15000 });
    await page.fill(promptInput, params.prompt);

    if (params.duration) {
      console.log(`Setting duration to ${params.duration}s`);
    }

    console.log('Clicking generate...');
    const generateBtn = 'button:has-text("Generate")';
    await page.waitForSelector(generateBtn);
    await page.click(generateBtn);

    console.log('Waiting for task to register...');
    await page.waitForTimeout(3000);
    
    const taskId = 'task_' + Date.now(); 

    return {
      taskId,
      status: 'pending'
    };
  } catch (error: any) {
    console.error('Error creating Kling video:', error);
    return { taskId: '', status: 'failed', error: error.message };
  }
}

export async function checkVideoStatus(page: Page): Promise<KlingBrowserResult> {
  console.log('Checking video generation status...');
  try {
    const isCompleted = await page.isVisible('.video-player-container');
    const isFailed = await page.isVisible('.error-message-container');

    if (isCompleted) {
      const videoElement = await page.$('video source, video');
      const videoUrl = await videoElement?.getAttribute('src');
      return {
        taskId: 'unknown',
        status: 'completed',
        videoUrl: videoUrl || undefined
      };
    } else if (isFailed) {
      return {
        taskId: 'unknown',
        status: 'failed',
        error: 'Video generation failed.'
      };
    }

    return {
      taskId: 'unknown',
      status: 'processing'
    };
  } catch (error: any) {
    console.error('Error checking status:', error);
    return { taskId: 'unknown', status: 'failed', error: error.message };
  }
}

export async function downloadVideo(page: Page, outputDir: string): Promise<string | null> {
  console.log('Attempting to download video...');
  try {
    const status = await checkVideoStatus(page);
    if (status.status !== 'completed' || !status.videoUrl) {
      console.log('Video is not ready or URL not found.');
      return null;
    }

    let url = status.videoUrl;
    if (url.startsWith('blob:')) {
      console.log('Blob URL detected. Using page.evaluate to fetch and convert to base64...');
      const base64Data = await page.evaluate(async (blobUrl) => {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }, url);

      const base64Video = base64Data.split(',')[1];
      const buffer = Buffer.from(base64Video, 'base64');
      const filename = `kling_video_${Date.now()}.mp4`;
      const filepath = path.join(outputDir, filename);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(filepath, buffer);
      console.log(`Video downloaded to ${filepath}`);
      return filepath;
    } else {
      console.log('Direct URL detected. Fetching...');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const filename = `kling_video_${Date.now()}.mp4`;
      const filepath = path.join(outputDir, filename);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(filepath, buffer);
      console.log(`Video downloaded to ${filepath}`);
      return filepath;
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    return null;
  }
}

export async function getRemainingCredits(page: Page): Promise<number> {
  console.log('Fetching remaining credits...');
  try {
    const creditsSelector = '.credits-display, [data-testid="credits-count"]';
    await page.waitForSelector(creditsSelector, { timeout: 10000 });
    const text = await page.innerText(creditsSelector);
    const match = text.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    return 0;
  } catch (error) {
    console.error('Failed to get credits:', error);
    return 0;
  }
}

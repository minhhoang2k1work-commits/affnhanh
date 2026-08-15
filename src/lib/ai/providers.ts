import { db } from '@/lib/db';
import { decryptText } from '@/lib/crypto';
import * as openaiClient from './openai-client';
import * as veoClient from './veo-client';
import * as klingClient from './kling-client';
import * as runwayClient from './runway-client';
import * as voiceoverClient from './voiceover-client';
import * as imageClient from './image-client';

export type ProviderType = 'llm' | 'video' | 'image' | 'voiceover';
export type ProviderMode = 'api' | 'browser';

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  mode: ProviderMode;
  apiKey?: string;           // Decrypted API key (api mode)
  browserSessionValid?: boolean; // Session status (browser mode)
  userId: string;
  config?: Record<string, any>;
}

export class AIProviderManager {
  private static instance: AIProviderManager;

  private constructor() {}

  public static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  /**
   * Get provider config, supporting both API and browser modes.
   * For API mode: returns decrypted apiKey
   * For browser mode: returns browserSessionValid status
   */
  public async getProviderConfig(type: ProviderType, providerName?: string): Promise<ProviderConfig> {
    try {
      const query: any = { type, isActive: true };
      if (providerName) {
        query.name = providerName;
      }
      
      const provider = await db.aIProvider.findFirst({
        where: query,
        orderBy: { updatedAt: 'desc' }
      });

      if (!provider) {
        throw new Error(`No active provider found for type: ${type}`);
      }

      const config: ProviderConfig = {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        mode: (provider.mode as ProviderMode) || 'api',
        userId: provider.userId,
        config: (provider.config as Record<string, any>) || {},
      };

      if (provider.mode === 'browser') {
        config.browserSessionValid = provider.browserSessionValid;
        if (!provider.browserSessionValid) {
          throw new Error(`Browser session is not valid for ${provider.name}. Please re-login.`);
        }
      } else {
        // API mode
        if (!provider.apiKeyEnc) {
          throw new Error(`API key is missing for provider: ${provider.name}`);
        }
        config.apiKey = await decryptText(provider.apiKeyEnc);
      }

      return config;
    } catch (error) {
      console.error('Error fetching provider config:', error);
      throw error;
    }
  }

  /**
   * Detect if browser mode is available for a type.
   * Returns the browser provider if found, null otherwise.
   */
  public async getBrowserProvider(type: ProviderType): Promise<ProviderConfig | null> {
    try {
      const provider = await db.aIProvider.findFirst({
        where: {
          type,
          mode: 'browser',
          isActive: true,
          browserSessionValid: true,
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (!provider) return null;

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        mode: 'browser',
        browserSessionValid: true,
        userId: provider.userId,
        config: (provider.config as Record<string, any>) || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Get provider with fallback: try browser first, then API.
   * This allows zero-cost operation when browser sessions are active.
   */
  public async getProviderWithFallback(type: ProviderType, preferredName?: string): Promise<ProviderConfig> {
    // First try browser mode (free)
    const browserProvider = await this.getBrowserProvider(type);
    if (browserProvider) {
      console.log(`[AI] Using browser mode for ${type}: ${browserProvider.name}`);
      return browserProvider;
    }

    // Fall back to API mode
    return this.getProviderConfig(type, preferredName);
  }

  public async getLLMClient() {
    const config = await this.getProviderConfig('llm', 'openai');
    return {
      generateScript: (params: Omit<openaiClient.GenerateScriptParams, 'apiKey'>) => openaiClient.generateScript({ ...params, apiKey: config.apiKey! }),
      generateStoryboard: (params: Omit<openaiClient.GenerateStoryboardParams, 'apiKey'>) => openaiClient.generateStoryboard({ ...params, apiKey: config.apiKey! }),
      enhancePrompt: (rawPrompt: string, targetModel: string) => openaiClient.enhancePrompt(rawPrompt, targetModel, config.apiKey!),
    };
  }

  public async getImageClient() {
    let config: ProviderConfig;
    try {
      config = await this.getProviderConfig('image', 'openai');
    } catch {
      // Reuse the OpenAI LLM credential so users do not have to save the same key twice.
      config = await this.getProviderConfig('llm', 'openai');
    }
    if (config.mode !== 'api' || !config.apiKey) {
      throw new Error('OpenAI image generation requires an API key.');
    }
    return {
      generateReferenceImage: (params: Omit<imageClient.GenerateReferenceImageParams, 'apiKey'>) =>
        imageClient.generateReferenceImage({ ...params, apiKey: config.apiKey! }),
      providerName: 'openai_image',
    };
  }

  public async getVideoClient(preferredProvider?: string) {
    const config = await this.getProviderConfig('video', preferredProvider);

    if (!config.apiKey) {
      throw new Error(`API key required for video provider: ${config.name}`);
    }
    
    switch (config.name) {
      case 'google_veo':
        return {
          generateVideo: (params: Omit<veoClient.VeoGenerateParams, 'apiKey'>) => veoClient.generateVideo({ ...config.config, ...params, apiKey: config.apiKey! }),
          checkStatus: (params: Omit<veoClient.VeoStatusParams, 'apiKey'>) => veoClient.checkStatus({ ...config.config, ...params, apiKey: config.apiKey! }),
          downloadVideo: (gcsUri: string) => veoClient.downloadVideo(gcsUri, config.apiKey!),
          getEstimatedCost: veoClient.getEstimatedCost,
          providerName: 'google_veo'
        };
      case 'kling':
        return {
          generateVideo: (params: Omit<klingClient.KlingGenerateParams, 'apiKey'>) => klingClient.generateVideo({ ...params, apiKey: config.apiKey! }),
          checkStatus: (params: Omit<klingClient.KlingStatusParams, 'apiKey'>) => klingClient.checkStatus({ ...params, apiKey: config.apiKey! }),
          getEstimatedCost: klingClient.getEstimatedCost,
          providerName: 'kling'
        };
      case 'runway':
        return {
          generateVideo: (params: Omit<runwayClient.RunwayGenerateParams, 'apiKey'>) => runwayClient.generateVideo({ ...params, apiKey: config.apiKey!, model: config.config?.model }),
          checkStatus: (params: Omit<runwayClient.RunwayStatusParams, 'apiKey'>) => runwayClient.checkStatus({ ...params, apiKey: config.apiKey! }),
          getEstimatedCost: runwayClient.getEstimatedCost,
          providerName: 'runway'
        };
      default:
        throw new Error(`Unsupported video provider: ${config.name}`);
    }
  }

  public async getVoiceoverClient() {
    const config = await this.getProviderConfig('voiceover', 'elevenlabs');
    return {
      generateVoiceover: (params: Omit<voiceoverClient.GenerateVoiceoverParams, 'apiKey'>) => voiceoverClient.generateVoiceover({ ...params, apiKey: config.apiKey! }),
      listVoices: () => voiceoverClient.listVoices(config.apiKey!),
      getEstimatedCost: voiceoverClient.getEstimatedCost,
      providerName: 'elevenlabs'
    };
  }
}

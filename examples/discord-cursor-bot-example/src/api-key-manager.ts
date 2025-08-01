/**
 * API Key Management for Discord Cursor Bot.
 * Handles secure storage and retrieval of Cursor API keys by Discord channel ID.
 * Each Discord channel can have its own API key for team isolation.
 */

import type { ChannelApiKey } from './types';
import { CursorApiService } from './cursor-service';

/**
 * Manages Cursor API keys stored in Cloudflare KV storage.
 * Keys are stored by Discord channel ID to allow different channels/teams to use different API keys.
 */
export class ApiKeyManager {
  constructor(private readonly kv: KVNamespace) {
    if (!kv) {
      throw new Error('KV namespace is required for API key management');
    }
  }

  /**
   * Store a Cursor API key for a specific Discord channel
   */
  async setApiKey(channelId: string, apiKey: string): Promise<void> {
    if (!channelId || !apiKey) {
      throw new Error('Channel ID and API key are required');
    }

    const keyData: ChannelApiKey = {
      channelId,
      apiKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const storageKey = this.getStorageKey(channelId);
    await this.kv.put(storageKey, JSON.stringify(keyData));
    
    console.log(`🔑 Stored API key for channel ${channelId}`);
  }

  /**
   * Retrieve the Cursor API key for a specific Discord channel
   */
  async getApiKey(channelId: string): Promise<string | null> {
    if (!channelId) {
      return null;
    }

    const storageKey = this.getStorageKey(channelId);
    const data = await this.kv.get(storageKey);
    
    if (!data) {
      return null;
    }

    try {
      const keyData = JSON.parse(data) as ChannelApiKey;
      return keyData.apiKey;
    } catch (error) {
      console.error(`❌ Error parsing API key data for channel ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Delete the API key for a specific Discord channel
   */
  async deleteApiKey(channelId: string): Promise<void> {
    if (!channelId) {
      return;
    }

    const storageKey = this.getStorageKey(channelId);
    await this.kv.delete(storageKey);
    
    console.log(`🗑️ Deleted API key for channel ${channelId}`);
  }

  /**
   * Validate a Cursor API key by testing it against the Cursor API
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey) {
      return false;
    }

    try {
      const service = new CursorApiService(apiKey);
      const isValid = await service.validateApiKey();
      
      console.log(`🔍 API key validation ${isValid ? 'passed' : 'failed'}`);
      return isValid;
    } catch (error) {
      console.error('❌ Error validating API key:', error);
      return false;
    }
  }

  /**
   * Get metadata about the stored API key (without exposing the key itself)
   */
  async getApiKeyMetadata(channelId: string): Promise<Omit<ChannelApiKey, 'apiKey'> | null> {
    if (!channelId) {
      return null;
    }

    const storageKey = this.getStorageKey(channelId);
    const data = await this.kv.get(storageKey);
    
    if (!data) {
      return null;
    }

    try {
      const keyData = JSON.parse(data) as ChannelApiKey;
      return {
        channelId: keyData.channelId,
        createdAt: keyData.createdAt,
        updatedAt: keyData.updatedAt,
      };
    } catch (error) {
      console.error(`❌ Error parsing API key metadata for channel ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Check if a channel has an API key configured
   */
  async hasApiKey(channelId: string): Promise<boolean> {
    const apiKey = await this.getApiKey(channelId);
    return apiKey !== null;
  }

  /**
   * List all channels that have API keys configured (for admin purposes)
   */
  async listChannelsWithApiKeys(): Promise<string[]> {
    const channels: string[] = [];
    
    try {
      // KV doesn't have a built-in way to list keys by prefix efficiently,
      // so this is a basic implementation. For production, consider using
      // a separate index or D1 database to track which channels have keys.
      const list = await this.kv.list({ prefix: 'channel:' });
      
      for (const key of list.keys) {
        if (key.name.endsWith(':api_key')) {
          const channelId = key.name.replace('channel:', '').replace(':api_key', '');
          channels.push(channelId);
        }
      }
    } catch (error) {
      console.error('❌ Error listing channels with API keys:', error);
    }
    
    return channels;
  }

  /**
   * Generate the KV storage key for a channel's API key
   */
  private getStorageKey(channelId: string): string {
    return `channel:${channelId}:api_key`;
  }
}

/**
 * Create an ApiKeyManager instance with the given KV namespace
 */
export function createApiKeyManager(kv: KVNamespace): ApiKeyManager {
  return new ApiKeyManager(kv);
}

/**
 * Get the API key for a channel, with fallback to default if not found
 */
export async function getEffectiveApiKey(
  channelId: string, 
  keyManager: ApiKeyManager, 
  defaultApiKey?: string
): Promise<string | null> {
  // First try to get channel-specific API key
  const channelApiKey = await keyManager.getApiKey(channelId);
  if (channelApiKey) {
    return channelApiKey;
  }

  // Fall back to default API key if available
  if (defaultApiKey) {
    console.log(`🔄 Using default API key for channel ${channelId}`);
    return defaultApiKey;
  }

  return null;
}
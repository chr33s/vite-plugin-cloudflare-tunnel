/**
 * Cursor Background Agents API service.
 * Handles all interactions with the Cursor API for agent management.
 */

import type { 
  CreateAgentInput, 
  Agent, 
  ListAgentsResponse,
  CursorApiError 
} from './cursor-api-types';

/**
 * Service class for interacting with the Cursor Background Agents API
 */
export class CursorApiService {
  private readonly baseUrl = 'https://api.cursor.com';

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('Cursor API key is required');
    }
  }

  /**
   * Make an authenticated API call to the Cursor API
   */
  private async apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    console.log('🔄 Making API call to:', options.method ?? 'GET', url, JSON.stringify(options.body, null, 2));
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorBody = await response.text();
        if (errorBody) {
          try {
            const errorJson = JSON.parse(errorBody) as CursorApiError;
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            errorMessage = errorBody;
          }
        }
      } catch {
        // Ignore error parsing errors
      }
      
      throw new Error(`Cursor API error: ${errorMessage}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a new Cursor agent
   */
  async createAgent(input: CreateAgentInput): Promise<Agent> {
    console.log('🤖 Creating Cursor agent:', {
      prompt: input.prompt.text.substring(0, 100) + '...',
      repository: input.source.repository,
      model: input.model,
      webhook: input.webhook ? 'configured' : 'none'
    });

    return this.apiCall<Agent>('/v0/agents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    return this.apiCall<Agent>(`/v0/agents/${id}`);
  }

  /**
   * List agents with pagination
   */
  async listAgents(pageSize?: number, cursor?: string): Promise<ListAgentsResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (pageSize) params.set('limit', String(pageSize));

    const queryString = params.toString();
    const path = `/v0/agents${queryString ? `?${queryString}` : ''}`;
    
    return this.apiCall<ListAgentsResponse>(path);
  }

  /**
   * Get agent conversation logs
   */
  async getAgentConversation(id: string): Promise<{ messages: any[] }> {
    return this.apiCall<{ messages: any[] }>(`/v0/agents/${id}/conversation`);
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(id: string): Promise<{ logs: string[] }> {
    return this.apiCall<{ logs: string[] }>(`/v0/agents/${id}/logs`);
  }

  /**
   * Get available models
   */
  async getModels(): Promise<{ models: string[] }> {
    return this.apiCall<{ models: string[] }>('/v0/models');
  }

  /**
   * Add followup to an agent
   */
  async addFollowup(id: string, prompt: { text: string, images: Array<{ data: string, dimension?: { width: number, height: number } }> }): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>(`/v0/agents/${id}/followup`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  /**
   * Send follow-up message to an agent (alias for addFollowup for consistency with plan)
   */
  async sendFollowUpMessage(agentId: string, message: string): Promise<{ id: string }> {
    console.log(`🔄 sending follow-up message to agent ${agentId}:`, message.substring(0, 100) + '...');
    return this.addFollowup(agentId, { text: message, images: [] });
  }

  /**
   * Validate API key by attempting to list models
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }
}

/**
 * Create a Cursor API service instance with the given API key
 */
export function createCursorApiService(apiKey: string): CursorApiService {
  return new CursorApiService(apiKey);
}

/**
 * Build CreateAgentInput from Discord command parameters
 */
export function buildCreateAgentInput(
  prompt: string,
  repository: `https://github.com/${string}`,
  model?: string,
  webhookUrl?: string
): CreateAgentInput {
  const input: CreateAgentInput = {
    prompt: {
      text: prompt,
      images: [] // Discord bot doesn't support images yet
    },
    source: {
      repository
      // Omit ref to use default branch
    },
    target: {
      autoCreatePr: true
      // Omit branchName to let Cursor choose
    }
  };

  // Add model if provided
  if (model) {
    input.model = model;
  }

  // Add webhook if provided
  if (webhookUrl) {
    input.webhook = {
      url: webhookUrl
    };
  }

  return input;
}
/**
 * Cursor Background Agents - Cloudflare Worker
 * 
 * This worker provides an API for interacting with Cursor's Background Agents
 * and handles webhook notifications from the Cursor API.
 */

import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';
import type { 
  StoredAgent, 
  ServiceInfo, 
  CreateAgentInput, 
  Agent, 
  CursorWebhookEvent,
  AgentsResponse,
  HealthResponse,
  TunnelUrlResponse,
  CursorApiError
} from "./types";

// Cloudflare D1 types
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }
  
  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T[]>>;
  }
  
  interface D1Result<T = unknown> {
    results?: T;
    success: boolean;
    meta: {
      duration: number;
      changes: number;
      last_row_id: number;
      rows_read: number;
      rows_written: number;
    };
    changes: number;
  }
}

/**
 * Environment variables interface for the Cloudflare Worker
 */
interface Env {
  CURSOR_API_KEY?: string;
  WEBHOOK_SECRET?: string;
  DB: D1Database;
}

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cursor-Signature',
} as const;

// In-memory storage for development (in production, use database only)
let inMemoryApiKey: string | null = null;
let inMemoryWebhookSecret: string | null = null;

/**
 * Get the effective Cursor API key (from environment or memory)
 */
function getCursorApiKey(env: Env): string | null {
  return env.CURSOR_API_KEY || inMemoryApiKey;
}

/**
 * Get the effective webhook secret (from environment or memory)
 */
function getWebhookSecret(env: Env): string | null {
  return env.WEBHOOK_SECRET || inMemoryWebhookSecret;
}

/**
 * Check if we're in development mode
 */
function isDevelopmentMode(): boolean {
  // Check various indicators that we're in development
  return (globalThis as any).process?.env?.NODE_ENV === 'development' || (globalThis as any).process?.env?.DEV === 'true' ||
         !!(globalThis as any).__VITE_DEV__;
}

let _databaseInitialized = false;
/**
 * Initialize the database with required tables
 */
async function initializeDatabase(env: Env): Promise<void> {
  if (_databaseInitialized) return;
  
  try {
    // Create agents table if it doesn't exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        repository TEXT NOT NULL,
        model TEXT,
        branch_name TEXT,
        pr_url TEXT,
        summary TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();

    // Create webhook_events table if it doesn't exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        raw_event TEXT NOT NULL
      )
    `).run();

    // Create agent_logs table if it doesn't exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agent_logs (
        agent_id TEXT PRIMARY KEY,
        logs TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();

    _databaseInitialized = true;
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Cursor API service class
 */
class CursorApiService {
  constructor(private apiKey: string) {}

  /**
   * Make a request to the Cursor API
   */
  private async apiCall<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `https://api.cursor.com${path}`;
    
    console.log('🔒 API Call:', url, { ...options });
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Cursor API ${options.method ?? 'GET'} ${url} ${response.status}: ${errorText}`;

      try {
        const errorData = JSON.parse(errorText) as CursorApiError;
        errorMessage = `Cursor API ${options.method ?? 'GET'} ${url} ${response.status}: ${JSON.stringify(errorData, null, 2)}`;
      } catch {
        // Keep original error message if JSON parsing fails
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Create a new Cursor agent
   */
  async createAgent(input: CreateAgentInput, webhookUrl?: string): Promise<Agent> {
    const requestBody: CreateAgentInput = {
      ...input,
    };


    if (webhookUrl) {
      requestBody.webhook = {
        url: webhookUrl,
      };
    }

    return this.apiCall<Agent>('/v0/agents', {
            method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  /**
   * List agents with pagination
   */
  async listAgents(pageSize?: number, cursor?: string): Promise<{ agents: Agent[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    pageSize = pageSize && !isNaN(pageSize) && pageSize > 0 ? pageSize : 100;
    params.set('limit', String(pageSize));

    const queryString = params.toString();
    const path = `/v0/agents${queryString ? `?${queryString}` : ''}`;
    
    return this.apiCall<{ agents: Agent[]; nextCursor?: string }>(path);
  }

  /**
   * Get a specific agent
   */
  async getAgent(id: string): Promise<Agent> {
    return this.apiCall<Agent>(`/v0/agents/${id}`);
  }

  /**
   * Get agent conversation (messages)
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
   * List available models
   */
  async getModels(): Promise<{ models: string[] }> {
    return this.apiCall<{ models: string[] }>(`/v0/models`);
  }

  /**
   * Add followup to an agent
   */
  async addFollowup(id: string, prompt: string): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>(`/v0/agents/${id}/followup`, {
            method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }
}

/**
 * Agent storage service
 */
class AgentStorageService {
  constructor(private db: D1Database) {}

  /**
   * Store an agent in the database
   */
  async storeAgent(agent: Agent): Promise<StoredAgent> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO agents (
        id, status, prompt, repository, model, branch_name, pr_url, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agent.id,
      agent.status,
      agent.prompt?.text || '',
      agent.source?.repository || '',
      agent.model || null,
      agent.branchName || null,
      agent.prUrl || null,
      agent.error || null,
      agent.createdAt || now,
      now
    ).run();

    return {
      id: agent.id,
      timestamp: now,
      status: agent.status,
      prompt: agent.prompt?.text || '',
      repository: agent.source?.repository || '',
    };
  }

  /**
   * Get all stored agents
   */
  async getStoredAgents(): Promise<StoredAgent[]> {
    const result = await this.db.prepare(`
      SELECT * FROM agents ORDER BY created_at DESC
    `).all<any>();

    return (result.results || []).map(row => ({
      id: row.id,
      timestamp: row.created_at,
      status: row.status,
      prompt: row.prompt,
      repository: row.repository,
      model: row.model,
      branchName: row.branch_name,
      prUrl: row.pr_url,
      error: row.error,
    }));
  }

  /**
   * Update agent status
   */
  async updateAgentStatus({agentId, status, error, summary}: {agentId: string, status: string, error: string | null, summary: string | null}): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE agents 
      SET status = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, error || null, now, agentId).run();
  }

  /**
   * Store webhook event
   */
  async storeWebhookEvent(event: CursorWebhookEvent): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      INSERT INTO webhook_events (agent_id, status, timestamp, raw_event)
      VALUES (?, ?, ?, ?)
    `).bind(
      event.id,
      event.status,
      event.timestamp || now,
      JSON.stringify(event)
    ).run();
  }

  /**
   * Get webhook events count
   */
  async getWebhookEventsCount(): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM webhook_events
    `).first<{ count: number }>();
    
    return result?.count || 0;
  }

  /**
   * Get total agents count
   */
  async getTotalAgentsCount(): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM agents
    `).first<{ count: number }>();
    
    return result?.count || 0;
  }

  /**
   * Get active agents count
   */
     async getActiveAgentsCount(): Promise<number> {
     const result = await this.db.prepare(`
       SELECT COUNT(*) as count FROM agents WHERE status IN ('PENDING', 'RUNNING', 'CREATING')
     `).first<{ count: number }>();
     
     return result?.count || 0;
   }

   /**
    * Store agent logs
    */
   async storeAgentLogs(agentId: string, logs: string[]): Promise<void> {
     const now = new Date().toISOString();
     await this.db.prepare(`
       INSERT OR REPLACE INTO agent_logs (agent_id, logs, updated_at)
       VALUES (?, ?, ?)
     `).bind(agentId, JSON.stringify(logs), now).run();
   }

   /**
    * Get stored logs for an agent if available
    */
   async getStoredLogs(agentId: string): Promise<string[] | null> {
     const row = await this.db.prepare(`
       SELECT logs FROM agent_logs WHERE agent_id = ?
     `).bind(agentId).first<{ logs: string }>();

     if (!row?.logs) {
       return null;
     }
     try {
       return JSON.parse(row.logs);
     } catch {
       return row.logs.split('\n');
     }
   }
 }

/**
 * Verify webhook signature using HMAC-SHA256
 */
async function verifyWebhookSignature(
  signature: string, 
  body: string, 
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === `sha256=${expectedHex}`;
}

/**
 * Main Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    console.log("Request:", request.method, url.pathname);
    
    // Initialize database on first request
    await initializeDatabase(env);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    const storage = new AgentStorageService(env.DB);

    const cursorApi = once(async () => {
      const apiKey = getCursorApiKey(env);
        if (!apiKey) {
          throw errorJson('API key not configured', 'Please set your Cursor API key first');
        }

        return new CursorApiService(apiKey);
    });


    try {
      // API Routes
      if (url.pathname === '/health') {
        const totalAgents = await storage.getTotalAgentsCount();
        const webhookEvents = await storage.getWebhookEventsCount();
        
        const healthResponse: HealthResponse = {
          status: 'ok',
        timestamp: new Date().toISOString(),
          agents_created: totalAgents,
          webhook_events_received: webhookEvents,
        };
        
        return jsonResponse(healthResponse);
      }

      if (url.pathname === '/tunnel-url') {
        try {
          const tunnelUrl = getTunnelUrl();
          const response: TunnelUrlResponse = {
            tunnelUrl,
            source: 'virtual_module',
          };
          return jsonResponse(response);
        } catch (error) {
          console.warn('Virtual module not available:', error);
          const response: TunnelUrlResponse = {
            tunnelUrl: url.origin,
            source: 'fallback',
          };
          return jsonResponse(response);
        }
      }

      if (url.pathname === '/api/service-info') {
        const apiKey = getCursorApiKey(env);
        const totalAgents = await storage.getTotalAgentsCount();
        const activeAgents = await storage.getActiveAgentsCount();
        
        let webhookUrl: string;
        try {
          const tunnelUrl = getTunnelUrl();
          webhookUrl = `${tunnelUrl}/api/agent-webhook`;
        } catch {
          webhookUrl = `${url.origin}/api/agent-webhook`;
        }
        
        const serviceInfo: ServiceInfo = {
          hasApiKey: !!apiKey,
          webhookUrl,
          setupComplete: !!apiKey,
          totalAgents,
          activeAgents,
        };
        
        return jsonResponse(serviceInfo);
      }

      if (url.pathname === '/api/models') {
        const apiKey = getCursorApiKey(env);
        if (!apiKey) {
          return errorJson('API key not configured');
        }
        const cursorApi = new CursorApiService(apiKey);
        try {
          const models = await cursorApi.getModels();
          return jsonResponse(models);
        } catch (error) {
          console.error('Failed to fetch models:', error);
          return errorJson('Failed to fetch models', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (url.pathname === '/api/agents') {
        const latestAgentsPromise = (await cursorApi()).listAgents();
        const storedAgentsPromise = storage.getStoredAgents();
        // do not fail fast it confuses the logs
        await Promise.allSettled([latestAgentsPromise, storedAgentsPromise]);
        const [latestAgents, storedAgents] = await Promise.all([latestAgentsPromise, storedAgentsPromise]);
        // find agents that are not in the stored agents and upsert them
        const newAgents = latestAgents.agents.filter(agent => !storedAgents.some(storedAgent => storedAgent.id === agent.id));
        const newStoredAgents = await Promise.all(newAgents.map(agent => storage.storeAgent(agent)));

        console.log('🔒 Agents', newStoredAgents.length, storedAgents.length);
        const response: AgentsResponse = { agents: [...newStoredAgents, ...storedAgents] };
        return jsonResponse(response);
      }

      if (url.pathname === '/api/set-api-key' && request.method === 'POST') {
        const { apiKey } = await request.json() as { apiKey: string };
        
        if (!apiKey || apiKey.length < 10) {
          return errorJson('Invalid API key format');
        }
        
        // Store in memory for this session
        inMemoryApiKey = apiKey;
        
        let result: any = {
          success: true,
          message: 'Cursor API key set successfully',
          inMemoryOnly: true,
          savedToWrangler: false
        };

        // In development mode, provide helpful guidance for persisting the key
        if (isDevelopmentMode()) {
          result.message += ' (stored in memory for this session)';
          result.developmentModeNote = 'For persistence across restarts, run: npm run set-secret -- CURSOR_API_KEY';
          result.wranglerCommand = `npm run set-secret -- CURSOR_API_KEY`;
          result.nextSteps = [
            'The API key is now active for this session',
            'To persist it across dev server restarts, copy the command above',
            'Run it in your terminal to save as a Cloudflare secret',
            'You can now create Cursor agents using the interface'
          ];
        } else {
          result.nextSteps = [
            'Your API key is now active and ready to use',
            'You can now create Cursor agents using the interface',
            'Agents will be able to access your repositories and create pull requests'
          ];
        }
        
        return jsonResponse(result);
      }

      if (url.pathname === '/api/create-agent' && request.method === 'POST') {
        
        
        // Get webhook URL if requested
        let webhookUrl: string | undefined;
        
        try {
          const tunnelUrl = getTunnelUrl();
          webhookUrl = `${tunnelUrl}/api/agent-webhook`;
        } catch(error) {
          console.error('Failed to get tunnel URL:', error);
          webhookUrl = `${url.origin}/api/agent-webhook`;
        }
      

        console.log('🔒 Creating agent', webhookUrl);
  
        try {
          const input = await request.json() as CreateAgentInput;
          
          // Validate input
          if (!input.prompt || !input.source?.repository) {
            throw errorJson('Missing required fields', 'Prompt and repository are required');
          }
          const agent = await (await cursorApi()).createAgent(input, webhookUrl);
          
          // Store the agent in our database
          await storage.storeAgent(agent);
          
          return jsonResponse(agent);
        } catch (error) {
          console.error('Failed to create agent:', error);
          return errorJson('Failed to create agent', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (url.pathname.startsWith('/api/agents/') && url.pathname.endsWith('/conversation')) {
        const agentId = url.pathname.split('/')[3];
        if (!agentId) {
          return errorJson('Invalid agent ID');
        }

        // Try to serve cached conversation first
        const cachedLogs = await storage.getStoredLogs(agentId);
        if (cachedLogs) {
          return jsonResponse({ messages: cachedLogs });
        }
        
        const apiKey = getCursorApiKey(env);
        if (!apiKey) {
          return errorJson('API key not configured');
        }

        const cursorApi = new CursorApiService(apiKey);
        
        try {
          const conv = await cursorApi.getAgentConversation(agentId);

          // Cache conversation for future requests
          await storage.storeAgentLogs(agentId, conv.messages);

          return jsonResponse(conv);
        } catch (error) {
          console.error('Failed to get agent logs:', error);
          return errorJson('Failed to get agent logs', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Webhook endpoint for Cursor agent status updates
      if (url.pathname === '/api/agent-webhook' && request.method === 'POST') {
        
        const signature = request.headers.get('X-Cursor-Signature');
        const bodyText = await request.text();
        const webhookSecret = getWebhookSecret(env);

        console.log('🔒 Webhook received', request.headers, bodyText);
        // Verify webhook signature if we have a secret
        if (webhookSecret && signature) {
          const isValid = await verifyWebhookSignature(signature, bodyText, webhookSecret);
          if (!isValid) {
            return new Response('Unauthorized', { status: 401 });
          }
        }

        try {
          const event = JSON.parse(bodyText) as CursorWebhookEvent;
          
          // Store the webhook event
          try{
            await storage.storeWebhookEvent(event);
          } catch(error) {
            console.error('Failed to store webhook event:', error);
          }
          
          try {
            // Update agent status in our database
            await storage.updateAgentStatus(
              {
                agentId: event.id,
                status: event.status,
                error: event.error ? JSON.stringify(event.error) : null,
                summary: event.summary
              }
            );
          } catch(error) {
            console.error('Failed to update agent status:', error);
          }

          // If the agent has finished or errored, fetch and cache its conversation
          if (event.status === 'FINISHED' || event.status === 'ERROR') {
            const apiKey = getCursorApiKey(env);
            if (apiKey) {
              try {
                const cursorApi = new CursorApiService(apiKey);
                const { messages } = await cursorApi.getAgentConversation(event.id);
                await storage.storeAgentLogs(event.id, messages);
              } catch (err) {
                console.error('Failed to fetch/store agent conversation:', err);
              }
            }
          }
          
          console.log(`📥 Webhook received: Agent ${event.id} is ${event.status}`);
          
          return new Response('OK', { status: 200 });
            } catch (error) {
          console.error('Failed to process webhook:', error);
          return new Response('Bad Request', { status: 400 });
        }
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
      
        } catch (error) {
      if(error instanceof Response) {
        return error;
      }
      console.error('Worker error:', error);
      return errorJson('Internal server error', error instanceof Error ? error.message : 'Unknown error', 500);
    }
  },
};

/**
 * Helper functions
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorJson(error: string, message?: string, status: number = 400): Response {
  return jsonResponse(
    {
      error,
      message: message || error,
      timestamp: new Date().toISOString(),
    },
    status
  );
}

function once<T>(fn: () => T): () => T {
  let result: T | null = null;
  return () => {
    if (!result) {
      result = fn();
    }
    return result;
  };
}
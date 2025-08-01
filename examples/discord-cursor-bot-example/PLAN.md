# Implementation Plan: Discord Bot + Cursor Background Agents Integration

## Overview

This plan will create a new self-contained example that combines Discord bot functionality with Cursor background agents. The implementation will build upon the existing `discord-webhook-example` and `cursor-background-agents-example` patterns to create a Discord bot that can manage Cursor agents through slash commands and provide real-time updates via Discord threads.

## Phase 1: Project Setup and Basic Structure

### Goals
- Set up the new example project structure
- Configure dependencies and environment
- Establish database schema for agents and API keys

### Files to Create/Modify
- `examples/discord-cursor-bot-example/package.json`
- `examples/discord-cursor-bot-example/wrangler.toml`
- `examples/discord-cursor-bot-example/vite.config.ts`
- `examples/discord-cursor-bot-example/.env.example`
- `examples/discord-cursor-bot-example/src/types.ts`

### Implementation Steps

1. **Create project structure**:
```bash
mkdir examples/discord-cursor-bot-example
cd examples/discord-cursor-bot-example
mkdir src public scripts
```

2. **Set up package.json** (combine dependencies from both examples):
```json
{
  "name": "discord-cursor-bot-example",
  "version": "1.0.0",
  "private": true,
  "description": "Discord bot with Cursor background agents integration",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "deploy": "wrangler deploy",
    "set-secret": "node ./scripts/set-secret.mjs"
  },
  "dependencies": {
    "discord-interactions": "^3.4.0",
    "vibe-rules": "^0.3.60"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.10.2",
    "vite-plugin-cloudflare-tunnel": "file:../..",
    "vite": "^7.0.0",
    "wrangler": "^4.0.0"
  }
}
```

3. **Configure wrangler.toml** with both D1 and KV bindings:
```toml
name = "discord-cursor-bot"
main = "src/worker.ts"
compatibility_date = "2025-07-01"

[[d1_databases]]
binding = "DB"
database_name = "discord-cursor-agents"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "API_KEYS"
id = "your-kv-namespace-id"
```

4. **Define comprehensive types** by merging both examples:
```typescript
// src/types.ts
export interface CursorAgent {
  id: string;
  status: AgentStatus;
  prompt: string;
  repository: string;
  channelId: string;
  threadId?: string;
  userId: string;
  model?: string;
  branchName?: string;
  prUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelApiKey {
  channelId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}
```

## Phase 2: Discord Bot Integration with Cursor Agent Commands

### Goals
- Implement Discord slash command handlers
- Integrate Cursor API service
- Create agent management commands

### Files to Create/Modify
- `examples/discord-cursor-bot-example/src/worker.ts`
- `examples/discord-cursor-bot-example/src/discord-commands.ts`
- `examples/discord-cursor-bot-example/src/cursor-service.ts`

### Implementation Steps

1. **Create Discord command definitions**:
```typescript
// src/discord-commands.ts
export const AGENT_COMMANDS = {
  name: 'agents',
  description: 'Manage Cursor background agents',
  type: 1,
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'set-api-key',
      description: 'Set Cursor API key for this channel (secure modal input)',
      options: [] // No parameters - uses Discord Modal for secure input
    },
    {
      type: 1,
      name: 'create',
      description: 'Create a new Cursor agent',
      options: [
        {
          type: 3,
          name: 'prompt',
          description: 'Instructions for the agent',
          required: true
        },
        {
          type: 3,
          name: 'repository',
          description: 'GitHub repository URL',
          required: true
        }
      ]
    },
    {
      type: 1,
      name: 'list',
      description: 'List agents in this channel',
      options: [{
        type: 4, // INTEGER
        name: 'limit',
        description: 'Number of agents to show',
        required: false
      }]
    },
    {
      type: 1,
      name: 'set-default-repo',
      description: 'Set default repository for /task command',
      options: [{
        type: 3, // STRING
        name: 'repository',
        description: 'GitHub repository URL (e.g., https://github.com/org/repo)',
        required: true
      }]
    }
  ]
};

export const TASK_COMMAND = {
  name: 'task',
  description: 'Quick task agent creation',
  type: 1,
  options: [{
    type: 3,
    name: 'prompt',
    description: 'Task description for the agent',
    required: true
  }]
};

export const AGENT_LOGS_COMMAND = {
  name: 'agent',
  description: 'Agent operations',
  type: 1,
  options: [{
    type: 1,
    name: 'logs',
    description: 'View agent logs',
    options: [{
      type: 3,
      name: 'agent_id',
      description: 'Agent ID to view logs for',
      required: true
    }]
  }]
};
```

2. **Implement Cursor service integration**:
```typescript
// src/cursor-service.ts
import type { CreateAgentInput, Agent } from './types';

export class CursorApiService {
  constructor(private apiKey: string) {}

  async createAgent(input: CreateAgentInput, webhookUrl?: string): Promise<Agent> {
    const requestBody = {
      ...input,
      ...(webhookUrl && { webhook: { url: webhookUrl } })
    };

    const response = await fetch('https://api.cursor.com/v0/agents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cursor API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getAgentConversation(id: string): Promise<{ messages: any[] }> {
    const response = await fetch(`https://api.cursor.com/v0/agents/${id}/conversation`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get agent conversation: ${response.status}`);
    }

    return response.json();
  }
}
```

3. **Implement main worker with Discord interaction handling**:
```typescript
// src/worker.ts (key sections)
async function handleAgentsCommand(interaction: any, env: Env): Promise<InteractionResponse> {
  const subcommand = interaction.data.options?.[0];
  const channelId = interaction.channel_id;
  const userId = interaction.user?.id || interaction.member?.user?.id;

  switch (subcommand?.name) {
    case 'set-api-key':
      return await handleSetApiKey(subcommand, channelId, userId, env);
    case 'create':
      return await handleCreateAgent(subcommand, channelId, userId, env);
    case 'list':
      return await handleListAgents(subcommand, channelId, env);
    default:
      return createErrorResponse('Unknown agents subcommand');
  }
}
```

## Phase 3: Thread Management and Progress Updates

### Goals
- Create Discord threads when agents are created
- Handle webhook updates from Cursor API
- Send progress updates to threads

### Files to Create/Modify
- `examples/discord-cursor-bot-example/src/thread-manager.ts`
- `examples/discord-cursor-bot-example/src/webhook-handler.ts`

### Implementation Steps

1. **Create thread management service**:
```typescript
// src/thread-manager.ts
export class ThreadManager {
  constructor(private botToken: string) {}

  async createAgentThread(
    channelId: string, 
    agentId: string, 
    prompt: string
  ): Promise<{ id: string; name: string }> {
    const threadName = `Agent ${agentId.slice(-8)} - ${prompt.slice(0, 50)}...`;
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: threadName,
        type: 11, // PUBLIC_THREAD
        auto_archive_duration: 1440, // 24 hours
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.status}`);
    }

    return response.json();
  }

  async updateThreadWithProgress(
    threadId: string, 
    status: string, 
    message: string
  ): Promise<void> {
    const statusEmoji = {
      'CREATING': '🏗️',
      'RUNNING': '⚙️',
      'FINISHED': '✅',
      'ERROR': '❌',
    }[status] || '📡';

    await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `${statusEmoji} **Status Update**: ${status}\n${message}`,
      }),
    });
  }
}
```

2. **Implement webhook handler for agent updates**:
```typescript
// src/webhook-handler.ts
export async function handleCursorWebhook(
  request: Request, 
  env: Env
): Promise<Response> {
  const event = await request.json() as CursorWebhookEvent;
  
  // Update agent in database
  await updateAgentStatus(env.DB, event.id, event.status, event.error);
  
  // Get agent details to find thread
  const agent = await getAgent(env.DB, event.id);
  if (!agent?.threadId) return new Response('OK');

  // Send update to Discord thread
  const botToken = getDiscordBotToken(env);
  if (botToken) {
    const threadManager = new ThreadManager(botToken);
    await threadManager.updateThreadWithProgress(
      agent.threadId,
      event.status,
      event.summary || 'Agent status updated'
    );
  }

  return new Response('OK');
}
```

## Phase 4: KV Storage for API Keys by Channel ✅ COMPLETED

### Goals
- Store and retrieve API keys by Discord channel ID
- Implement secure key management
- Handle key validation

### Files to Create/Modify
- `examples/discord-cursor-bot-example/src/api-key-manager.ts`

### Implementation Steps

1. **Create API key management service**:
```typescript
// src/api-key-manager.ts
export class ApiKeyManager {
  constructor(private kv: KVNamespace) {}

  async setApiKey(channelId: string, apiKey: string): Promise<void> {
    const keyData: ChannelApiKey = {
      channelId,
      apiKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(`channel:${channelId}:api_key`, JSON.stringify(keyData));
  }

  async getApiKey(channelId: string): Promise<string | null> {
    const data = await this.kv.get(`channel:${channelId}:api_key`);
    if (!data) return null;

    const keyData = JSON.parse(data) as ChannelApiKey;
    return keyData.apiKey;
  }

  async deleteApiKey(channelId: string): Promise<void> {
    await this.kv.delete(`channel:${channelId}:api_key`);
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.cursor.com/v0/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

2. **Integrate API key management into commands** (using secure Discord Modal):
```typescript
async function handleSetApiKey(
  interaction: any,
  channelId: string, 
  userId: string, 
  env: Env
): Promise<InteractionResponse> {
  // Show Discord Modal for secure API key input
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `api_key_modal_${channelId}`,
      title: 'Set Cursor API Key',
      components: [{
        type: 1, // ACTION_ROW
        components: [{
          type: 4, // TEXT_INPUT
          custom_id: 'api_key_input',
          label: 'Cursor API Key',
          style: 1, // SHORT
          placeholder: 'Enter your Cursor API key...',
          required: true,
          max_length: 200
        }]
      }]
    }
  };
}

async function handleApiKeyModalSubmit(
  interaction: ModalSubmitInteraction,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  const apiKey = interaction.data.components[0]?.components[0]?.value;
  
  if (!apiKey) {
    return createErrorResponse('API key is required');
  }

  const keyManager = new ApiKeyManager(env.API_KEYS);
  
  // Validate the API key
  const isValid = await keyManager.validateApiKey(apiKey);
  if (!isValid) {
    return createErrorResponse('Invalid API key. Please check your Cursor API key.');
  }

  // Store the API key
  await keyManager.setApiKey(channelId, apiKey);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ Cursor API key has been set for this channel!',
      flags: 64, // Ephemeral
    },
  };
}
```

### Phase 4 Implementation Summary

**✅ COMPLETED**: Phase 4 has been successfully implemented with the following:

1. **Created `src/api-key-manager.ts`** - Dedicated API key management service:
   - `ApiKeyManager` class with full CRUD operations for API keys
   - Channel-specific API key storage using KV storage
   - API key validation using Cursor API
   - Helper functions like `getEffectiveApiKey` for fallback logic
   - Metadata retrieval and administrative functions

2. **Updated `src/worker.ts`** - Integrated the new API key manager:
   - Removed inline `ApiKeyManager` class definition
   - Added imports for the new API key management services
   - Updated all instances to use `createApiKeyManager` factory function
   - Replaced manual fallback logic with `getEffectiveApiKey` helper

3. **Enhanced Security & UX**:
   - Discord Modal-based API key input (secure, not visible in chat)
   - API key validation before storage
   - Channel-based isolation for multi-team usage
   - Fallback to default API key when channel-specific key not available

4. **Code Quality Improvements**:
   - Fixed TypeScript strict mode compatibility issues
   - Proper handling of optional properties with `exactOptionalPropertyTypes`
   - Enhanced error handling and logging
   - Consistent with existing examples' architecture patterns

**Features Available**:
- `/agents set-api-key` - Secure modal-based API key setup per channel
- Channel-specific API key storage with metadata tracking
- Automatic fallback to default API key if channel key not set
- API key validation against Cursor API before storage
- Administrative functions for listing channels with API keys

## Phase 5: UI for Listing Agents

### Goals
- Create a simple web interface to view agents
- Display agent status and basic information
- Integrate with Discord authentication (optional)

### Files to Create/Modify
- `examples/discord-cursor-bot-example/public/index.html`
- `examples/discord-cursor-bot-example/public/styles.css`
- `examples/discord-cursor-bot-example/src/client.ts`

### Implementation Steps

1. **Create HTML interface** (simplified version of cursor-background-agents-example):
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Cursor Bot - Agent Dashboard</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Discord Cursor Bot</h1>
            <p>Monitor your Cursor agents created via Discord</p>
        </div>
        
        <div class="card">
            <h2>📊 Active Agents</h2>
            <button id="refreshButton" class="button">🔄 Refresh</button>
            <div id="agentsList" class="agents-list">
                <div class="no-agents">No agents found. Create agents using Discord slash commands!</div>
            </div>
        </div>
    </div>
    <script type="module" src="/src/client.ts"></script>
</body>
</html>
```

2. **Add API endpoint for listing agents**:
```typescript
// In worker.ts
if (url.pathname === '/api/agents' && request.method === 'GET') {
  const agents = await listAllAgents(env.DB);
  return jsonResponse({ agents });
}
```

3. **Implement client-side JavaScript**:
```typescript
// src/client.ts
async function refreshAgents(): Promise<void> {
  try {
    const response = await fetch('/api/agents');
    const data = await response.json();
    renderAgents(data.agents);
  } catch (error) {
    console.error('Failed to load agents:', error);
  }
}

function renderAgents(agents: CursorAgent[]): void {
  const container = document.getElementById('agentsList');
  if (!container) return;

  if (agents.length === 0) {
    container.innerHTML = '<div class="no-agents">No agents found. Create agents using Discord slash commands!</div>';
    return;
  }

  container.innerHTML = agents.map(agent => `
    <div class="agent-item">
      <div class="agent-header">
        <span class="agent-status status-${agent.status.toLowerCase()}">${agent.status}</span>
        <span class="agent-time">${new Date(agent.createdAt).toLocaleString()}</span>
      </div>
      <div class="agent-details">
        <div><strong>ID:</strong> ${agent.id}</div>
        <div><strong>Repository:</strong> ${agent.repository}</div>
        <div><strong>Prompt:</strong> ${agent.prompt.substring(0, 100)}...</div>
        ${agent.threadId ? `<div><strong>Discord Thread:</strong> ${agent.threadId}</div>` : ''}
      </div>
    </div>
  `).join('');
}
```

## Phase 6: Follow-up Message Support

### Goals
- Handle thread interactions from Discord event forwarder
- Extract agent ID from thread messages
- Create follow-up messages to existing Cursor agents
- Post follow-up completion updates to Discord threads

### Files to Create/Modify
- `examples/discord-cursor-bot-example/src/thread-interaction-handler.ts`
- `examples/discord-cursor-bot-example/src/worker.ts` (enhance webhook handler)
- `examples/discord-cursor-bot-example/src/thread-manager.ts` (enhance initial message format)

### Implementation Steps

1. **Enhance initial thread message to include extractable agent ID**:
```typescript
// In thread-manager.ts - update createAgentThread method
async function createInitialThreadMessage(
  threadId: string,
  agentId: string,
  prompt: string
): Promise<void> {
  const message = `🚀 **Agent Created Successfully!**

**Agent ID:** \`${agentId}\`
**Task:** ${prompt}

I'll post updates here as the agent works on your task. Stay tuned! 👀`;

  await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${this.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: message,
    }),
  });
}
```

2. **Create thread interaction handler**:
```typescript
// src/thread-interaction-handler.ts
export interface ThreadInteraction {
  type: number; // 99 for thread interactions
  thread: {
    id: string;
    name: string;
    parent_id: string;
  };
  messages: Array<{
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      bot: boolean;
    };
    created_at: string;
  }>;
  triggering_message: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      bot: boolean;
    };
  };
}

export class ThreadInteractionHandler {
  constructor(private env: Env) {}

  async handleThreadInteraction(interaction: ThreadInteraction): Promise<Response> {
    try {
      // Extract agent ID from the first bot message
      const agentId = this.extractAgentId(interaction.messages);
      if (!agentId) {
        console.error('Could not extract agent ID from thread messages');
        return new Response('Agent ID not found', { status: 400 });
      }

      // Get the triggering message (user's follow-up request)
      const followUpMessage = interaction.triggering_message.content;
      const userId = interaction.triggering_message.author.id;

      // Create follow-up message to Cursor agent
      await this.createFollowUpMessage(agentId, followUpMessage, userId, interaction.thread.id);

      return new Response('Follow-up message sent', { status: 200 });
    } catch (error) {
      console.error('Error handling thread interaction:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  private extractAgentId(messages: Array<any>): string | null {
    // Find the first bot message containing the agent ID
    const botMessage = messages.find(msg => 
      msg.author.bot && 
      msg.content.includes('**Agent ID:**') &&
      msg.content.includes('🚀 **Agent Created Successfully!**')
    );

    if (!botMessage) return null;

    // Extract agent ID using regex to match the backtick-wrapped ID
    const match = botMessage.content.match(/\*\*Agent ID:\*\* `([^`]+)`/);
    return match ? match[1] : null;
  }

  private async createFollowUpMessage(
    agentId: string, 
    followUpMessage: string, 
    userId: string, 
    threadId: string
  ): Promise<void> {
    // Get API key for the channel (thread's parent channel)
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const apiKeyManager = createApiKeyManager(this.env.API_KEYS);
    const apiKey = await apiKeyManager.getEffectiveApiKey(agent.channelId, this.env);
    
    if (!apiKey) {
      throw new Error('No API key available for this channel');
    }

    // Send follow-up message to Cursor API
    const cursorService = new CursorApiService(apiKey);
    const result = await cursorService.sendFollowUpMessage(agentId, followUpMessage);

    // Send acknowledgment to Discord thread
    const botToken = getDiscordBotToken(this.env);
    if (botToken) {
      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🔄 **Follow-up Message Sent**\n\nYour follow-up request has been sent to the agent. I'll post updates here when the agent responds!`,
        }),
      });
    }
  }

  private async getAgentById(agentId: string): Promise<CursorAgent | null> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).bind(agentId).first();

    return result ? {
      id: result.id as string,
      status: result.status as AgentStatus, 
      prompt: result.prompt as string,
      repository: result.repository as string,
      channelId: result.channel_id as string,
      threadId: result.thread_id as string,
      userId: result.user_id as string,
      model: result.model as string,
      branchName: result.branch_name as string,
      prUrl: result.pr_url as string,
      error: result.error as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    } : null;
  }
}
```

3. **Enhance Cursor API service with follow-up message support**:
```typescript
// In cursor-service.ts - add method to CursorApiService class
async sendFollowUpMessage(
  agentId: string, 
  message: string
): Promise<{ id: string }> {
  const requestBody = {
    prompt: {
      text: message
    }
  };

  const response = await fetch(`https://api.cursor.com/v0/agents/${agentId}/followup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cursor follow-up API error: ${response.status} - ${error}`);
  }

  return response.json();
}
```

4. **Enhance worker.ts to handle thread interactions**:
```typescript
// In worker.ts - add route handler
if (url.pathname === '/discord/interactions' && request.method === 'POST') {
  const interaction = await request.json();
  
  // Handle thread interactions from event forwarder
  if (interaction.type === 99) { // Thread interaction type
    const handler = new ThreadInteractionHandler(env);
    return await handler.handleThreadInteraction(interaction);
  }
  
  // Existing Discord interaction handling...
  return await handleDiscordInteraction(request, env);
}
```

5. **Enhance webhook handler for follow-up completions**:
```typescript
// In webhook-handler.ts - enhance handleCursorWebhook
export async function handleCursorWebhook(
  request: Request, 
  env: Env
): Promise<Response> {
  const event = await request.json() as CursorWebhookEvent;
  
  // Update agent in database
  await updateAgentStatus(env.DB, event.id, event.status, event.error);
  
  // Get agent details to find thread
  const agent = await getAgent(env.DB, event.id);
  if (!agent?.threadId) return new Response('OK');

  // Send update to Discord thread
  const botToken = getDiscordBotToken(env);
  if (botToken) {
    const threadManager = new ThreadManager(botToken);
    
    // For follow-ups, the same webhook is triggered but we can identify them by checking if the agent already has a thread id set in D1
    // Note: The webhook payload structure is the same for both initial and follow-up completions
    
    const statusEmoji = getStatusEmoji(event.status);
    let messageContent = `${statusEmoji} **Agent Update**`;
    
    if (event.summary) {
      messageContent += `\n**Summary:** ${event.summary}`;
    }
    
    if (event.branchName) {
      messageContent += `\n**Branch:** \`${event.branchName}\``;
    }
    
    if (event.prUrl) {
      messageContent += `\n**Pull Request:** ${event.prUrl}`;
    }
    
    if (event.status === 'FINISHED') {
      messageContent += `\n✨ Task completed successfully!`;
    }

    await threadManager.sendMessageToThread(agent.threadId, messageContent);
  }

  return new Response('OK');
}

function getStatusEmoji(status: string): string {
  const statusEmojis = {
    'CREATING': '🏗️',
    'RUNNING': '⚙️', 
    'FINISHED': '✅',
    'ERROR': '❌',
  };
  return statusEmojis[status] || '📡';
}
```

6. **Add types for thread interactions**:
```typescript
// In types.ts - add new interfaces
export interface CursorWebhookEvent {
  id: string;
  status: AgentStatus;
  summary?: string;
  branchName?: string;
  prUrl?: string;
  error?: string;
}

export interface ThreadInteractionData {
  id: string;
  name: string;
  type: number;
  custom_id: string;
  options: Array<{
    name: string;
    type: number;
    value: string | number;
  }>;
}
```

### Agent ID to Thread ID Mapping Flow

**Agent Creation & Mapping Storage:**
```typescript
// Complete flow for agent creation with thread mapping
async function handleCreateAgent(prompt: string, repository: string, channelId: string, userId: string, env: Env) {
  // 1. Create Cursor background agent
  const cursorService = new CursorApiService(apiKey);
  const webhookUrl = `${env.WORKER_URL}/webhook/cursor`;
  const agent = await cursorService.createAgent({
    prompt,
    repository,
    webhook: { url: webhookUrl }
  });
  
  // 2. Create Discord thread
  const threadManager = new ThreadManager(botToken);
  const thread = await threadManager.createAgentThread(channelId, agent.id, prompt);
  
  // 3. Store mapping in database (CRITICAL STEP)
  await env.DB.prepare(`
    INSERT INTO agents (id, status, prompt, repository, channel_id, thread_id, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    agent.id,           // Cursor agent ID as primary key
    'CREATING',
    prompt,
    repository,
    channelId,
    thread.id,          // Discord thread ID - THIS IS THE MAPPING
    userId,
    new Date().toISOString(),
    new Date().toISOString()
  ).run();
  
  // 4. Post initial message with agent ID
  await threadManager.createInitialThreadMessage(thread.id, agent.id, prompt);
}
```

**Webhook Processing & Thread Lookup:**
```typescript
// How webhooks find the correct thread to update
export async function handleCursorWebhook(request: Request, env: Env): Promise<Response> {
  const event = await request.json() as CursorWebhookEvent;
  
  // 1. Use Cursor agent ID to find our database record
  const agent = await env.DB.prepare(
    'SELECT * FROM agents WHERE id = ?'
  ).bind(event.id).first();  // event.id is the Cursor agent ID
  
  // 2. Get the mapped Discord thread ID
  if (!agent?.thread_id) {
    console.log(`No thread found for agent ${event.id} - agent may have been created outside Discord bot`);
    return new Response('OK'); // Silently ignore webhooks for agents not created via Discord
  }
  
  // 3. Send update to the correct Discord thread
  const threadManager = new ThreadManager(botToken);
  await threadManager.sendMessageToThread(agent.thread_id, updateMessage);
  
  return new Response('OK');
}
```

### Integration Flow

1. **User creates agent** → Bot creates Cursor agent + Discord thread + stores mapping in DB
2. **User replies in thread** → Event forwarder calls `/discord/interactions`
3. **Bot extracts agent ID** → Finds original agent from database using agent ID
4. **Bot calls Cursor API** → Sends follow-up message to existing agent via `/followup` endpoint
5. **Agent processes follow-up** → Existing webhook from initial agent creation handles completion
6. **Webhook arrives** → Bot queries DB by agent ID, finds thread ID, posts update

**Critical Database Query Pattern:**
- **Agent Creation**: `INSERT ... VALUES (cursor_agent_id, ..., discord_thread_id, ...)`  
- **Webhook Processing**: `SELECT thread_id FROM agents WHERE id = cursor_agent_id`
- **Thread Interactions**: Extract agent ID from thread, then `SELECT * FROM agents WHERE id = extracted_agent_id`

**Note on Webhooks**: The `/followup` endpoint doesn't accept webhook URLs directly. Follow-up completion notifications are handled through the same webhook URL that was configured when the original agent was created.

**Edge Cases & Error Handling:**
- **Agent not found in DB**: Webhook for agent created outside Discord bot → log and ignore silently
- **Thread deleted by user**: Discord API will return 404 → log error but continue processing other webhooks  
- **Database consistency**: If agent creation fails after thread creation, cleanup thread to avoid orphans
- **Concurrent webhooks**: Database queries are atomic, multiple webhook updates for same agent are safe

### Benefits

- **Seamless conversation flow**: Users can continue refining tasks directly in threads
- **Context preservation**: Agent maintains full context from original task
- **Real-time updates**: Users get notified when follow-ups are completed
- **Multi-agent support**: Each thread maintains its own agent context
- **Error resilience**: Proper error handling for failed extractions or API calls

## Phase 7: Testing and Refinement

### Goals
- Test all Discord commands
- Verify webhook integration
- Ensure proper error handling
- Test thread creation and updates

### Files to Create/Modify
- `examples/discord-cursor-bot-example/README.md`
- `examples/discord-cursor-bot-example/scripts/setup.mjs`

### Implementation Steps

1. **Create comprehensive README**:
```markdown
# Discord Cursor Bot Example

This example combines Discord bot functionality with Cursor background agents.

## Setup

1. Set up Discord application and bot
2. Configure Cursor API key
3. Deploy to Cloudflare Workers
4. Register slash commands

## Commands

- `/agents set-api-key` - Set Cursor API key for channel
- `/agents create` - Create new agent with thread
- `/agents list` - List agents in channel
- `/task [prompt]` - Quick agent creation
- `/agent logs` - View agent conversation logs
```

2. **Add database initialization**:
```typescript
async function initializeDatabase(env: Env): Promise<void> {
  // Create agents table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      repository TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      thread_id TEXT,
      user_id TEXT NOT NULL,
      model TEXT,
      branch_name TEXT,
      pr_url TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // Create indexes
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_agents_channel_id ON agents(channel_id)
  `).run();
}
```

3. **Add command registration script**:
```typescript
// scripts/register-commands.mjs
import { AGENT_COMMANDS, TASK_COMMAND, AGENT_LOGS_COMMAND } from '../src/discord-commands.js';

export async function registerCommands(applicationId: string, botToken: string) {
  const commands = [AGENT_COMMANDS, TASK_COMMAND, AGENT_LOGS_COMMAND];
  
  for (const command of commands) {
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    
    if (response.ok) {
      console.log(`✅ Registered command: ${command.name}`);
    } else {
      console.error(`❌ Failed to register command: ${command.name}`);
    }
  }
}
```

## Key Design Decisions

1. **Channel-based API Key Storage**: Using KV storage with channel ID as the key allows different Discord channels to have different Cursor API keys, enabling multi-team usage.

2. **Thread Integration**: Creating Discord threads for each agent provides a dedicated space for progress updates and maintains conversation context.

3. **Webhook Integration**: Leveraging Cursor's webhook system to provide real-time updates to Discord threads ensures users stay informed about agent progress.

4. **Database Schema**: Storing agents with channel and thread associations enables proper Discord integration while maintaining agent lifecycle information.

5. **Agent ID to Thread ID Mapping**: The critical mapping between Cursor background agent IDs and Discord thread IDs is stored in the D1 database:
   - **Primary Key**: `id` (Cursor background agent ID from API response)  
   - **Thread Reference**: `thread_id` (Discord thread ID from thread creation)
   - **Webhook Lookup**: When webhooks arrive, we query by agent ID to find the associated thread
   - **Thread Updates**: All agent progress updates are sent to the mapped Discord thread

6. **Error Handling**: Comprehensive error handling for both Discord and Cursor API interactions with user-friendly error messages.

This implementation creates a powerful integration that allows Discord users to manage Cursor agents directly from their chat interface while providing real-time feedback and progress tracking.

## Discord Commands Summary

### `/agents set-api-key`
- **Purpose**: Store a Cursor API key for the current Discord channel securely
- **Security**: Uses Discord Modal for secure input (not slash command parameters)
- **Storage**: KV storage keyed by Channel ID
- **Validation**: Validates the API key before storing
- **Response**: Ephemeral success/error message

### `/task [prompt]`
- **Purpose**: Quick shortcut to create a new Cursor agent
- **Function**: Creates agent and Discord thread
- **Updates**: Real-time progress updates in the thread
- **Repository**: Uses a default or channel-configured repository

### `/agents create [prompt] [repository]`
- **Purpose**: Full agent creation with custom repository
- **Function**: Creates agent and Discord thread
- **Updates**: Real-time progress updates in the thread
- **Flexibility**: Allows specifying custom GitHub repository

### `/agents list [limit]`
- **Purpose**: List all agents for the current channel
- **Display**: Shows agent status, ID, prompt, and thread links
- **Filtering**: Optional limit parameter
- **Response**: Formatted list of agents

### `/agent logs [agent_id]`
- **Purpose**: View conversation logs for a specific agent
- **Display**: Shows agent's conversation history
- **Integration**: Fetches logs from Cursor API
- **Format**: User-friendly conversation display

### `/agents set-default-repo [repository]`
- **Purpose**: Set default repository for quick `/task` commands
- **Storage**: Stored in KV storage by Channel ID
- **Validation**: Validates GitHub repository URL format
- **Benefit**: Makes `/task` command more powerful with per-channel defaults

## Architecture Overview

```
Discord Bot Commands
        ↓
Cloudflare Worker
        ↓
┌─────────────────┬─────────────────┐
│   KV Storage    │   D1 Database   │
│ (API Keys by    │ (Agent Records) │
│  Channel ID)    │                 │
└─────────────────┴─────────────────┘
        ↓
Cursor API Integration
        ↓
Discord Thread Updates
(via Webhooks)
```

This architecture ensures secure, scalable, and efficient management of Cursor agents through Discord with real-time feedback and proper data isolation by channel.
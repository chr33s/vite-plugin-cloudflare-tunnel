/**
 * Discord Cursor Bot - Cloudflare Worker
 * 
 * This worker provides Discord slash commands for managing Cursor Background Agents.
 * It handles Discord interactions, manages API keys per channel, and integrates with
 * the Cursor API to create and monitor agents.
 */

import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { getTunnelUrl as getVirtualTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';
import { CursorApiService, buildCreateAgentInput } from './cursor-service';
import { 
  COMMAND_NAMES, 
  AGENTS_SUBCOMMANDS, 
  AGENT_SUBCOMMANDS,
  ALL_COMMANDS 
} from './discord-commands';
import { validateGitHubUrl, mapApiAgentToStoredAgent } from './type-mappers';
import { ThreadManager, createThreadManager } from './thread-manager';
import { handleCursorWebhook } from './webhook-handler';
import { handleThreadInteraction } from './thread-interaction-handler';
import { ApiKeyManager, createApiKeyManager, getEffectiveApiKey } from './api-key-manager';
import type { 
  Env, 
  InteractionResponse, 
  StoredCursorAgent,
  ChannelConfig,
  ModalSubmitInteraction,
  ServiceInfo,
  AgentDatabaseRow,
} from './types';
import { dbRowToStoredAgent } from './types';

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature-Ed25519, X-Signature-Timestamp',
} as const;

function getTunnelUrl(): `https://${string}` {
  return process.env.DEV ? getVirtualTunnelUrl() : 'https://discord.vibe-tools.com';
}

/**
 * Helper function to create JSON responses with CORS headers
 */
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Helper function to create error responses
 */
function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Get Discord credentials from environment
 */
function getDiscordPublicKey(env: Env): string | null {
  return env.DISCORD_PUBLIC_KEY || null;
}

function getDiscordBotToken(env: Env): string | null {
  return env.DISCORD_BOT_TOKEN || null;
}

/**
 * Make an authenticated Discord API request
 */
async function discordApiRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    botToken: string;
  }
): Promise<Response> {
  const requestOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bot ${options.botToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (options.body && options.method !== 'GET') {
    requestOptions.body = JSON.stringify(options.body);
  }

  return fetch(`https://discord.com/api/v10${endpoint}`, requestOptions);
}

/**
 * Get current Discord application information using the bot token
 */
async function getCurrentApplication(env: Env): Promise<any> {
  const effectiveBotToken = getDiscordBotToken(env);
  
  if (!effectiveBotToken) {
    throw new Error('Discord bot token not configured. Cannot fetch application information.');
  }
  
  try {
    const response = await discordApiRequest('/applications/@me', {
      botToken: effectiveBotToken
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Discord API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    
    const applicationData = await response.json() as {
        id: string;
        name: string;
        owner: {
            username: string;
        }
    };
    console.log('✅ Retrieved application info:', {
      id: applicationData.id,
      name: applicationData['name'],
      owner: applicationData['owner']?.username
    });
    
    return applicationData;
  } catch (error) {
    console.error('❌ Failed to get application info:', error);
    throw error;
  }
}

/**
 * Register bot commands on a specific guild (server)
 */
async function registerGuildCommands(env: Env, guildId: string): Promise<void> {
  const effectiveBotToken = getDiscordBotToken(env);
  
  if (!effectiveBotToken) {
    console.error('❌ Cannot register commands: Bot token not configured');
    return;
  }
  
  try {
    // Get the application ID
    const appInfo = await getCurrentApplication(env);
    const applicationId = appInfo.id;
    
    console.log(`🔧 Registering commands for guild ${guildId}...`);
    
    // Register all commands from ALL_COMMANDS
    const registrationPromises = ALL_COMMANDS.map(async (command) => {
      const response = await discordApiRequest(`/applications/${applicationId}/guilds/${guildId}/commands`, {
        method: 'POST',
        body: command,
        botToken: effectiveBotToken
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`❌ Failed to register command ${command.name}:`, error);
        return null;
      }
      
      const commandData = await response.json() as { id?: string; name?: string };
      console.log(`✅ Registered command: ${command.name}${commandData.id ? ` (ID: ${commandData.id})` : ''}`);
      return commandData;
    });
    
    const results = await Promise.allSettled(registrationPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    const failed = results.length - successful;
    
    console.log(`📋 Command registration complete for guild ${guildId}: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      console.warn(`⚠️ Some commands failed to register. Check logs above for details.`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to register commands for guild ${guildId}:`, error);
  }
}

/**
 * Channel Configuration Manager
 */
class ChannelConfigManager {
  constructor(private kv: KVNamespace) {}

  async setDefaultRepository(channelId: string, repository: `https://github.com/${string}`): Promise<void> {
    const config: ChannelConfig = {
      channelId,
      defaultRepository: repository,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(`channel:${channelId}:config`, JSON.stringify(config));
  }

  async getDefaultRepository(channelId: string): Promise<`https://github.com/${string}` | null> {
    const data = await this.kv.get(`channel:${channelId}:config`);
    if (!data) return null;

    const config = JSON.parse(data) as ChannelConfig;
    return config.defaultRepository || null;
  }
}

// ThreadManager is now imported from ./thread-manager.ts

/**
 * Database service for agent storage
 */
class AgentStorageService {
  constructor(private db: D1Database) {}

  async storeAgent(agent: StoredCursorAgent): Promise<void> {
    await this.db.prepare(`
      INSERT INTO agents (
        id, status, prompt, repository, discord_channel_id, discord_thread_id, 
        discord_user_id, model, branch_name, pr_url, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agent.id,
      agent.status,
      agent.prompt,
      agent.repository,
      agent.discordChannelId,
      agent.discordThreadId || null,
      agent.discordUserId,
      agent.model || null,
      agent.branchName || null,
      agent.prUrl || null,
      agent.error || null,
      agent.createdAt,
      agent.updatedAt
    ).run();
  }

  async updateAgentStatus(agentId: string, status: string, error?: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE agents 
      SET status = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, error || null, now, agentId).run();
  }

  async updateAgentThread(agentId: string, threadId: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE agents 
      SET discord_thread_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(threadId, now, agentId).run();
  }

  async getAgent(agentId: string): Promise<StoredCursorAgent | null> {
    const result = await this.db.prepare(`
      SELECT * FROM agents WHERE id = ?
    `).bind(agentId).first<AgentDatabaseRow>();

    if (!result) return null;

    return dbRowToStoredAgent(result);
  }

  async listAgentsByChannel(channelId: string, limit = 10): Promise<StoredCursorAgent[]> {
    const result = await this.db.prepare(`
      SELECT * FROM agents 
      WHERE discord_channel_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(channelId, limit).all<AgentDatabaseRow>();

    return (result.results || []).map(dbRowToStoredAgent);
  }

  async listAllAgents(): Promise<StoredCursorAgent[]> {
    const result = await this.db.prepare(`
      SELECT * FROM agents ORDER BY created_at DESC LIMIT 100
    `).all<AgentDatabaseRow>();

    return (result.results || []).map(dbRowToStoredAgent);
  }

  async storeInteraction(interaction: any): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      INSERT INTO interactions (timestamp, type, data, user_id, user_username, raw)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      now,
      interaction.type || 'unknown',
      JSON.stringify(interaction.data || {}),
      interaction.user?.id || interaction.member?.user?.id || null,
      interaction.user?.username || interaction.member?.user?.username || null,
      JSON.stringify(interaction)
    ).run();
  }
}

/**
 * Create error response for Discord interactions
 */
function createErrorResponse(message: string, ephemeral = true): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `❌ ${message}`,
      ...(ephemeral ? { flags: 64 } : {}), // Ephemeral flag
    },
  };
}

/**
 * Create an error response with a button component
 */
function createErrorResponseWithButton(
  message: string, 
  buttonLabel: string, 
  buttonCustomId: string,
  ephemeral = true
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `❌ ${message}`,
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 1, // Primary style (blue)
              label: buttonLabel,
              custom_id: buttonCustomId,
            }
          ]
        }
      ],
      ...(ephemeral ? { flags: 64 } : {}), // Ephemeral flag
    },
  };
}

/**
 * Handle /agents set-api-key command - show modal for secure input
 */
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

/**
 * Handle set-default-repo button click - show modal for repository input
 */
async function handleSetDefaultRepoButton(
  interaction: any,
  channelId: string, 
  userId: string, 
  env: Env
): Promise<InteractionResponse> {
  // Show Discord Modal for repository input
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `default_repo_modal_${channelId}`,
      title: 'Set Default Repository',
      components: [{
        type: 1, // ACTION_ROW
        components: [{
          type: 4, // TEXT_INPUT
          custom_id: 'repository_input',
          label: 'GitHub Repository URL',
          style: 1, // SHORT
          placeholder: 'https://github.com/org/repo',
          required: true,
          max_length: 200
        }]
      }]
    }
  };
}

/**
 * Handle API key modal submission
 */
async function handleApiKeyModalSubmit(
  interaction: ModalSubmitInteraction,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  const apiKey = interaction.data.components[0]?.components[0]?.value;
  
  if (!apiKey) {
    return createErrorResponse('API key is required');
  }

  const keyManager = createApiKeyManager(env.API_KEYS);
  
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

/**
 * Handle default repository modal submission
 */
async function handleDefaultRepoModalSubmit(
  interaction: ModalSubmitInteraction,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  let repository = interaction.data.components[0]?.components[0]?.value;
  
  if (!repository) {
    return createErrorResponse('Repository URL is required');
  }

  // Normalize GitHub URL format
  if (!repository.startsWith('https://github.com/')) {
    repository = `https://github.com/${repository}`;
  }

  // Validate GitHub URL
  if (!validateGitHubUrl(repository)) {
    return createErrorResponse('Repository must be a valid GitHub URL (e.g., https://github.com/org/repo)');
  }

  // Store the default repository
  const configManager = new ChannelConfigManager(env.API_KEYS);
  await configManager.setDefaultRepository(channelId, repository as `https://github.com/${string}`);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ Default repository has been set to: ${repository}`,
      flags: 64, // Ephemeral
    },
  };
}

/**
 * Handle /agents create command
 */
async function handleCreateAgent(
  subcommand: any,
  channelId: string,
  userId: string,
  env: Env,
  isDeferred = false
): Promise<InteractionResponse> {
  const prompt = subcommand.options?.find((opt: any) => opt.name === 'prompt')?.value;
  let repository = subcommand.options?.find((opt: any) => opt.name === 'repository')?.value;
  const model = subcommand.options?.find((opt: any) => opt.name === 'model')?.value;

  if (!prompt || !repository) {
    return createErrorResponse('Both prompt and repository are required');
  }
  if(!repository.startsWith('https://github.com/')) {
    repository = `https://github.com/${repository}`;
  }

  if (!validateGitHubUrl(repository)) {
    return createErrorResponse('Repository must be a valid GitHub URL (e.g., https://github.com/org/repo)');
  }

  // Get API key for this channel
  const keyManager = createApiKeyManager(env.API_KEYS);
  const apiKey = await getEffectiveApiKey(channelId, keyManager, env.CURSOR_API_KEY);

  if (!apiKey) {
    return createErrorResponseWithButton(
      'No Cursor API key configured for this channel.',
      '🔑 Set API Key',
      'set_api_key_button'
    );
  }

  // If this might take a while, send a deferred response first
  if (isDeferred) {
    return {
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {}
    };
  }

  // For non-deferred responses, do the actual work
  try {
    // Create webhook URL for progress updates
    const tunnelUrl = getTunnelUrl();
    const webhookUrl = `${tunnelUrl}/cursor/webhook`;

    // Create the agent
    const cursorService = new CursorApiService(apiKey);
    const agentInput = buildCreateAgentInput(prompt, repository, model, webhookUrl);
    const agent = await cursorService.createAgent(agentInput);

    // Store in database
    const storage = new AgentStorageService(env.DB);
    const storedAgent = mapApiAgentToStoredAgent(agent, channelId, userId);
    await storage.storeAgent(storedAgent);

    // Create Discord thread
    const botToken = getDiscordBotToken(env);
    if (botToken) {
      const threadManager = createThreadManager(botToken);
      const thread = await threadManager.createAgentThread(channelId, agent.id, prompt);
      
      if (thread) {
        // Update agent with thread ID
        await storage.updateAgentThread(agent.id, thread.id);
      }
    }

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `🤖 **Agent Created!**\n\n**ID:** \`${agent.id}\`\n**Status:** ${agent.status}\n**Repository:** ${repository}\n\n${botToken ? '📡 Updates will be posted to the created thread.' : ''}`,
      },
    };

  } catch (error) {
    console.error('Failed to create agent:', error);
    return createErrorResponse(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle /task command (quick agent creation)
 */
async function handleTaskCommand(
  commandData: any,
  channelId: string,
  userId: string,
  env: Env,
  ctx: ExecutionContext
): Promise<InteractionResponse> {
  const prompt = commandData.options?.find((opt: any) => opt.name === 'prompt')?.value;
  let repository = commandData.options?.find((opt: any) => opt.name === 'repository')?.value;

  if (!prompt) {
    return createErrorResponse('Prompt is required');
  }

  // If no repository provided, try to get channel default
  if (!repository) {
    const configManager = new ChannelConfigManager(env.API_KEYS);
    repository = await configManager.getDefaultRepository(channelId);
  }

  if (!repository) {
    return createErrorResponseWithButton(
      'No repository specified and no default repository set for this channel.',
      '🏗️ Set Default Repository',
      'set_default_repo_button'
    );
  }

  const keyManager = createApiKeyManager(env.API_KEYS);
  const apiKey = await getEffectiveApiKey(channelId, keyManager, env.CURSOR_API_KEY);

  if (!apiKey) {
    return createErrorResponseWithButton(
      'No Cursor API key configured for this channel.',
      '🔑 Set API Key',
      'set_api_key_button'
    );
  }

  // Use deferred response pattern for better UX
  // First respond immediately to acknowledge the command
  const deferredResponse = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Agent will be created in a few seconds!',
    },
  };

  // Start the async agent creation process
  ctx.waitUntil(createAgentAsync(prompt, repository, channelId, userId, env));

  return deferredResponse;
}

/**
 * Create agent asynchronously and send follow-up message to Discord
 */
async function createAgentAsync(
  prompt: string,
  repository: string,
  channelId: string,
  userId: string,
  env: Env
): Promise<void> {
  try {
    if(!repository.startsWith('https://github.com/')) {
      repository = `https://github.com/${repository}`;
    }

    if (!validateGitHubUrl(repository)) {
      throw new Error('Repository must be a valid GitHub URL (e.g., https://github.com/org/repo)');
    }

    // Get API key for this channel
    const keyManager = createApiKeyManager(env.API_KEYS);
    const apiKey = await getEffectiveApiKey(channelId, keyManager, env.CURSOR_API_KEY);

    if (!apiKey) {
      throw new Error('No Cursor API key configured for this channel');
    }

    // Create webhook URL for progress updates
    const tunnelUrl = getTunnelUrl();
    const webhookUrl = `${tunnelUrl}/cursor/webhook`;

    // Create the agent
    const cursorService = new CursorApiService(apiKey);
    const agentInput = buildCreateAgentInput(prompt, repository, undefined, webhookUrl);
    const agent = await cursorService.createAgent(agentInput);

    // Store in database
    const storage = new AgentStorageService(env.DB);
    const storedAgent = mapApiAgentToStoredAgent(agent, channelId, userId);
    await storage.storeAgent(storedAgent);

    // Create Discord thread
    const botToken = getDiscordBotToken(env);
    let threadInfo = '';
    if (botToken) {
      const threadManager = createThreadManager(botToken);
      const thread = await threadManager.createAgentThread(channelId, agent.id, prompt);
      
      if (thread) {
        // Update agent with thread ID
        await storage.updateAgentThread(agent.id, thread.id);
        threadInfo = '\n📡 Updates will be posted to the created thread.';
      }
    }

    // const successMessage = `🤖 **Agent Created Successfully!**\n\n**ID:** \`${agent.id}\`\n**Status:** ${agent.status}\n**Repository:** ${repository}${threadInfo}`;
    
    // await sendFollowUpMessage(channelId, successMessage, env);
  } catch (error) {
    console.error('Failed to create agent asynchronously:', error);
    const errorMessage = `❌ **Failed to create agent:**\n${error instanceof Error ? error.message : 'Unknown error'}`;
    await sendChannelMessage(channelId, errorMessage, env);
  }
}

async function sendChannelMessage(
  channelId: string,
  content: string,
  env: Env
): Promise<void> {
  const botToken = getDiscordBotToken(env);
  if (!botToken) {
    console.error('Cannot send follow-up message: Bot token not configured');
    return;
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send follow-up message: ${response.status} - ${error}`);
    }
  } catch (error) {
    console.error('Error sending follow-up message:', error);
  }
}

/**
 * Handle /agents list command
 */
async function handleListAgents(
  subcommand: any,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  const limit = subcommand.options?.find((opt: any) => opt.name === 'limit')?.value || 10;

  try {
    const storage = new AgentStorageService(env.DB);
    const agents = await storage.listAgentsByChannel(channelId, Math.min(limit, 50));

    if (agents.length === 0) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '📋 **No agents found for this channel.**\n\nCreate your first agent with `/task` or `/agents create`!',
        },
      };
    }

    const agentList = agents.map(agent => {
      const statusEmoji = {
        'CREATING': '🏗️',
        'PENDING': '⏳',
        'RUNNING': '⚙️',
        'FINISHED': '✅',
        'ERROR': '❌',
        'EXPIRED': '⏰',
      }[agent.status] || '📡';

      const threadLink = agent.discordThreadId ? ` [Thread](https://discord.com/channels/@me/${agent.discordThreadId})` : '';
      return `${statusEmoji} **${agent.id.slice(-8)}** - ${agent.prompt.slice(0, 60)}${agent.prompt.length > 60 ? '...' : ''}${threadLink}`;
    }).join('\n');

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `📋 **Agents in this channel (${agents.length}):**\n\n${agentList}`,
      },
    };

  } catch (error) {
    console.error('Failed to list agents:', error);
    return createErrorResponse('Failed to retrieve agents');
  }
}

/**
 * Handle /agents set-default-repo command
 */
async function handleSetDefaultRepo(
  subcommand: any,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  const repository = subcommand.options?.find((opt: any) => opt.name === 'repository')?.value;

  if (!repository) {
    return createErrorResponse('Repository is required');
  }

  if (!validateGitHubUrl(repository)) {
    return createErrorResponse('Repository must be a valid GitHub URL (e.g., https://github.com/org/repo)');
  }

  try {
    const configManager = new ChannelConfigManager(env.API_KEYS);
    await configManager.setDefaultRepository(channelId, repository);

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `✅ **Default repository set!**\n\n**Repository:** ${repository}\n\nYou can now use \`/task\` without specifying a repository.`,
        flags: 64, // Ephemeral
      },
    };

  } catch (error) {
    console.error('Failed to set default repository:', error);
    return createErrorResponse('Failed to set default repository');
  }
}

/**
 * Handle /agent logs command
 */
async function handleAgentLogs(
  subcommand: any,
  channelId: string,
  env: Env
): Promise<InteractionResponse> {
  const agentId = subcommand.options?.find((opt: any) => opt.name === 'agent_id')?.value;

  if (!agentId) {
    return createErrorResponse('Agent ID is required');
  }

  try {
    // Get the agent from database first
    const storage = new AgentStorageService(env.DB);
    const agent = await storage.getAgent(agentId);

    if (!agent || agent.discordChannelId !== channelId) {
      return createErrorResponse('Agent not found in this channel');
    }

    // Get API key for this channel
    const keyManager = createApiKeyManager(env.API_KEYS);
    const apiKey = await getEffectiveApiKey(channelId, keyManager, env.CURSOR_API_KEY);

      if (!apiKey) {
    return createErrorResponseWithButton(
      'No Cursor API key configured for this channel.',
      '🔑 Set API Key',
      'set_api_key_button'
    );
  }

    // Fetch conversation logs
    const cursorService = new CursorApiService(apiKey);
    const conversation = await cursorService.getAgentConversation(agentId);

    if (!conversation.messages || conversation.messages.length === 0) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `📝 **Agent ${agentId.slice(-8)} Logs**\n\nNo conversation messages found yet.`,
        },
      };
    }

    // Format messages (truncate if too long for Discord)
    const messages = conversation.messages.slice(0, 10); // Limit to 10 messages
    const formattedMessages = messages.map((msg, index) => {
      const role = msg.role || 'unknown';
      const content = msg.content || 'No content';
      const truncatedContent = content.length > 200 ? content.slice(0, 200) + '...' : content;
      return `**${index + 1}. ${role}:** ${truncatedContent}`;
    }).join('\n\n');

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `📝 **Agent ${agentId.slice(-8)} Conversation Logs**\n\n${formattedMessages}`,
      },
    };

  } catch (error) {
    console.error('Failed to get agent logs:', error);
    return createErrorResponse(`Failed to retrieve agent logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle main /agents command
 */
async function handleAgentsCommand(interaction: any, env: Env): Promise<InteractionResponse> {
  const subcommand = interaction.data.options?.[0];
  const channelId = interaction.channel_id;
  const userId = interaction.user?.id || interaction.member?.user?.id;

  if (!channelId || !userId) {
    return createErrorResponse('Unable to identify channel or user');
  }

  switch (subcommand?.name) {
    case AGENTS_SUBCOMMANDS.SET_API_KEY:
      return await handleSetApiKey(interaction, channelId, userId, env);
    case AGENTS_SUBCOMMANDS.CREATE:
      return await handleCreateAgent(subcommand, channelId, userId, env);
    case AGENTS_SUBCOMMANDS.LIST:
      return await handleListAgents(subcommand, channelId, env);
    case AGENTS_SUBCOMMANDS.SET_DEFAULT_REPO:
      return await handleSetDefaultRepo(subcommand, channelId, env);
    default:
      return createErrorResponse('Unknown agents subcommand');
  }
}

/**
 * Handle agent command
 */
async function handleAgentCommand(interaction: any, env: Env): Promise<InteractionResponse> {
  const subcommand = interaction.data.options?.[0];
  const channelId = interaction.channel_id;

  if (!channelId) {
    return createErrorResponse('Unable to identify channel');
  }

  switch (subcommand?.name) {
    case AGENT_SUBCOMMANDS.LOGS:
      return await handleAgentLogs(subcommand, channelId, env);
    default:
      return createErrorResponse('Unknown agent subcommand');
  }
}

/**
 * Handle Discord interactions
 */
async function handleDiscordInteraction(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const internalKey = request.headers.get('X-Discord-Webhook-Secret');
  const body = await request.text();
  console.log('🔒 Interaction:\n' + JSON.stringify(JSON.parse(body), null, 2));

  if(internalKey === process.env.INTERNAL_WEBHOOK_SECRET) {
    console.log('🔒 Internal key detected');
  } else {
    const publicKey = getDiscordPublicKey(env);
    if (!publicKey) {
        console.error('Discord public key not configured');
        return errorResponse('Discord public key not configured', 500);
    }
    // Verify the request signature
    const isValidRequest = signature && timestamp && verifyKey(body, signature, timestamp, publicKey);
    if (!isValidRequest) {
    console.error('Invalid request signature', { signature, timestamp, publicKey });
    return errorResponse('Invalid request signature', 401);
    }
  }
  console.log('🔒 Request verified');

  const interaction = JSON.parse(body);

  // Store interaction for debugging
  try {
    const storage = new AgentStorageService(env.DB);
    await storage.storeInteraction(interaction);
    console.log('🔒 Interaction stored');
  } catch (error) {
    console.error('Failed to store interaction:', error);
  }

  // Handle webhook events (when bot is added to server)
  const { event } = interaction;
  
  if (event && event.type === 'APPLICATION_AUTHORIZED') {
    const { user, integration_type } = event.data;
    console.log('🔒 Application authorized', { user, integration_type });
    
    // Check if bot token is available for command registration
    const botToken = getDiscordBotToken(env);
    if (!botToken) {
      console.error('🔒 Cannot register commands: Bot token not set. Please set your Discord bot token via environment variable or secret.');
      return jsonResponse({ 
        error: 'Bot token required for command registration',
        message: 'Please set the Discord bot token to enable command registration when added to servers'
      }, 200); // Still return 200 to Discord to acknowledge the event
    }
    
    console.log('🔒 Authorized:', JSON.stringify(event, null, 2));
    // If there's a guild_id in the interaction, register commands for that guild
    if (event.data?.guild?.id) {
      console.log(`🎯 Bot added to guild ${event.data.guild.id}, registering commands...`);
      
      // Register commands for this guild (don't await to avoid timeout)
      await registerGuildCommands(env, event.data.guild.id).catch(error => {
        console.error(`❌ Failed to register commands for guild ${event.data.guild.id}:`, error);
      });
      console.log('🔒 Commands registered for guild:', event.data.guild.id);
    }
    
    return jsonResponse({
      message: 'Bot successfully added to server, commands are being registered'
    });
  }

  // Handle GUILD_CREATE event (when bot joins a guild)
  if (interaction.t === 'GUILD_CREATE') {
    const guildData = interaction.d;
    console.log(`🏰 Bot joined guild: ${guildData.name} (ID: ${guildData.id})`);
    
    // Register commands for this new guild (don't await to avoid timeout)
    registerGuildCommands(env, guildData.id).catch(error => {
      console.error(`❌ Failed to register commands for guild ${guildData.id}:`, error);
    });
    
    return jsonResponse({
      message: `Bot joined guild ${guildData.name}, commands are being registered`
    });
  }

  let response: InteractionResponse;

  switch (interaction.type) {
    case InteractionType.PING:
      response = { type: InteractionResponseType.PONG };
      break;

    case InteractionType.APPLICATION_COMMAND:
      const { data, user, member, channel_id } = interaction;
      const commandName = data?.name;
      const userId = user?.id || member?.user?.id;

      console.log('🎮 Handling command:', commandName, 'from user:', userId, 'in channel:', channel_id);

      switch (commandName) {
        case COMMAND_NAMES.AGENTS:
          response = await handleAgentsCommand(interaction, env);
          break;
        case COMMAND_NAMES.TASK:
          response = await handleTaskCommand(data, channel_id, userId, env, ctx);
          break;
        case COMMAND_NAMES.AGENT:
          response = await handleAgentCommand(interaction, env);
          break;
        default:
          response = createErrorResponse(`Unknown command: ${commandName}`);
      }
      console.log('🔒 Response:', response);
      break;

    case InteractionType.MODAL_SUBMIT:
      const modalData = interaction.data;
      const modalChannelId = interaction.channel_id;
      
      if (modalData?.custom_id?.startsWith('api_key_modal_')) {
        response = await handleApiKeyModalSubmit(interaction as ModalSubmitInteraction, modalChannelId, env);
      } else if (modalData?.custom_id?.startsWith('default_repo_modal_')) {
        response = await handleDefaultRepoModalSubmit(interaction as ModalSubmitInteraction, modalChannelId, env);
      } else {
        response = createErrorResponse('Unknown modal submission');
      }
      break;

    case InteractionType.MESSAGE_COMPONENT:
      const componentData = interaction.data;
      const componentChannelId = interaction.channel_id;
      const componentUserId = interaction.user?.id || interaction.member?.user?.id;
      
      if (componentData?.custom_id === 'set_api_key_button') {
        // Handle the "Set API Key" button click by showing the modal
        response = await handleSetApiKey(interaction, componentChannelId, componentUserId, env);
      } else if (componentData?.custom_id === 'set_default_repo_button') {
        // Handle the "Set Default Repository" button click by showing the modal
        response = await handleSetDefaultRepoButton(interaction, componentChannelId, componentUserId, env);
      } else {
        response = createErrorResponse('Unknown button interaction');
      }
      break;

    default:
      response = createErrorResponse('Unknown interaction type');
  }

  console.log('Returning response');
  return jsonResponse(response);
}

async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  
  console.log("Request:", request.method, url.pathname);
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  try {
    // Discord interactions endpoint
    if (url.pathname === '/discord/interactions' || url.pathname === '/interactions' && request.method === 'POST') {
      // Check if this is a thread interaction (type 99) from Discord event forwarder
      try {
        const clonedRequest = request.clone();
        const interactionData = await clonedRequest.json() as any;
        
        if (interactionData && typeof interactionData === 'object' && interactionData.type === 99) {
          // Handle thread interactions for follow-up messages
          console.log('🧵 Received thread interaction, delegating to thread handler', interactionData);
          return await handleThreadInteraction(request, env);
        }
      } catch (error) {
        // If we can't parse the JSON, fall through to regular Discord interaction handling
        console.log('Failed to parse interaction data, treating as regular Discord interaction');
      }

      // Handle regular Discord slash command interactions
      return await handleDiscordInteraction(request, env, ctx);
    }
    
    // Cursor webhook endpoint
    if (url.pathname === '/cursor/webhook' && request.method === 'POST') {
      return await handleCursorWebhook(request, env);
    }
    
    // API endpoint for listing all agents (for web UI)
    if (url.pathname === '/api/agents' && request.method === 'GET') {
      const storage = new AgentStorageService(env.DB);
      const agents = await storage.listAllAgents();
      return jsonResponse({ agents });
    }

    // API endpoint for service info
    if (url.pathname === '/api/service-info' && request.method === 'GET') {
      const storage = new AgentStorageService(env.DB);
      const allAgents = await storage.listAllAgents();
      
      const serviceInfo: ServiceInfo = {
        hasApiKey: !!env.CURSOR_API_KEY,
        hasBotToken: !!getDiscordBotToken(env),
        hasPublicKey: !!getDiscordPublicKey(env),
        webhookUrl: `${getTunnelUrl()}/cursor/webhook`,
        setupComplete: !!(env.CURSOR_API_KEY && getDiscordBotToken(env) && getDiscordPublicKey(env)),
        totalAgents: allAgents.length,
        activeAgents: allAgents.filter(a => ['CREATING', 'PENDING', 'RUNNING'].includes(a.status)).length,
      };

      return jsonResponse(serviceInfo);
    }

    // API endpoint for tunnel URL
    if (url.pathname === '/api/tunnel-url' && request.method === 'GET') {
      return jsonResponse({ 
        tunnelUrl: getTunnelUrl(),
        source: 'cloudflare-tunnel' 
      });
    }

    // API endpoint for Discord invite link
    if (url.pathname === '/api/invite-link' && request.method === 'GET') {
      try {
        const effectiveBotToken = getDiscordBotToken(env);
        
        if (!effectiveBotToken) {
          return errorResponse('Discord bot token not configured. Please set the Discord bot token first to generate an invite link.');
        }
        
        // Get the application ID using our helper function
        let applicationId: string;
        try {
          const appInfo = await getCurrentApplication(env);
          applicationId = appInfo.id;
        } catch (error) {
          return errorResponse(`Failed to fetch application info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // I think the raw client id link is enough at the moment.
        //const inviteLink = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=2147483648&scope=bot%20applications.commands`;
        const inviteLink = `https://discord.com/oauth2/authorize?client_id=${applicationId}`;
        
        return jsonResponse({
          success: true,
          inviteLink,
          applicationId,
          message: 'Invite link generated successfully'
        });
        
      } catch (error) {
        console.error('Error generating invite link:', error);
        return errorResponse(`Failed to generate invite link: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // API endpoint to get recent interactions
    if (url.pathname === '/api/interactions' && request.method === 'GET') {
      try {
        const storage = new AgentStorageService(env.DB);
        
        // Fetch recent interactions from database (limit to 20)
        const result = await env.DB.prepare(`
          SELECT id, timestamp, type, data, user_id, user_username 
          FROM interactions 
          ORDER BY timestamp DESC 
          LIMIT 20
        `).all();
        
        const interactions = (result.results || []).map((row: any) => ({
          id: row.id,
          timestamp: row.timestamp,
          type: row.type,
          data: row.data ? JSON.parse(row.data) : {},
          user: row.user_id ? {
            id: row.user_id,
            username: row.user_username || 'Unknown'
          } : undefined
        }));
        
        return jsonResponse({ interactions });
      } catch (error) {
        console.error('Failed to fetch interactions:', error);
        return jsonResponse({ interactions: [] });
      }
    }

    // Serve the frontend
    return new Response('Discord Cursor Bot is running! 🤖', {
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('Worker error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Main worker export
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await handleFetch(request, env, ctx);
    console.log('🔒 Response:', response.status);
    return response;
  },
};
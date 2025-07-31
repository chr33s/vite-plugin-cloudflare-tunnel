import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';



import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';



/**
 * Environment variables interface for the Cloudflare Worker
 */
interface Env {
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  // Add other environment variables as needed
}

/**
 * Stored interaction data structure
 */
interface StoredInteraction {
  id: number;
  timestamp: string;
  type: string;
  data: any;
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  raw: any;
}

/**
 * Discord interaction response structure
 */
interface InteractionResponse {
  type: InteractionResponseType;
  data?: {
    content?: string;
    flags?: number;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      footer?: {
        text: string;
        icon_url?: string;
      };
      timestamp?: string;
    }>;
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        style?: number;
        label?: string;
        custom_id?: string;
        emoji?: {
          name: string;
        };
      }>;
    }>;
  };
}

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature-Ed25519, X-Signature-Timestamp',
} as const;

// In-memory storage for interactions (in production, use KV or D1)
let interactions: StoredInteraction[] = [];

// In-memory storage for Discord public key (development convenience)
let inMemoryDiscordPublicKey: string | null = null;

// In-memory storage for Discord bot token (development convenience)
let inMemoryDiscordBotToken: string | null = null;

/**
 * Get the effective Discord public key (from environment or memory)
 */
function getDiscordPublicKey(env: Env): string | null {
  return env.DISCORD_PUBLIC_KEY || inMemoryDiscordPublicKey;
}

/**
 * Get the effective Discord bot token (from environment or memory)
 */
function getDiscordBotToken(env: Env): string | null {
  return env.DISCORD_BOT_TOKEN || inMemoryDiscordBotToken;
}

/**
 * Check if we're in development mode (detect if running with Vite/dev server)
 */
function isDevelopmentMode(): boolean {
  // Check various indicators that we're in development
  return (globalThis as any).process?.env?.NODE_ENV === 'development' || process?.env?.DEV === 'true' ||
         !!(globalThis as any).__VITE_DEV__;
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
    
    const applicationData = await response.json();
    console.log('✅ Retrieved application info:', {
      id: applicationData.id,
      name: applicationData.name,
      description: applicationData.description
    });
    
    return applicationData;
  } catch (error) {
    console.error('❌ Failed to get current application:', error);
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    console.log("request.url", request.url, url.pathname);
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    try {
      // Discord webhook endpoint
      if (url.pathname === '/discord/interactions' && request.method === 'POST') {
        return await handleDiscordInteraction(request, env);
      }
      
      // API endpoint to get recent interactions
      if (url.pathname === '/api/interactions' && request.method === 'GET') {
        return okJson({ interactions: interactions.slice(0, 20) });
      }
      
      // API endpoint to get bot info
      if (url.pathname === '/api/bot-info' && request.method === 'GET') {
        const effectivePublicKey = getDiscordPublicKey(env);
        const effectiveBotToken = getDiscordBotToken(env);
        
        let taskCommandRegistered = false;
        let commandsInfo = null;
        
        // Check if commands are registered by querying Discord API
        if (effectiveBotToken) {
          try {
            const commandsResult = await getRegisteredCommands(env);
            commandsInfo = commandsResult;
            taskCommandRegistered = commandsResult.commands.some(cmd => cmd.name === 'task');
          } catch (error) {
            console.warn('Failed to check registered commands:', error);
            commandsInfo = { error: 'Failed to fetch commands from Discord API' };
          }
        }
        
        const botInfo = {
          hasPublicKey: !!effectivePublicKey,
          hasBotToken: !!effectiveBotToken,
          webhookUrl: `${url.origin}/discord/interactions`,
          setupComplete: !!effectivePublicKey, // Public key is required, bot token is optional
          taskCommandRegistered,
          registeredCommands: commandsInfo
        };
        return okJson(botInfo);
      }
      
      // API endpoint to set Discord public key
      if (url.pathname === '/api/set-public-key' && request.method === 'POST') {
        try {
          const body = await request.json() as { publicKey: string };
          const { publicKey } = body;
          
          // Validate the public key
          if (!publicKey || typeof publicKey !== 'string') {
            return errorJson('Public key is required and must be a string');
          }
          
          if (publicKey.length !== 64) {
            return errorJson('Public key must be exactly 64 characters long');
          }
          
          if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
            return errorJson('Public key must contain only hexadecimal characters (0-9, a-f, A-F)');
          }
          
          // Store in memory
          inMemoryDiscordPublicKey = publicKey;
          
          const result: any = {
            success: true,
            message: 'Discord public key set successfully',
            inMemoryOnly: true,
            savedToWrangler: false
          };
          
          // In development mode, provide helpful guidance for persisting the key
          if (isDevelopmentMode()) {
            result.message += ' (stored in memory for this session)';
            result.developmentModeNote = 'For persistence across restarts, also run: wrangler secret put DISCORD_PUBLIC_KEY';
            result.wranglerCommand = `echo "${publicKey}" | wrangler secret put DISCORD_PUBLIC_KEY`;
            result.nextSteps = [
              'The public key is now active for this session',
              'To persist it across dev server restarts, copy the command above',
              'Run it in your terminal to save as a Cloudflare secret',
              'You can then proceed to Step 3 to configure the Discord endpoint'
            ];
          } else {
            result.nextSteps = [
              'The public key is now active for this session',
              'You can now proceed to Step 3 to configure the Discord endpoint'
            ];
          }
          
          console.log('✅ Discord public key set in memory:', publicKey.substring(0, 6) + '...');
          
          return okJson(result);
          
        } catch (error) {
          console.error('Error setting Discord public key:', error);
          return errorJson(
            'Failed to process request',
            undefined,
            500,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
      
      // API endpoint to set Discord bot token
      if (url.pathname === '/api/set-bot-token' && request.method === 'POST') {
        try {
          const body = await request.json() as { botToken: string };
          const { botToken } = body;
          
          // Validate the bot token
          if (!botToken || typeof botToken !== 'string') {
            return errorJson('Bot token is required and must be a string');
          }
          
          // Basic Discord bot token format validation
          // Bot tokens typically start with 'Bot ' or are just the token part
          const tokenPart = botToken.startsWith('Bot ') ? botToken.slice(4) : botToken;
          
          // Discord bot tokens are typically 24+ characters and contain base64-like characters
          if (tokenPart.length < 24) {
            return errorJson('Bot token appears to be too short. Please check the token format.');
          }
          
          // Basic format check (Discord tokens contain alphanumeric, dots, dashes, underscores)
          if (!/^[A-Za-z0-9._-]+$/.test(tokenPart)) {
            return errorJson('Bot token contains invalid characters. Please verify your token.');
          }
          
          // Store the token without 'Bot ' prefix (we'll add it when needed)
          inMemoryDiscordBotToken = tokenPart;
          
          const result: any = {
            success: true,
            message: 'Discord bot token set successfully',
            inMemoryOnly: true,
            savedToWrangler: false
          };
          
          // In development mode, provide helpful guidance for persisting the token
          if (isDevelopmentMode()) {
            result.message += ' (stored in memory for this session)';
            result.developmentModeNote = 'For persistence across restarts, also run: wrangler secret put DISCORD_BOT_TOKEN';
            result.wranglerCommand = `echo "${tokenPart}" | wrangler secret put DISCORD_BOT_TOKEN`;
            result.nextSteps = [
              'The bot token is now active for this session',
              'To persist it across dev server restarts, copy the command above',
              'Run it in your terminal to save as a Cloudflare secret',
              'This token enables DM functionality and other bot features'
            ];
          } else {
            result.nextSteps = [
              'The bot token is now active for this session',
              'This token enables DM functionality and other bot features'
            ];
          }
          
          console.log('✅ Discord bot token set in memory:', tokenPart.substring(0, 6) + '...');
          
          return okJson(result);
          
        } catch (error) {
          console.error('Error setting Discord bot token:', error);
          return errorJson(
            'Failed to process request',
            undefined,
            500,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
      
      // API endpoint to get registered commands from Discord
      if (url.pathname === '/api/registered-commands' && request.method === 'GET') {
        try {
          const effectiveBotToken = getDiscordBotToken(env);
          
          if (!effectiveBotToken) {
            return errorJson(
              'Discord bot token not configured',
              'Please set the Discord bot token first to fetch registered commands'
            );
          }
          
          const commandsResult = await getRegisteredCommands(env);
          return okJson(commandsResult);
          
        } catch (error) {
          console.error('Error fetching registered commands:', error);
          return errorJson(
            'Failed to fetch commands',
            error instanceof Error ? error.message : 'Unknown error',
            500
          );
        }
      }
      
      // API endpoint to generate invite link
      if (url.pathname === '/api/invite-link' && request.method === 'GET') {
        try {
          const effectiveBotToken = getDiscordBotToken(env);
          
          if (!effectiveBotToken) {
            return errorJson(
              'Discord bot token not configured',
              'Please set the Discord bot token first to generate an invite link'
            );
          }
          
          // Get the application ID using our helper function
          let applicationId: string;
          try {
            const appInfo = await getCurrentApplication(env);
            applicationId = appInfo.id;
          } catch (error) {
            return errorJson(
              'Failed to fetch application info',
              'Unable to get application ID from Discord API',
              400,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${applicationId}`;
          
          return okJson({
            success: true,
            inviteLink,
            applicationId,
            message: 'Invite link generated successfully'
          });
          
        } catch (error) {
          console.error('Error generating invite link:', error);
          return errorJson(
            'Failed to generate invite link',
            error instanceof Error ? error.message : 'Unknown error',
            500
          );
        }
      }
      
      // API endpoint to register /task command globally
      if (url.pathname === '/api/register-task-command' && request.method === 'POST') {
        try {
          const effectivePublicKey = getDiscordPublicKey(env);
          const effectiveBotToken = getDiscordBotToken(env);
          
          if (!effectivePublicKey) {
            return errorJson(
              'Discord public key not configured',
              'Please set the Discord public key first'
            );
          }
          
          if (!effectiveBotToken) {
            return errorJson(
              'Discord bot token not configured',
              'Please set the Discord bot token first - it\'s required to register commands'
            );
          }
          
          // Get the application ID using our helper function
          let applicationId: string;
          try {
            const appInfo = await getCurrentApplication(env);
            applicationId = appInfo.id;
          } catch (error) {
            return errorJson(
              'Failed to fetch application info',
              'Unable to get application ID from Discord API',
              400,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          
          // Define the /task command with subcommands
          const taskCommand = {
            name: 'task',
            description: 'Manage your tasks with create, list, complete, and delete operations',
            type: 1, // CHAT_INPUT
            options: [
              {
                type: 1, // SUB_COMMAND
                name: 'create',
                description: 'Create a new task',
                options: [
                  {
                    type: 3, // STRING
                    name: 'title',
                    description: 'The title of the task',
                    required: true,
                    max_length: 100
                  },
                  {
                    type: 3, // STRING
                    name: 'description',
                    description: 'Optional description for the task',
                    required: false,
                    max_length: 500
                  },
                  {
                    type: 3, // STRING
                    name: 'priority',
                    description: 'Task priority level',
                    required: false,
                    choices: [
                      { name: 'Low', value: 'low' },
                      { name: 'Medium', value: 'medium' },
                      { name: 'High', value: 'high' },
                      { name: 'Urgent', value: 'urgent' }
                    ]
                  }
                ]
              },
              {
                type: 1, // SUB_COMMAND
                name: 'list',
                description: 'List your tasks',
                options: [
                  {
                    type: 3, // STRING
                    name: 'status',
                    description: 'Filter tasks by status',
                    required: false,
                    choices: [
                      { name: 'All', value: 'all' },
                      { name: 'Pending', value: 'pending' },
                      { name: 'Completed', value: 'completed' }
                    ]
                  }
                ]
              },
              {
                type: 1, // SUB_COMMAND
                name: 'complete',
                description: 'Mark a task as completed',
                options: [
                  {
                    type: 4, // INTEGER
                    name: 'task_id',
                    description: 'The ID of the task to complete',
                    required: true,
                    min_value: 1
                  }
                ]
              },
              {
                type: 1, // SUB_COMMAND
                name: 'delete',
                description: 'Delete a task permanently',
                options: [
                  {
                    type: 4, // INTEGER
                    name: 'task_id',
                    description: 'The ID of the task to delete',
                    required: true,
                    min_value: 1
                  }
                ]
              }
            ]
          };
          
          // Register the command with Discord
          const discordResponse = await discordApiRequest(`/applications/${applicationId}/commands`, {
            method: 'POST',
            body: taskCommand,
            botToken: effectiveBotToken
          });
          
          if (!discordResponse.ok) {
            const error = await discordResponse.json();
            console.error('Discord API error:', error);
            return errorJson(
              'Failed to register command with Discord',
              'Discord API returned an error',
              400,
              error
            );
          }
          
          const commandData = await discordResponse.json();
          console.log('✅ /task command registered successfully:', commandData.id);
          
          return okJson({
            success: true,
            message: '/task command registered successfully',
            commandId: commandData.id,
            applicationId: applicationId,
            commandData: commandData
          });
          
        } catch (error) {
          console.error('Error registering /task command:', error);
          return errorJson(
            'Failed to register command',
            error instanceof Error ? error.message : 'Unknown error',
            500
          );
        }
      }
      
      // Discord validation test endpoint
      if (url.pathname === '/discord/validate' && request.method === 'GET') {
        const effectivePublicKey = getDiscordPublicKey(env);
        const validationInfo = {
          endpoint: `${url.origin}/discord/interactions`,
          hasPublicKey: !!effectivePublicKey,
          publicKeyPreview: effectivePublicKey ? 
            `${effectivePublicKey.substring(0, 6)}...${effectivePublicKey.substring(-6)}` : 
            null,
          ready: !!effectivePublicKey,
          instructions: {
            step1: 'Set your Discord bot public key: wrangler secret put DISCORD_PUBLIC_KEY',
            step2: `Set Interactions Endpoint URL in Discord: ${url.origin}/discord/interactions`,
            step3: 'Discord will send a PING request to validate the endpoint'
          },
          testEndpoints: {
            '/test/ping': 'POST - Test PING simulation',
            '/test/signature': 'POST - Test signature validation'
          }
        };
        
        return okJson(validationInfo);
      }

      // API endpoint to get tunnel URL (demonstrates virtual module usage)
      if (url.pathname === '/tunnel-url' && request.method === 'GET') {
        try {
          const tunnelUrl = await getTunnelUrl();
          return okJson({ 
            tunnelUrl,
            source: 'virtual:vite-plugin-cloudflare-tunnel'
          });
        } catch (error) {
          return errorJson(
            'Virtual module not available',
            'This endpoint only works during development',
            503
          );
        }
      }
      
      // Enhanced health check endpoint with Discord status
      if (url.pathname === '/health' && request.method === 'GET') {
        const effectivePublicKey = getDiscordPublicKey(env);
        const healthStatus = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          interactions_received: interactions.length,
          discord: {
            public_key_configured: !!effectivePublicKey,
            endpoint_ready: !!effectivePublicKey,
            last_interaction: interactions.length > 0 ? interactions[0]?.timestamp : null,
            validation_endpoint: `${url.origin}/discord/validate`
          }
        };
        
        return okJson(healthStatus);
      }
      
      // Test endpoints for Discord validation
      if (url.pathname === '/test/ping' && request.method === 'POST') {
        console.log('🧪 Test PING endpoint called');
        
        // Simulate a Discord PING request response
        const mockPingResponse = {
          type: 1, // PONG
          message: 'Test PING successful - your endpoint would respond correctly to Discord'
        };
        
        return okJson(mockPingResponse);
      }
      
      if (url.pathname === '/test/signature' && request.method === 'POST') {
        const effectivePublicKey = getDiscordPublicKey(env);
        if (!effectivePublicKey) {
          return errorJson(
            'Discord public key not configured',
            'Set using the form in Step 2 or: wrangler secret put DISCORD_PUBLIC_KEY'
          );
        }
        
        const testResult = {
          public_key_length: effectivePublicKey.length,
          public_key_valid: /^[0-9a-fA-F]{64}$/.test(effectivePublicKey),
          verification_library: 'discord-interactions',
          ready_for_discord: effectivePublicKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(effectivePublicKey)
        };
        
        return okJson(testResult);
      }

      // Default response for other paths
      return jsonResponse({
        message: 'Discord Bot Webhook Receiver - Cloudflare Worker',
        endpoints: {
          '/discord/interactions': 'POST - Discord webhook endpoint',
          '/api/interactions': 'GET - Recent interactions',
          '/api/bot-info': 'GET - Bot configuration status',
          '/api/registered-commands': 'GET - Get registered Discord commands',
          '/api/set-public-key': 'POST - Set Discord public key',
          '/api/set-bot-token': 'POST - Set Discord bot token',
          '/api/invite-link': 'GET - Generate Discord invite link',
          '/api/register-task-command': 'POST - Register /task command globally',
          '/discord/validate': 'GET - Discord endpoint validation info',
          '/tunnel-url': 'GET - Get tunnel URL (development only)',
          '/health': 'GET - Enhanced health check with Discord status',
          '/test/ping': 'POST - Test PING response simulation',
          '/test/signature': 'POST - Test signature validation setup'
        }
      }, 404);
      
    } catch (error: unknown) {
      console.error('Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return errorJson('Internal server error', errorMessage, 500);
    }
  },
};

/**
 * Handle Discord interaction webhook requests with proper signature verification
 */
async function handleDiscordInteraction(request: Request, env: Env): Promise<Response> {
  // Check if Discord public key is configured
  const effectivePublicKey = getDiscordPublicKey(env);
  if (!effectivePublicKey) {
    return errorJson(
      'Discord public key not configured',
      'Please set the Discord public key using the form in Step 2 or via: wrangler secret put DISCORD_PUBLIC_KEY'
    );
  }

  // Get signature headers with case-insensitive handling
  const signature = request.headers.get('X-Signature-Ed25519') || request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp') || request.headers.get('x-signature-timestamp');
  
  // Enhanced validation logging
  console.log('🔒 Validating Discord signature', {
    hasSignature: !!signature,
    hasTimestamp: !!timestamp,
    timestampAge: timestamp ? Date.now() - parseInt(timestamp) * 1000 : null
  });
  
  if (!signature || !timestamp) {
    console.warn('⚠️ Missing Discord signature headers');
    logValidationAttempt(request, false, 'missing_headers');
    return errorJson(
      'Missing signature headers',
      'Discord signature headers are required',
      401,
      {
        received_headers: {
          'x-signature-ed25519': !!request.headers.get('x-signature-ed25519'),
          'X-Signature-Ed25519': !!request.headers.get('X-Signature-Ed25519'),
          'x-signature-timestamp': !!request.headers.get('x-signature-timestamp'),
          'X-Signature-Timestamp': !!request.headers.get('X-Signature-Timestamp')
        }
      }
    );
  }
  
  // Optional timestamp freshness check (Discord recommends within 5 minutes)
  if (timestamp) {
    const timestampMs = parseInt(timestamp) * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - timestampMs) > fiveMinutes) {
      console.warn('⚠️ Request timestamp is potentially stale', {
        timestampAge: Math.abs(now - timestampMs),
        maxAge: fiveMinutes
      });
      // Continue processing but log the warning
    }
  }

  // Enhanced request body handling with validation
  let body: string;
  try {
    body = await request.text();
    console.log('🔍 Request body:', body);
    if (!body || body.trim().length === 0) {
      throw new Error('Empty request body');
    }
  } catch (error) {
    console.error('❌ Failed to read request body:', error);
    logValidationAttempt(request, false, 'invalid_body');
    return errorJson('Invalid request body', 'Unable to read request body');
  }
  
  // Verify Discord signature with enhanced error handling
  let isValidRequest: boolean;
  try {
    isValidRequest = verifyKey(body, signature, timestamp, effectivePublicKey);
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    logValidationAttempt(request, false, 'signature_verification_error');
    
    return errorJson(
      'Signature verification failed',
      'Unable to verify request signature',
      401,
      error instanceof Error ? error.message : 'Unknown verification error'
    );
  }
  
  if (!isValidRequest) {
    console.warn('⚠️ Invalid Discord signature');
    logValidationAttempt(request, false, 'invalid_signature');
    
    return errorJson('Invalid signature', 'Discord signature verification failed', 401);
  }
  
  logValidationAttempt(request, true);

  // Enhanced interaction parsing with validation
  let interaction: any;
  try {
    interaction = JSON.parse(body);
    
    // Validate required fields
    if (typeof interaction.type !== 'number') {
      throw new Error('Missing or invalid interaction type');
    }
    
  } catch (error) {
    console.error('❌ Failed to parse interaction JSON:', error);
    return errorJson(
      'Invalid JSON payload',
      error instanceof Error ? error.message : 'Unable to parse JSON'
    );
  }
  
  const { type, data, member, user, event } = interaction;

  console.log('📥 Received Discord interaction:', { type, data: data?.name || 'unknown' });
  
  // Store the interaction for display in the UI
  interactions.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: getInteractionTypeName(type),
    data: data,
    user: user || member?.user,
    raw: interaction
  });

  // Keep only the last 50 interactions
  if (interactions.length > 50) {
    interactions.splice(50);
  }

  if(event && event.type === 'APPLICATION_AUTHORIZED') {
    const { user, integration_type } = event.data;
    console.log('🔒 Application authorized', { user, integration_type });
    
    // Check if bot token is available for DM functionality
    const botToken = getDiscordBotToken(env);
    if (!botToken) {
      console.error('🔒 Cannot create DM channel: Bot token not set. Please set your Discord bot token via the web interface or environment variable.');
      return jsonResponse({ 
        error: 'Bot token required for DM functionality',
        message: 'Please set the Discord bot token using the form in Step 2.5 or via: wrangler secret put DISCORD_BOT_TOKEN'
      }, 200); // Still return 200 to Discord to acknowledge the event
    }
    
    // hit the /users/@me/channels endpoint to make a dm channel with the user
    const dmChannel = await discordApiRequest('/users/@me/channels', {
      method: 'POST',
      body: {
        recipient_id: user.id
      },
      botToken: botToken
    });

    const dmChannelData = await dmChannel.json();
    console.log('🔒 DM channel created', dmChannelData);
    // send a message to the dm channel
    const dmMessage = await discordApiRequest(`/channels/${dmChannelData.id}/messages`, {
      method: 'POST',
      body: {
        content: "🎉 **Welcome to the Cloudflare Tunnel Bot!**",
        embeds: [
          {
            title: "✨ Authorization Successful!",
            description: "You've been successfully authorized to use this bot. This powerful integration connects **Discord** with **Cloudflare Workers** through **Cloudflare Tunnel**!\n\n🚀 **What you can do now:**",
            color: 0xF38020, // Cloudflare orange
            fields: [
              {
                name: "💬 Direct Messages",
                value: "Use slash commands right here in your DMs for private interactions",
                inline: true
              },
              {
                name: "⚡ Lightning Fast",
                value: "Responses powered by Cloudflare's global edge network",
                inline: true
              },
              {
                name: "🔧 TypeScript Powered",
                value: "Full type safety and modern development experience",
                inline: true
              },
              {
                name: "🛠️ Available Commands",
                value: "Try `/hello` or `/info` to get started with your first command!",
                inline: false
              }
            ],
            footer: {
              text: "Built with Cloudflare Tunnel + Vite Plugin",
              icon_url: "https://developers.cloudflare.com/assets/cf-logo-v-rgb-rev.png"
            },
            timestamp: new Date().toISOString()
          }
        ],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 1, // Primary style (blue)
                label: "🚀 Try Your First Command",
                custom_id: "try_first_command",
                emoji: {
                  name: "⚡"
                }
              },
              {
                type: 2, // Button
                style: 2, // Secondary style (gray)
                label: "📚 Learn More",
                custom_id: "learn_more",
                emoji: {
                  name: "💡"
                }
              }
            ]
          }
        ]
      },
      botToken: botToken
    });

    console.log('🔒 DM message sent', dmMessage);

    return okJson({});
  }

  // Handle different interaction types
  let response: InteractionResponse;
  switch (type) {
    case InteractionType.PING:

      console.log('🏓 Responding to Discord PING validation', {
        timestamp: new Date().toISOString(),
        origin: request.headers.get('origin'),
        userAgent: request.headers.get('user-agent')
      });
      
      // Use explicit number format for maximum Discord compatibility
      const pingResponse = {
        type: 1 // Explicitly use number 1 instead of InteractionResponseType.PONG
      };
      
      return okJson(pingResponse);

    case InteractionType.APPLICATION_COMMAND:
      console.log('⚡ Handling slash command:', data?.name);
      
      if (data?.name === 'task') {
        // Handle /task command with subcommands
        const subcommand = data.options?.[0];
        const subcommandName = subcommand?.name;
        
        switch (subcommandName) {
          case 'create':
            const title = subcommand.options?.find((opt: any) => opt.name === 'title')?.value || 'Untitled Task';
            const description = subcommand.options?.find((opt: any) => opt.name === 'description')?.value || 'No description provided';
            const priority = subcommand.options?.find((opt: any) => opt.name === 'priority')?.value || 'medium';
            
            // Generate a simple task ID (in a real app, you'd use a database)
            const taskId = Math.floor(Math.random() * 10000) + 1;
            
            const taskCreationEmbed = createTaskEmbed({
              title: "✅ Task Created Successfully!",
              color: 0x28a745,
              fields: [
                {
                  name: "📋 Task ID",
                  value: `#${taskId}`,
                  inline: true
                },
                {
                  name: "📝 Title",
                  value: title,
                  inline: true
                },
                {
                  name: "⚡ Priority",
                  value: priority.charAt(0).toUpperCase() + priority.slice(1),
                  inline: true
                },
                {
                  name: "📄 Description",
                  value: description,
                  inline: false
                }
              ],
              includeTimestamp: true
            });
            
            response = createEmbedResponse(taskCreationEmbed, createTaskActionButtons(taskId));
            break;
            
          case 'list':
            const statusFilter = subcommand.options?.find((opt: any) => opt.name === 'status')?.value || 'all';
            
            response = {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                embeds: [{
                  title: "📋 Your Task List",
                  description: `**Filter:** ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} tasks\n\n` +
                              `*This is a demo - in a real application, you would store and retrieve tasks from a database like Cloudflare D1 or KV.*`,
                  color: 0x5865f2,
                  fields: [
                    {
                      name: "📝 Sample Task #1001",
                      value: "📄 Learn Cloudflare Workers\n⚡ Priority: High\n✅ Status: Completed",
                      inline: true
                    },
                    {
                      name: "📝 Sample Task #1002", 
                      value: "📄 Build Discord bot\n⚡ Priority: Medium\n⏳ Status: Pending",
                      inline: true
                    },
                    {
                      name: "📝 Sample Task #1003",
                      value: "📄 Deploy to production\n⚡ Priority: Low\n⏳ Status: Pending", 
                      inline: true
                    }
                  ],
                  footer: {
                    text: "💡 Use /task create to add new tasks"
                  }
                }]
              },
            };
            break;
            
          case 'complete':
            const completeTaskId = subcommand.options?.find((opt: any) => opt.name === 'task_id')?.value;
            
            response = createEmbedResponse(createTaskCompletionEmbed(completeTaskId, 'command'));
            break;
            
          case 'delete':
            const deleteTaskId = subcommand.options?.find((opt: any) => opt.name === 'task_id')?.value;
            
            response = createEmbedResponse(createTaskDeletionEmbed(deleteTaskId, 'command'));
            break;
            
          default:
            response = {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `❓ **Unknown /task subcommand**: \`${subcommandName || 'none'}\`\n\n` +
                        `**Available subcommands:**\n` +
                        `• \`/task create\` - Create a new task\n` +
                        `• \`/task list\` - List your tasks\n` +
                        `• \`/task complete\` - Mark a task as completed\n` +
                        `• \`/task delete\` - Delete a task`,
                flags: 64 // Ephemeral
              },
            };
        }
      } else {
        // Handle other commands with generic response
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Hello! You used the \`/${data?.name || 'unknown'}\` command. This response came from your Cloudflare Worker via Cloudflare Tunnel! 🎉🔥\n\n**TypeScript Demo**: This worker uses proper TypeScript types and the virtual module for tunnel URL access.`,
          },
        };
      }
      break;

    case InteractionType.MESSAGE_COMPONENT:
      console.log('🔘 Handling button/component interaction');
      const buttonId = data?.custom_id;
      
      if (buttonId?.startsWith('complete_task_')) {
        const taskId = buttonId.replace('complete_task_', '');
        response = createEmbedResponse(createTaskCompletionEmbed(taskId, 'button'), undefined, 64);
      } else if (buttonId?.startsWith('delete_task_')) {
        const taskId = buttonId.replace('delete_task_', '');
        response = createEmbedResponse(createTaskDeletionEmbed(taskId, 'button'), undefined, 64);
      } else if (buttonId === 'try_first_command') {
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `🎯 **Great choice!** Let's get you started:\n\n**Available Commands:**\n\`/hello\` - Get a friendly greeting\n\`/info\` - Learn about this bot\n\n💡 **Pro Tip**: You can use these commands right here in DMs or in any server where this bot is installed!\n\n🚀 **Try typing** \`/hello\` **now!**`,
            flags: 64 // Ephemeral message (only visible to the user)
          },
        };
      } else if (buttonId === 'learn_more') {
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: "🧠 About This Bot",
                description: "This Discord bot showcases the power of modern serverless architecture!",
                color: 0x5865F2, // Discord Blurple
                fields: [
                  {
                    name: "🏗️ Architecture",
                    value: "**Cloudflare Workers** + **Cloudflare Tunnel** + **TypeScript**",
                    inline: false
                  },
                  {
                    name: "⚡ Performance",
                    value: "Deployed to 300+ edge locations worldwide for ultra-low latency",
                    inline: true
                  },
                  {
                    name: "🔒 Security",
                    value: "Zero-trust architecture with encrypted tunnels",
                    inline: true
                  },
                  {
                    name: "🛠️ Development",
                    value: "Hot reload with Vite plugin for instant development feedback",
                    inline: false
                  },
                  {
                    name: "📚 Learn More",
                    value: "[Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)\n[Discord Developer Portal](https://discord.com/developers/docs)",
                    inline: false
                  }
                ],
                footer: {
                  text: "Built with ❤️ using Cloudflare Tunnel Vite Plugin"
                }
              }
            ],
            flags: 64 // Ephemeral message (only visible to the user)
          },
        };
      } else {
        // Fallback for unknown button interactions
        response = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `🤔 **Unknown button interaction!**\n\nButton ID: \`${buttonId || 'undefined'}\`\n\nThis response came from your Cloudflare Worker via Cloudflare Tunnel! 🚀⚡`,
            flags: 64 // Ephemeral message (only visible to the user)
          },
        };
      }
      break;

    case 0:
      return okJson({type: 0});
    default:
      console.log('❓ Unknown interaction type:', type);
      return errorJson('Unknown interaction type');
  }

  return okJson(response);
}

/**
 * Convert Discord interaction type number to human-readable string
 */
function getInteractionTypeName(type: InteractionType): string {
  const types: Record<InteractionType, string> = {
    [InteractionType.PING]: 'PING',
    [InteractionType.APPLICATION_COMMAND]: 'SLASH_COMMAND',
    [InteractionType.MESSAGE_COMPONENT]: 'COMPONENT',
    [InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE]: 'AUTOCOMPLETE',
    [InteractionType.MODAL_SUBMIT]: 'MODAL_SUBMIT'
  };
  return types[type] || `UNKNOWN_${type}`;
}

/**
 * Log Discord interaction validation details for debugging
 */
function logValidationAttempt(request: Request, success: boolean, reason?: string) {
  console.log('🔍 Discord validation attempt', {
    success,
    reason,
    timestamp: new Date().toISOString(),
    ip: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
    method: request.method,
    url: request.url
  });
}

/* ------------------------------------------------------------------ */
/* Shared response helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a JSON Response with CORS and Content-Type headers applied.
 * Use this instead of writing `new Response(JSON.stringify(data), { ... })`
 * everywhere in the codebase.
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Convenience wrapper specialised for error objects.
 */
function errorJson(error: string, message?: string, status: number = 400, details?: unknown): Response {
  const body: Record<string, unknown> = { error };
  if (message) body.message = message;
  if (details !== undefined) body.details = details;
  return jsonResponse(body, status);
}

/**
 * Most success paths use 200 so this tiny wrapper makes the intent explicit.
 */
const okJson = (data: unknown): Response => jsonResponse(data, 200);

/* ------------------------------------------------------------------ */
/* Shared utility functions (extracted from duplicated code)         */
/* ------------------------------------------------------------------ */

/**
 * Create a standardized task embed with consistent styling
 */
function createTaskEmbed(options: {
  title: string;
  description?: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footerText?: string;
  includeTimestamp?: boolean;
}) {
  const embed: any = {
    title: options.title,
    color: options.color,
    fields: options.fields,
    footer: {
      text: options.footerText || "🚀 Powered by Cloudflare Workers + Tunnel"
    }
  };

  if (options.description) {
    embed.description = options.description;
  }

  if (options.includeTimestamp) {
    embed.timestamp = new Date().toISOString();
  }

  return embed;
}

/**
 * Create task action buttons (complete/delete)
 */
function createTaskActionButtons(taskId: string | number) {
  return [{
    type: 1, // Action Row
    components: [{
      type: 2, // Button
      style: 1, // Primary
      label: "✅ Mark Complete",
      custom_id: `complete_task_${taskId}`,
      emoji: { name: "✅" }
    }, {
      type: 2, // Button
      style: 4, // Danger
      label: "🗑️ Delete",
      custom_id: `delete_task_${taskId}`,
      emoji: { name: "🗑️" }
    }]
  }];
}

/**
 * Create a standardized InteractionResponse with embed
 */
function createEmbedResponse(embed: any, components?: any[], flags?: number): InteractionResponse {
  const response: InteractionResponse = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed]
    }
  };

  if (components) {
    response.data!.components = components;
  }

  if (flags) {
    response.data!.flags = flags;
  }

  return response;
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
 * Get registered commands from Discord API
 */
async function getRegisteredCommands(env: Env): Promise<{
  applicationId: string;
  commands: Array<{
    id: string;
    name: string;
    description: string;
    type: number;
    version: string;
    default_member_permissions?: string;
    dm_permission?: boolean;
    default_permission?: boolean;
    nsfw?: boolean;
    options?: any[];
  }>;
  total: number;
}> {
  const effectiveBotToken = getDiscordBotToken(env);
  
  if (!effectiveBotToken) {
    throw new Error('Discord bot token not configured. Cannot fetch registered commands.');
  }
  
  try {
    // Get the application ID first
    const appInfo = await getCurrentApplication(env);
    const applicationId = appInfo.id;
    
    // Fetch global commands
    const response = await discordApiRequest(`/applications/${applicationId}/commands`, {
      botToken: effectiveBotToken
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Discord API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    
    const commands = await response.json();
    
    console.log('✅ Retrieved registered commands:', {
      applicationId,
      commandCount: commands.length,
      commandNames: commands.map((cmd: any) => cmd.name)
    });
    
    return {
      applicationId,
      commands,
      total: commands.length
    };
  } catch (error) {
    console.error('❌ Failed to get registered commands:', error);
    throw error;
  }
}

/**
 * Create a task completion embed (shared between slash command and button responses)
 */
function createTaskCompletionEmbed(taskId: string | number, source: 'command' | 'button' = 'command') {
  return createTaskEmbed({
    title: "✅ Task Completed!",
    description: `Task #${taskId} has been marked as completed${source === 'button' ? ' via button click' : ''}.`,
    color: 0x28a745,
    fields: [{
      name: source === 'button' ? "🎉 Excellent work!" : "🎉 Great job!",
      value: source === 'button' 
        ? "You've successfully completed this task using the quick action button."
        : "Your task has been successfully completed and updated in the system.",
      inline: false
    }],
    footerText: "Use /task list to see all your tasks",
    includeTimestamp: true
  });
}

/**
 * Create a task deletion embed (shared between slash command and button responses)
 */
function createTaskDeletionEmbed(taskId: string | number, source: 'command' | 'button' = 'command') {
  return createTaskEmbed({
    title: "🗑️ Task Deleted",
    description: `Task #${taskId} has been permanently deleted${source === 'button' ? ' via button click' : ''}.`,
    color: 0xdc3545,
    fields: [{
      name: "⚠️ Action Completed",
      value: source === 'button'
        ? "The task has been removed and cannot be recovered."
        : "The task has been removed from your task list and cannot be recovered.",
      inline: false
    }],
    footerText: "Use /task create to add new tasks"
  });
}

# Discord Cursor Bot Example

This example demonstrates how to create a **Discord bot that manages Cursor background agents** using **Cloudflare Workers**, **KV Storage**, **D1 Database**, Vite, and Cloudflare Tunnel. Users can create and manage Cursor agents directly from Discord through slash commands, with real-time updates posted to Discord threads.

This combines Discord's [Interactions and Responding documentation](https://discord.com/developers/docs/interactions/receiving-and-responding) with the [Cursor Background Agents API](https://docs.cursor.com/api/agents) for a seamless development workflow.

## ✨ Features

- 🤖 **Discord slash commands** for agent management (`/agents`, `/task`, `/agent logs`)
- 🔑 **Channel-specific API keys** stored securely in Cloudflare KV
- 🧵 **Auto-created Discord threads** for each agent with real-time progress updates  
- 📡 **Webhook integration** receives updates from Cursor API and posts to Discord
- 💾 **D1 Database storage** for agent records and thread relationships
- ⚡ **Cloudflare Workers backend** - serverless, scalable, and fast
- 🌐 **Public HTTPS endpoint** via Cloudflare Tunnel
- 📊 **Simple web dashboard** to monitor agents across all channels
- 🛠️ **Local development** with Wrangler and Vite
- 🎯 **Full TypeScript support** with proper types and interfaces

## 🎮 Discord Commands

### `/agents set-api-key [api_key]`
- **Purpose**: Store a Cursor API key for the current Discord channel
- **Storage**: Securely stored in KV storage keyed by Channel ID
- **Validation**: Validates the API key before storing
- **Response**: Ephemeral success/error message

### `/task [prompt]`
- **Purpose**: Quick shortcut to create a new Cursor agent
- **Function**: Creates agent and Discord thread for updates
- **Repository**: Uses a default or channel-configured repository

### `/agents create [prompt] [repository]`
- **Purpose**: Full agent creation with custom repository
- **Function**: Creates agent and Discord thread for updates
- **Flexibility**: Allows specifying custom GitHub repository

### `/agents list [limit]`
- **Purpose**: List all agents for the current channel
- **Display**: Shows agent status, ID, prompt, and thread links
- **Filtering**: Optional limit parameter

### `/agent logs [agent_id]`
- **Purpose**: View conversation logs for a specific agent
- **Display**: Shows agent's conversation history from Cursor API
- **Format**: User-friendly conversation display

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd examples/discord-cursor-bot-example
npm install
```

### 2. Configure Environment

Copy the environment template and fill in your credentials:

```bash
# Copy environment template
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your actual values
```

Your `.dev.vars` file should contain:

```bash
# Discord Bot Configuration (required for local development)
DISCORD_APPLICATION_ID=your_discord_application_id_here  
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Cursor API Configuration (optional - users can set per-channel via Discord)
CURSOR_API_KEY=your_default_cursor_api_key_here

# Development Configuration
NODE_ENV=development
```

### 3. Set up Cloudflare Resources

Create the required D1 database and KV namespace:

```bash
# Create D1 database
wrangler d1 create discord-cursor-agents

# Create KV namespace  
wrangler kv:namespace create "API_KEYS"

# Update wrangler.toml with the returned IDs
```

### 4. Run Database Migrations

Initialize the database schema:

```bash
npm run db:migrate:local
```

### 5. Start Development Servers

```bash
npm run dev
```

This starts both:
- **Wrangler dev server** (port 8787) - Your Cloudflare Worker
- **Vite dev server** (port 3003) - Your frontend with Cloudflare Tunnel

### 6. Configure Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Set the **Interactions Endpoint URL** to your tunnel URL (e.g., `https://discord-cursor-bot.gptkids.app/interactions`)
4. Register the slash commands using the setup UI or scripts
5. Invite the bot to your Discord server with appropriate permissions

## 🏗️ Architecture

```
Discord Slash Commands
        ↓
Cloudflare Worker (worker.ts)
        ↓
┌─────────────────┬─────────────────┐
│   KV Storage    │   D1 Database   │
│ (API Keys by    │ (Agent Records) │
│  Channel ID)    │                 │
└─────────────────┴─────────────────┘
        ↓
Cursor API Integration (cursor-service.ts)
        ↓
Discord Thread Updates (thread-manager.ts)
(via Webhooks from webhook-handler.ts)
```

### 📁 Code Structure

- **`src/worker.ts`** - Main Cloudflare Worker handling Discord interactions
- **`src/thread-manager.ts`** - Discord thread creation and management
- **`src/webhook-handler.ts`** - Cursor API webhook processing and Discord updates
- **`src/cursor-service.ts`** - Cursor Background Agents API integration
- **`src/discord-commands.ts`** - Discord slash command definitions
- **`src/types.ts`** - TypeScript interfaces for the application
- **`src/cursor-api-types.ts`** - Cursor API specific type definitions

## 🛠️ Development

### Local Development
```bash
npm run dev          # Start both servers
npm run dev:worker   # Worker only
npm run dev:frontend # Frontend only
```

### Database Management
```bash
# Run migrations locally (creates tables)
npm run db:migrate:local

# Run migrations in production
npm run db:migrate:prod

# View data
wrangler d1 execute discord-cursor-agents --local --command="SELECT * FROM agents"
```

### Production Deployment

1. Set production secrets:
   ```bash
   npm run set-secret production
   ```

2. Run production migrations:
   ```bash
   npm run db:migrate:prod  
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## 📝 Usage Flow

1. **Setup**: Use `/agents set-api-key` to configure Cursor API access for your channel
2. **Create Agent**: Use `/task "fix the login bug"` or `/agents create` with a custom repository
3. **Auto-Thread**: Bot creates a Discord thread for the agent automatically  
4. **Real-time Updates**: Cursor webhook sends progress updates to the thread
5. **Monitor**: View all agents in the web dashboard or use `/agents list`
6. **Review**: Use `/agent logs` to see the full conversation history

## 🔧 Configuration

### Environment Variables
- `DISCORD_APPLICATION_ID` - Your Discord application ID
- `DISCORD_PUBLIC_KEY` - Discord public key for signature verification  
- `DISCORD_BOT_TOKEN` - Bot token for Discord API calls
- `CURSOR_API_KEY` - Default Cursor API key (optional - users can set per-channel)
- `TUNNEL_HOSTNAME` - Custom tunnel hostname (optional)

### Cloudflare Resources
- **D1 Database**: Stores agent records and thread relationships
- **KV Namespace**: Stores API keys securely by channel ID
- **Worker**: Handles Discord interactions and Cursor API integration

## 🚨 Security Notes

- API keys are stored in KV storage, not encrypted (suitable for development)
- Discord interactions are verified using signature validation
- Each Discord channel can have its own Cursor API key for isolation
- Webhook endpoints are public but validate request sources

## 🤝 Contributing

This example is part of the `vite-plugin-cloudflare-tunnel` project. See the main README for contribution guidelines.

## 📄 License

MIT - See the main project LICENSE file.
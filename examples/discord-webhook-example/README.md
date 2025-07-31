# Discord Bot Webhook Receiver

This example demonstrates how to create a **Discord bot interaction webhook receiver** using **Cloudflare Workers**, Vite, and Cloudflare Tunnel. When users interact with your Discord bot (slash commands, buttons, etc.), Discord will send HTTP requests to your Cloudflare Worker through the tunnel.

This follows Discord's [Interactions and Responding documentation](https://discord.com/developers/docs/interactions/receiving-and-responding) for receiving webhook interactions.

## ✨ Features

- 🤖 **Receives Discord bot interactions** via webhooks
- ⚡ **Cloudflare Workers backend** - serverless, scalable, and fast
- 🔐 **Signature verification** using Discord's public key
- 🌐 **Public HTTPS endpoint** via Cloudflare Tunnel
- 📊 **Real-time interaction dashboard** showing received commands
- 🚀 **Easy bot setup** with step-by-step instructions
- 🔧 **Handles multiple interaction types**: slash commands, buttons, modals
- 🔄 **Auto-refreshing UI** to see interactions in real-time
- 🛠️ **Local development** with Wrangler and Vite
- 🎯 **Full TypeScript support** with proper types and interfaces
- 🌐 **Virtual module integration** for runtime tunnel URL access
- ✅ **Type-safe API responses** and error handling

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd examples/discord-webhook-example
npm install
```

### 2. Configure Environment

```bash
cp env.example .env
# Edit .env with your Cloudflare API token (and optionally TUNNEL_HOSTNAME)
```

### 3. Start the Development Servers

```bash
npm run dev
```

This will start both:
- **Wrangler dev server** (port 8787) - Your Cloudflare Worker
- **Vite dev server** (port 3000) - Your frontend with Cloudflare Tunnel

The Cloudflare Tunnel will automatically:
- Create a public HTTPS URL (e.g., `https://discord-bot-demo.yourdomain.com`)
- Proxy requests to your local Cloudflare Worker
- Serve the web interface for bot setup and monitoring

### 4. Configure Your Discord Bot

1. **Open the web interface** at your tunnel URL
2. **Follow the setup steps** shown in the UI:
   - Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
   - Copy your webhook URL to the bot's "Interactions Endpoint URL"
   - Set your bot's public key as a Wrangler secret (see Step&nbsp;3 below)
   - Create slash commands using Discord's API

## 📋 Discord Bot Setup Guide

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and give it a name
3. Go to the **"Bot"** section and create a bot
4. Copy the **Public Key** from the "General Information" section

### Step 2: Configure Webhook Endpoint

1. In your Discord application settings, go to **"General Information"**
2. Set **"Interactions Endpoint URL"** to: `https://your-tunnel-domain.com/discord/interactions`
3. Discord will verify the endpoint automatically

### Step 3: Set Discord Public Key

Set your bot's public key as a Wrangler secret:

```bash
wrangler secret put DISCORD_PUBLIC_KEY
```

This securely stores your Discord public key in Cloudflare Workers.

### Step 4: Create Slash Commands

Use Discord's API to create commands. Example using curl:

```bash
curl -X POST \
  "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello",
    "description": "Say hello to the bot!",
    "type": 1
  }'
```

### Step 5: Invite Bot to Server

1. Go to **"OAuth2"** → **"URL Generator"**
2. Select **"applications.commands"** scope
3. Copy the generated URL and open it to invite your bot

## 🔧 How It Works

### Webhook Flow

1. **User triggers interaction** in Discord (e.g., `/hello` command)
2. **Discord sends HTTP POST** to your webhook endpoint
3. **Cloudflare Tunnel** routes the request to your local Cloudflare Worker
4. **Worker verifies signature** using Discord's public key
5. **Worker processes interaction** and sends response back to Discord
6. **UI updates** showing the received interaction

### Interaction Types Handled

- **PING** - Discord's initial verification request
- **APPLICATION_COMMAND** - Slash commands (e.g., `/hello`)
- **MESSAGE_COMPONENT** - Button clicks, select menus
- **MODAL_SUBMIT** - Form submissions
- **APPLICATION_COMMAND_AUTOCOMPLETE** - Command autocomplete

### Security

The Cloudflare Worker uses Discord's official `discord-interactions` library to:
- Verify request signatures using your bot's public key (stored as a secure Wrangler secret)
- Prevent unauthorized webhook calls
- Ensure requests actually come from Discord

## 📁 Project Structure

```
discord-webhook-example/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration with virtual module types
├── vite.config.ts        # Vite config with Cloudflare Tunnel
├── wrangler.toml         # Cloudflare Workers configuration
├── src/
│   └── worker.ts         # TypeScript Cloudflare Worker with Discord webhooks
├── public/
│   ├── index.html        # Web interface for setup and monitoring
│   └── client.ts         # TypeScript client with virtual module usage
├── env.example           # Environment variables template
└── README.md             # This file
```

## 🎯 TypeScript Integration

This example demonstrates comprehensive TypeScript usage throughout the stack:

### Server-side (Cloudflare Worker)
- **Fully typed interfaces** for Discord interactions, API responses, and environment variables
- **Type-safe error handling** with proper TypeScript error types
- **Virtual module integration** with `getTunnelUrl()` function
- **Cloudflare Workers types** for Request/Response objects

```typescript
// Example: Type-safe interaction handling
interface Env {
  DISCORD_PUBLIC_KEY?: string;
}

async function handleDiscordInteraction(request: Request, env: Env): Promise<Response> {
  // Fully typed Discord interaction processing...
}
```

### Client-side TypeScript
- **Virtual module usage** for runtime tunnel URL access
- **Type-safe API calls** with proper response interfaces
- **DOM manipulation** with TypeScript safety
- **Error boundaries** with typed error handling

```typescript
// Example: Virtual module usage in client
import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';

const tunnelUrl = getTunnelUrl(); // Fully typed!
```

### TypeScript Configuration
The `tsconfig.json` includes:
- **Virtual module types** from `vite-plugin-cloudflare-tunnel/virtual`
- **Strict TypeScript settings** for maximum type safety
- **Vite client types** for development features

## 🌐 Web Interface

The included web interface provides:

- **Setup Status** - Shows if your bot is properly configured
- **Step-by-step Guide** - Instructions for Discord bot setup
- **Real-time Interactions** - Live feed of received commands
- **Debug Information** - Server status and configuration details with TypeScript features
- **Webhook Testing** - Test endpoint connectivity

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_API_KEY` | Cloudflare API token for tunnel | ✅ Yes |
| `TUNNEL_HOSTNAME` | (Optional) Custom hostname for Cloudflare Tunnel | No |

## 🐛 Troubleshooting

### "Invalid signature" errors
- Ensure `DISCORD_PUBLIC_KEY` matches your bot's public key exactly
- Check that Discord is sending requests to the correct URL

### Webhook endpoint not reachable
- Verify your Cloudflare Tunnel is running and accessible
- Check that your domain DNS is properly configured
- Test the `/health` endpoint to ensure the server is responding

### Commands not appearing in Discord
- Make sure you've registered slash commands using Discord's API
- Commands can take up to 1 hour to appear globally (use guild commands for instant testing)
- Verify your bot has the `applications.commands` scope

### No interactions received
- Check that your bot is invited to a server
- Ensure the bot has necessary permissions in the server
- Try using commands in a server where the bot is present

## 🚀 Next Steps

Once your bot is receiving interactions, you can:

- **Add more slash commands** with different response types
- **Implement button interactions** and message components
- **Store interaction data** in a database
- **Add authentication** for the web interface
- **Deploy to production** using the same Cloudflare Tunnel setup

## 📚 Resources

- [Discord Interactions Documentation](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [discord-interactions NPM Package](https://www.npmjs.com/package/discord-interactions)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

**Need help?** Check the troubleshooting section above or refer to Discord's official documentation for bot development.
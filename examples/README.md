# Examples

This directory contains example projects demonstrating how to use the `vite-plugin-cloudflare-tunnel`.

## Available Examples

### [quick-tunnel-example](./quick-tunnel-example) 🚀 **Recommended Start Here**
The fastest way to get started! Zero configuration required - just run and get an instant public URL.

**Features:**
- No API token required
- Random `trycloudflare.com` URL
- Zero configuration
- Perfect for demos and quick sharing

**Prerequisites:** Just Node.js

### [basic-vite-app](./basic-vite-app)
A minimal Vite application showcasing named tunnel mode with custom domains:
- Custom hostname configuration
- DNS management
- Environment variable configuration
- Persistent tunnel URLs

**Prerequisites:** Cloudflare account and API token

### [discord-webhook-example](./discord-webhook-example)
Discord bot webhook receiver demonstrating real-world usage:
- Webhook endpoint handling
- HTTPS requirements
- Discord bot integration
- Token validation

**Prerequisites:** Cloudflare account, API token, and Discord bot

## Running Examples

### Quick Start (No Setup Required)

```bash
# Build the plugin first
npm run build

# Try the quick tunnel example
cd examples/quick-tunnel-example
npm install
npm run dev
# Get instant public URL - no configuration needed!
```

### Named Tunnel Examples (Require Setup)

1. **Build the plugin first:**
   ```bash
   cd ..
   npm run build
   ```

2. **Navigate to an example:**
   ```bash
   cd examples/basic-vite-app
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure your environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare API token
   ```

5. **Update the hostname in `vite.config.ts`** to match a domain in your Cloudflare account

6. **Start development:**
   ```bash
   npm run dev
   ```

## Prerequisites

### For Quick Tunnel Example
- Node.js 16.0.0 or higher
- That's it! No Cloudflare account needed.

### For Named Tunnel Examples
- A Cloudflare account with a domain added
- A Cloudflare API token with appropriate permissions:
  - `Zone:Zone:Read`
  - `Zone:DNS:Edit` 
  - `Account:Cloudflare Tunnel:Edit`

## Contributing

Feel free to contribute additional examples that demonstrate specific use cases or integrations!
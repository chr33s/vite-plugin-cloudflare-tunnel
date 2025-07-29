# Cloudflare Tunnel Vite Plugin

A powerful Vite plugin that automatically creates and manages Cloudflare tunnels for local development. Expose your local dev server to the internet instantly with HTTPS, no port forwarding or complex setup required.

[![npm version](https://badge.fury.io/js/cloudflare-tunnel-vite-plugin.svg)](https://badge.fury.io/js/cloudflare-tunnel-vite-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Zero Configuration** - Works out of the box with minimal setup
- 🔒 **Automatic HTTPS** - Secure connections via Cloudflare's SSL certificates  
- 🌐 **Public Access** - Share your local dev server with anyone, anywhere
- 🎯 **Smart DNS Management** - Automatically creates and manages DNS records
- 🔄 **Hot Reload Support** - Works seamlessly with Vite's development features
- 📝 **Comprehensive Logging** - Debug tunnel issues with configurable log levels
- 🛡️ **Type Safe** - Full TypeScript support with proper type definitions

## 🚀 Quick Start

### Installation

```bash
npm install cloudflare-tunnel-vite-plugin --save-dev
```

### Basic Usage

1. **Add to your `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import cloudflareTunnel from 'cloudflare-tunnel-vite-plugin';
// Or use named import: import { cloudflareTunnel } from 'cloudflare-tunnel-vite-plugin';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      hostname: 'dev.yourdomain.com', // Your desired public URL
    })
  ]
});
```

2. **Set your Cloudflare API token:**

The plugin will automatically find your API token using this priority order:
1. `apiToken` option in your config
2. `CLOUDFLARE_API_KEY` environment variable
3. Wrangler config file (`~/.wrangler/config/default.toml`)

```bash
# Option 1: Environment variable
export CLOUDFLARE_API_KEY="your-api-token-here"

# Option 2: If you use Wrangler, the plugin will automatically 
# find your token from ~/.wrangler/config/default.toml
```

3. **Start development:**

```bash
npm run dev
```

That's it! Your local server is now accessible at `https://dev.yourdomain.com` 🎉

## 📋 Prerequisites

- **Cloudflare Account** with a domain added to your account
- **Cloudflare API Token** with the following permissions:
  - `Zone:Zone:Read`
  - `Zone:DNS:Edit` 
  - `Account:Cloudflare Tunnel:Edit`
- **Node.js** 16.0.0 or higher

## 🔑 Cloudflare API Token Setup

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Use **"Custom token"** with these permissions:

   **Zone permissions:**
   - `Zone:Zone:Read`
   - `Zone:DNS:Edit`

   **Account permissions:**
   - `Account:Cloudflare Tunnel:Edit`

   **Zone Resources:** Include - All zones (or specific zone)  
   **Account Resources:** Include - All accounts (or specific account)

4. Copy the generated token and configure it:
   ```bash
   # Option 1: Environment variable
   export CLOUDFLARE_API_KEY="your-token-here"
   
   # Option 2: If you use Wrangler, add it to ~/.wrangler/config/default.toml:
   # api_token = "your-token-here"
   
   # Option 3: Pass directly in your vite.config.ts:
   # cloudflareTunnel({ apiToken: "your-token-here", hostname: "dev.example.com" })
   ```

## 🔧 Wrangler Integration

If you're already using [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare Workers development, this plugin will automatically detect and use your existing API token from your Wrangler configuration file.

### Automatic Token Detection

The plugin checks for your API token in this order:
1. **Direct configuration** - `apiToken` option in `cloudflareTunnel()`
2. **Environment variable** - `CLOUDFLARE_API_KEY`  
3. **Wrangler config** - `~/.wrangler/config/default.toml`

### Wrangler Config Example

```toml
# ~/.wrangler/config/default.toml
name = "my-worker"
main = "src/index.js"
compatibility_date = "2023-05-18"

# Your API token - the plugin will automatically find this
api_token = "your-cloudflare-api-token-here"

[env.production]
name = "my-worker-production"

[env.staging]  
name = "my-worker-staging"
```

### Benefits of Wrangler Integration

- **Zero Configuration** - No need to set environment variables if you already use Wrangler
- **Consistent Tokens** - Use the same API token across all your Cloudflare tools
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **Automatic Discovery** - Finds your token without any additional setup

## 📦 Import Styles

This plugin supports both default and named imports:

```typescript
// Default import (recommended)
import cloudflareTunnel from 'cloudflare-tunnel-vite-plugin';

// Named import
import { cloudflareTunnel } from 'cloudflare-tunnel-vite-plugin';

// Both work the same way
export default defineConfig({
  plugins: [cloudflareTunnel({ hostname: 'dev.example.com' })]
});
```

## ⚙️ Configuration Options

```typescript
cloudflareTunnel({
  // Required: Your public hostname
  hostname: 'dev.example.com',
  
  // Optional: API token (can use CLOUDFLARE_API_KEY env var instead)
  apiToken: process.env.CLOUDFLARE_API_KEY,
  
  // Optional: Local dev server port (default: 5173)
  port: 5173,
  
  // Optional: Tunnel name (default: "vite-tunnel")
  tunnelName: 'my-dev-tunnel',
  
  // Optional: Logging configuration
  logFile: './cloudflared.log',      // Path to write logs to a file
  logLevel: 'debug',                 // Log level: debug, info, warn, error, fatal
  
  // Optional: Cloudflare account ID (auto-detected if omitted)
  accountId: 'your-account-id',
  
  // Optional: Cloudflare zone ID (auto-detected if omitted) 
  zoneId: 'your-zone-id'
})
```

### Configuration Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hostname` | `string` | **Required** | The public hostname you want (e.g., `dev.example.com`) |
| `apiToken` | `string` | `process.env.CLOUDFLARE_API_KEY` | Cloudflare API token with tunnel permissions |
| `port` | `number` | `5173` | Local port your dev server runs on |
| `tunnelName` | `string` | `"vite-tunnel"` | Name for the tunnel in your Cloudflare dashboard |
| `logFile` | `string` | `undefined` | Path to write cloudflared logs to a file |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` | `undefined` | Logging level for cloudflared |
| `accountId` | `string` | Auto-detected | Cloudflare account ID (optional) |
| `zoneId` | `string` | Auto-detected | Cloudflare zone ID (optional) |

## 📝 Logging & Debugging

The plugin supports comprehensive logging to help debug tunnel issues:

### Log Levels

- `debug` - Most verbose, shows all tunnel activity
- `info` - General information about tunnel status  
- `warn` - Warning messages
- `error` - Error messages only
- `fatal` - Only fatal errors

### Example with Logging

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  logLevel: 'debug',
  logFile: './logs/cloudflared.log'
})
```

### What Gets Logged

- Tunnel connection status and health
- HTTP/TCP/UDP traffic flowing through the tunnel
- DNS resolution and routing information
- Performance metrics and latency data
- Error messages and debugging information

## 🛠️ How It Works

1. **Plugin Initialization** - When Vite starts, the plugin begins setup
2. **Binary Installation** - Downloads `cloudflared` binary if not present
3. **API Authentication** - Validates your Cloudflare API token
4. **Resource Discovery** - Finds your Cloudflare account and DNS zone
5. **Tunnel Creation** - Creates or reuses a Cloudflare tunnel
6. **DNS Configuration** - Sets up CNAME record pointing to the tunnel
7. **Connection Establishment** - Starts `cloudflared` daemon with secure token
8. **Ready!** - Your local server is now publicly accessible via HTTPS

## 📁 Examples

Check out the [`examples/`](./examples/) directory for complete working examples:

- **[Basic Vite App](./examples/basic-vite-app/)** - Minimal setup demonstrating core functionality

To run an example:

```bash
cd examples/basic-vite-app
npm install
cp .env.example .env
# Edit .env with your API token
npm run dev
```

## 🐛 Troubleshooting

### Common Issues

**"Zone not found"**
- Ensure your domain is added to your Cloudflare account
- Verify the hostname matches a domain you own

**"API token invalid"**  
- Check your token has all required permissions
- Ensure the token isn't expired
- If using Wrangler integration, verify your `~/.wrangler/config/default.toml` contains a valid `api_token`

**"Tunnel connection failed"**
- Check your internet connection
- Verify firewall isn't blocking the connection
- Try enabling debug logging: `logLevel: 'debug'`

**TypeScript errors**
- Make sure the plugin is built: `npm run build`
- Check your `tsconfig.json` includes the plugin types

### Debug Mode

Enable verbose logging to diagnose issues:

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  logLevel: 'debug',
  logFile: './debug.log'
})
```

## 🔒 Security Considerations

- **API Token Security** - Never commit API tokens to version control
- **Environment Variables** - Store tokens in `.env` files (add to `.gitignore`)
- **Wrangler Config** - Your `~/.wrangler/config/default.toml` should also be kept secure and not committed
- **Token Permissions** - Use minimal required permissions for your API token
- **Tunnel Access** - Remember that your tunnel URL will be publicly accessible

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/eastlondoner/cloudflare-tunnel-vite-plugin.git
   cd cloudflare-tunnel-vite-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

### Scripts

- `npm run build` - Build the plugin
- `npm run dev` - Build in watch mode
- `npm run typecheck` - Type checking
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cloudflare](https://cloudflare.com) for their amazing tunnel technology
- [Vite](https://vitejs.dev) for the excellent plugin architecture
- The open source community for inspiration and feedback

---

**Questions?** Open an issue or start a discussion. We're here to help! 💙 
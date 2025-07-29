# Cloudflare Tunnel Vite Plugin

A powerful Vite plugin that automatically creates and manages Cloudflare tunnels for local development. Expose your local dev server to the internet instantly with HTTPS, no port forwarding or complex setup required. Works seamlessly on Windows, macOS, and Linux.

[![npm version](https://badge.fury.io/js/cloudflare-tunnel-vite-plugin.svg)](https://badge.fury.io/js/cloudflare-tunnel-vite-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Zero Configuration** - Works out of the box with minimal setup
- 🔒 **Automatic HTTPS** - Secure connections via Cloudflare's SSL certificates  
- 🌐 **Public Access** - Share your local dev server with anyone, anywhere
- 🎯 **Smart DNS Management** - Automatically creates and manages DNS records
- 🔄 **Hot Reload Support** - Works seamlessly with Vite's development features
- 📝 **Comprehensive Logging** - Debug tunnel issues with configurable log levels
- 🖥️ **Cross-Platform** - Works on Windows, macOS, and Linux
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

```bash
# Environment variable
export CLOUDFLARE_API_KEY="your-api-token-here"
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
   
   # Option 2: Pass directly in your vite.config.ts:
   # cloudflareTunnel({ apiToken: "your-token-here", hostname: "dev.example.com" })
   ```

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
  
  // Optional: Custom DNS configuration
  dns: '*.example.com',              // Wildcard or exact hostname match
  
  // Optional: Custom SSL certificate configuration  
  ssl: '*.example.com',              // Wildcard or exact hostname match
  
  // Optional: Enable debug logging
  debug: true,                       // Extra verbose logging for troubleshooting
  
  // Optional: Logging configuration
  logFile: './cloudflared.log',      // Path to write logs to a file
  logLevel: 'debug',                 // Log level: debug, info, warn, error, fatal
  
  // Optional: Cloudflare account ID (auto-detected if omitted)
  accountId: 'your-account-id',
  
  // Optional: Cloudflare zone ID (auto-detected if omitted) 
  zoneId: 'your-zone-id',
  
  // Optional: Resource cleanup configuration
  cleanup: {
    autoCleanup: true,                 // Clean up mismatched resources on startup
    dryRun: false                      // Set to false to actually delete resources  
  }
})
```

### Configuration Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hostname` | `string` | **Required** | The public hostname you want (e.g., `dev.example.com`) |
| `apiToken` | `string` | `process.env.CLOUDFLARE_API_KEY` | Cloudflare API token with tunnel permissions |
| `port` | `number` | `5173` | Local port your dev server runs on |
| `tunnelName` | `string` | `"vite-tunnel"` | Name for the tunnel in your Cloudflare dashboard (letters, numbers, hyphens only) |
| `dns` | `string` | `undefined` | Custom DNS record (wildcard like `*.example.com` or exact hostname match) |
| `ssl` | `string` | `undefined` | Custom SSL certificate (wildcard like `*.example.com` or exact hostname match) |
| `debug` | `boolean` | `false` | Enable extra debug logging for troubleshooting |
| `logFile` | `string` | `undefined` | Path to write cloudflared logs to a file |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` | `undefined` | Logging level for cloudflared |
| `accountId` | `string` | Auto-detected | Cloudflare account ID (optional) |
| `zoneId` | `string` | Auto-detected | Cloudflare zone ID (optional) |
| `cleanup` | `object` | `{}` | Resource cleanup configuration (see below) |

### Cleanup Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoCleanup` | `boolean` | `true` | Automatically clean up mismatched resources from current tunnel on startup |
| `dryRun` | `boolean` | `true` | If true, only list mismatched resources without deleting them |
| `preserveTunnels` | `string[]` | `[]` | **(Deprecated)** No longer used - cleanup only affects current tunnel |

## 🧹 Resource Management & Cleanup

The plugin automatically tags resources it creates and can clean up orphaned resources from previous runs or crashes.

### Automatic Resource Tagging

**DNS Records:** All DNS records created by the plugin include a comment field with metadata:
- Format: `cloudflare-tunnel-vite-plugin:tunnelName:recordType:date`
- Example: `cloudflare-tunnel-vite-plugin:vite-tunnel:cname:2025-01-27`

**SSL Certificates:** Since Cloudflare doesn't support metadata fields, the plugin adds a special "tag" hostname to certificates for identification:
- Format: `cf-tunnel-plugin-{tunnelName}-{date}.{parentDomain}`
- Example: `cf-tunnel-plugin-vitetunnel-20250127.api.example.com` (for hostname `dev.api.example.com`)

### Cleanup Configuration

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  cleanup: {
    // autoCleanup: true,                 // Enabled by default
    dryRun: false                         // Actually delete resources (default: true)
  }
})

// To disable auto cleanup:
cloudflareTunnel({
  hostname: 'dev.example.com',
  cleanup: {
    autoCleanup: false                    // Disable automatic cleanup
  }
})
```

### How Cleanup Works

1. **Current Tunnel Only:** The plugin only cleans up resources created by the **current tunnel name**
2. **Configuration Mismatch Detection:** 
   - **DNS Records:** Finds records from current tunnel that don't match current hostname/target
   - **SSL Certificates:** Finds certificates from current tunnel that don't cover current hostname
3. **Safe Cleanup:** DNS records are deleted automatically, SSL certificates require manual review
4. **Preserves Other Tunnels:** Resources from different tunnel names are never touched

### Manual Cleanup

If you need to manually clean up resources:

1. **List orphaned DNS records:**
   ```bash
   # Using Cloudflare API
   curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records?comment=cloudflare-tunnel-vite-plugin&match=all" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
   ```

2. **Review SSL certificates:**
   ```bash
   # List all certificate packs
   curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/ssl/certificate_packs" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
   ```

## 🌐 DNS & SSL Configuration

The plugin provides advanced DNS and SSL management options for custom setups:

### DNS Configuration

Use the `dns` option to control DNS record creation:

```typescript
// Wildcard DNS - creates A and AAAA records for *.example.com
cloudflareTunnel({
  hostname: 'dev.example.com',
  dns: '*.example.com'  // Creates wildcard DNS records
})

// Exact hostname DNS - must match the hostname exactly
cloudflareTunnel({
  hostname: 'dev.example.com', 
  dns: 'dev.example.com'  // Creates specific DNS record
})
```

**Wildcard DNS (`*.example.com`):**
- Creates both A and AAAA records for the wildcard domain
- Allows any subdomain to resolve through Cloudflare
- Useful for multi-environment setups

**Exact hostname DNS:**
- Must exactly match the `hostname` option
- Creates a CNAME record pointing to the tunnel
- Default behavior when `dns` option is omitted

### SSL Certificate Configuration

Use the `ssl` option to control SSL certificate provisioning:

```typescript
// Wildcard SSL - requests *.example.com certificate
cloudflareTunnel({
  hostname: 'dev.example.com',
  ssl: '*.example.com'  // Requests wildcard certificate
})

// Exact hostname SSL - must match the hostname exactly  
cloudflareTunnel({
  hostname: 'dev.example.com',
  ssl: 'dev.example.com'  // Requests specific certificate
})
```

**Wildcard SSL (`*.example.com`):**
- Requests a wildcard edge certificate from Let's Encrypt
- Covers all subdomains under the domain
- Useful for development environments with multiple subdomains

**Exact hostname SSL:**
- Must exactly match the `hostname` option
- Requests a certificate for the specific hostname only

**Automatic SSL (default behavior):**
When no `ssl` option is provided, the plugin:
1. Checks for existing wildcard certificate covering the domain
2. If no wildcard exists, checks if Total TLS is enabled
3. If neither exists, requests a regular certificate for the hostname

### Combined DNS & SSL Example

```typescript
cloudflareTunnel({
  hostname: 'api.dev.example.com',
  dns: '*.dev.example.com',      // Wildcard DNS for dev subdomains
  ssl: '*.dev.example.com',      // Wildcard SSL for dev subdomains
  debug: true                    // Enable debug logging
})
```

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
8. **Process Management** - Registers cleanup handlers to ensure `cloudflared` is terminated when the parent process exits
9. **Ready!** - Your local server is now publicly accessible via HTTPS

### Process Cleanup

The plugin includes robust process management to prevent orphaned `cloudflared` processes:

- **Signal Handlers** - Listens for `SIGINT`, `SIGTERM`, `SIGQUIT`, and `SIGHUP` signals
- **Process Group Management** - Spawns `cloudflared` in the same process group for automatic cleanup
- **Exception Handling** - Cleans up on uncaught exceptions and unhandled rejections
- **Graceful Termination** - Attempts `SIGTERM` first, falls back to `SIGKILL` after timeout
- **Multiple Exit Points** - Handles Vite server shutdown, build completion, and process termination

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

**"Tunnel connection failed"**
- Check your internet connection
- Verify firewall isn't blocking the connection
- Try enabling debug logging: `logLevel: 'debug'`

**"tunnelName must contain only letters, numbers, and hyphens"**
- Tunnel names must be DNS-safe for use in comments and SSL certificate hostnames
- Valid: `my-tunnel`, `dev`, `tunnel123`
- Invalid: `my_tunnel`, `tunnel-`, `-tunnel`, `my.tunnel`

**TypeScript errors**
- Make sure the plugin is built: `npm run build`
- Check your `tsconfig.json` includes the plugin types

**Orphaned `cloudflared` processes**
- The plugin includes comprehensive cleanup handlers for all exit scenarios
- If you still see orphaned processes, they may be from previous versions or crashes
- Kill them manually: `pkill -f cloudflared` or `ps aux | grep cloudflared`
- Check if your process manager (PM2, Docker, etc.) is sending `SIGKILL` instead of `SIGTERM`

### Debug Mode

Enable verbose logging to diagnose issues:

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  debug: true,                    // Enable extra debug logging
  logLevel: 'debug',              // Set cloudflared log level  
  logFile: './debug.log'          // Write logs to file
})
```

**Debug Options:**
- `debug: true` - Enables extra plugin debug logging with `[cloudflare-tunnel:debug]` prefix
- `logLevel: 'debug'` - Sets the cloudflared process log level to debug
- `logFile` - Writes all cloudflared logs to a file for analysis

## 🔒 Security Considerations

- **API Token Security** - Never commit API tokens to version control
- **Environment Variables** - Store tokens in `.env` files (add to `.gitignore`)

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
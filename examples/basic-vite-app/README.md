# Basic Vite App Example

This example demonstrates how to use the `vite-plugin-cloudflare-tunnel` with a basic Vite application.

## Features Demonstrated

- ✅ Automatic Cloudflare tunnel creation
- ✅ DNS record management  
- ✅ HTTPS certificate via Cloudflare
- ✅ Environment variable configuration
- ✅ Basic tunnel status detection
- ✅ Virtual module TypeScript integration
- ✅ Runtime tunnel URL access

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your Cloudflare API token:**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Cloudflare API token:
   ```bash
   CLOUDFLARE_API_KEY=your-cloudflare-api-token-here
   ```

3. **Update the hostname in `vite.config.ts`:**
   ```typescript
   cloudflareTunnel({
     hostname: 'dev.your-domain.com', // Replace with your domain
   })
   ```

## Cloudflare API Token Setup

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Custom token" with these permissions:
   - **Zone permissions:**
     - `Zone:Zone:Read`
     - `Zone:DNS:Edit`
   - **Account permissions:**
     - `Account:Cloudflare Tunnel:Edit`
   - **Zone Resources:** Include - All zones (or specific zone)
   - **Account Resources:** Include - All accounts (or specific account)

## Running the Example

```bash
npm run dev
```

The plugin will:
1. Install the `cloudflared` binary if needed
2. Create or reuse a Cloudflare tunnel
3. Configure DNS records for your hostname
4. Start the tunnel connection
5. Display the public HTTPS URL

You should see output like:
```
vite v5.2.0 ready in 300 ms
🌐 Cloudflare tunnel started for https://dev.your-domain.com
```

## Virtual Module Usage

This example demonstrates how to access the tunnel URL at runtime using the virtual module:

```typescript
import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';

// Get the current tunnel URL
const tunnelUrl = getTunnelUrl();
console.log('Public tunnel URL:', tunnelUrl);

// Use it in your app
const copyButton = document.getElementById('copy-url');
copyButton.onclick = () => {
  navigator.clipboard.writeText(getTunnelUrl());
  alert('Tunnel URL copied to clipboard!');
};
```

### TypeScript Setup

The `tsconfig.json` includes the virtual module types:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vite-plugin-cloudflare-tunnel/virtual"]
  }
}
```

This provides full TypeScript support with IDE autocompletion and type checking for the virtual module.

## Configuration Options

The plugin supports several configuration options in `vite.config.ts`:

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

## Troubleshooting

- **"Zone not found"**: Make sure your domain is added to your Cloudflare account
- **"API token invalid"**: Verify your token has the correct permissions
- **"Tunnel connection failed"**: Check your internet connection and firewall settings
- **TypeScript errors**: Make sure you have the plugin built (`npm run build` in the root directory)

## Files Structure

```
basic-vite-app/
├── index.html          # Main HTML file
├── main.ts             # TypeScript entry point with virtual module usage
├── style.css           # Styles
├── vite.config.ts      # Vite configuration with plugin
├── tsconfig.json       # TypeScript configuration with virtual module types
├── package.json        # Dependencies
├── .env.example        # Environment variables template
└── README.md           # This file
```
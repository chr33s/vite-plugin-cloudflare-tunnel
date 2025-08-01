# Quick Tunnel Example

This example demonstrates the **Quick Tunnel** mode of the Cloudflare Tunnel Vite plugin. Quick tunnels provide instant public access to your local development server without requiring any configuration, API tokens, or custom domains.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server with quick tunnel
npm run dev
```

That's it! The plugin will automatically:
1. Detect that no `hostname` is provided
2. Switch to quick tunnel mode
3. Generate a random `trycloudflare.com` URL
4. Make your local server publicly accessible

## ✨ Features

- **Zero Configuration**: No setup required
- **No API Token**: Works without Cloudflare account
- **Instant Access**: Get a public URL in seconds
- **Perfect for Demos**: Share your work instantly
- **Temporary URLs**: Each restart generates a new URL
- **Virtual Module Access**: Get tunnel URL at runtime in your app code

## 📋 Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import cloudflareTunnel from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    // Quick tunnel mode - no hostname needed!
    cloudflareTunnel({
      logLevel: 'info',    // Optional: see tunnel logs
      debug: true,         // Optional: extra debug info
    })
  ]
});
```

## 🌐 Virtual Module Usage

This example demonstrates how to access the tunnel URL at runtime using the virtual module:

```javascript
import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';

// Get the current tunnel URL
const tunnelUrl = getTunnelUrl();
console.log('Public tunnel URL:', tunnelUrl);

// Example: Copy URL to clipboard
const copyButton = document.getElementById('copy-url');
copyButton.onclick = () => {
  navigator.clipboard.writeText(getTunnelUrl());
  alert('Tunnel URL copied to clipboard!');
};
```

The virtual module is perfect for:
- **Sharing functionality**: Let users copy the tunnel URL
- **Analytics**: Track the current public URL
- **Dynamic links**: Generate shareable links from your app
- **Debug info**: Display the tunnel URL in your UI

**Note**: The virtual module is only available during development mode.

## 🔄 Switching to Named Tunnel Mode

To use a custom domain with persistent URLs, switch to named tunnel mode:

```typescript
cloudflareTunnel({
  hostname: 'dev.yourdomain.com',  // Your custom domain
  apiToken: process.env.CLOUDFLARE_API_KEY,  // Required for named mode
  logLevel: 'info'
})
```

## ⚠️ Important Notes

- **Temporary URLs**: Quick tunnel URLs change on each restart
- **Public Access**: Anyone with the URL can access your local server
- **Development Only**: Not suitable for production use
- **No Custom Domains**: Use named tunnel mode for custom domains

## 🆚 Quick vs Named Tunnels

| Feature | Quick Tunnel | Named Tunnel |
|---------|-------------|--------------|
| Setup Required | None | API token + domain |
| URL Type | Random `*.trycloudflare.com` | Custom domain |
| Persistence | Temporary | Persistent |
| DNS Management | None | Automatic |
| SSL Certificates | Automatic | Automatic |
| Best For | Demos, testing | Development, staging |

## 🛠️ How It Works

1. Plugin detects no `hostname` option → switches to quick mode
2. Spawns `cloudflared tunnel --url http://localhost:PORT`
3. Parses the generated URL from cloudflared's stdout
4. Logs the public URL for easy access
5. Handles port conflicts and HMR restarts automatically

## 📚 Learn More

- [Cloudflare Quick Tunnels Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/tunnel-useful-terms/)
- [Plugin Documentation](../../README.md)
- [Named Tunnel Example](../basic-vite-app/)
import { defineConfig } from 'vite';
import cloudflareTunnel from 'cloudflare-tunnel-vite-plugin';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      // API token can be provided here or via CLOUDFLARE_API_KEY environment variable
      // apiToken: process.env.CLOUDFLARE_API_KEY!,
      
      // Replace with your desired hostname (must match a domain in your Cloudflare account)
      hostname: 'dev.gptkids.app',
      
      // Optional: specify dev server port (if omitted, auto-detects from Vite config below)
      // port: 3000,
      
      // Optional: specify tunnel name (defaults to "vite-tunnel")
      // tunnelName: 'my-dev-tunnel',
      
      // Optional: logging configuration
      logFile: './cloudflared.log',     // path to write logs to a file
      logLevel: 'debug',                // log level: debug, info, warn, error, fatal
      
      // Optional: specify account and zone IDs if you have multiple
      // accountId: 'your-account-id',
      // zoneId: 'your-zone-id'
    })
  ],
  server: {
    port: 5173
  }
});
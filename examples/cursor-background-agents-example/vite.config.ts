import { defineConfig } from 'vite';
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTunnel } from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      tunnelName: 'cursor-background-agents',
        hostname: process.env.TUNNEL_HOSTNAME || 'cursor-bot.gptkids.app',
    }),
    cloudflare(),
  ],
  server: {
    port: 3002
  }
});
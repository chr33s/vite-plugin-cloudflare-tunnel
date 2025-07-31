import { defineConfig } from 'vite';
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTunnel } from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
        hostname: process.env.TUNNEL_HOSTNAME || 'discord-bot.gptkids.app',
    }),
    cloudflare(),
  ],
  server: {
    port: 3001
  }
});
import { defineConfig } from 'vite';
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTunnel } from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      tunnelName: 'discord-cursor-bot',
      hostname: process.env.TUNNEL_HOSTNAME || 'cursor.gptkids.app',
    }),
    cloudflare(),
  ],
  server: {
    port: 3003
  },
  build: {
    rollupOptions: {
      input: {
        client: 'src/client.ts'
      },
      output: {
        entryFileNames: assetInfo => {
          if (assetInfo.name === 'client') {
            return 'src/client.js'; // now you can reference `/client.js` in HTML
          }
          return 'assets/[name].[hash].js';
        }
      }
    }
  }
});
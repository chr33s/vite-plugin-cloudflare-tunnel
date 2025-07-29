import { defineConfig, type Plugin } from 'vite';
import { cloudflareTunnel } from 'cloudflare-tunnel-vite-plugin';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      hostname: 'foo5.wildcard2.gptkids.app',
      ssl: '*.wildcard2.gptkids.app',
      debug: true
    }) as Plugin
  ],
  server: {
    port: 5176
  }
});
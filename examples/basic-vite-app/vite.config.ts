import { defineConfig, type Plugin } from 'vite';
import { cloudflareTunnel } from 'cloudflare-tunnel-vite-plugin';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      // tunnelName: 'my-tunnel',
      hostname: 'foo2.nowildcard.gptkids.app',
      // ssl: '*.wildcard.gptkids.app',
      // dns: '*.wildcard.gptkids.app',
      debug: false
    }) as Plugin
  ],
  server: {
    port: 5176
  }
});
import { defineConfig } from 'vite';
import cloudflareTunnel from 'vite-plugin-cloudflare-tunnel';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Quick tunnel mode - no hostname or API token required!
    // This will generate a random trycloudflare.com URL
    cloudflareTunnel({
      debug: false,
    })
  ],
  server: {
    port: 3000
  }
});
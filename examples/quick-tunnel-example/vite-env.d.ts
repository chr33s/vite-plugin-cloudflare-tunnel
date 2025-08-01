/// <reference types="vite/client" />

// Virtual module type for vite-plugin-cloudflare-tunnel
declare module 'virtual:vite-plugin-cloudflare-tunnel' {
  /**
   * Get the current tunnel URL.
   * In quick tunnel mode, returns a random trycloudflare.com URL.
   */
  export function getTunnelUrl(): string;
}
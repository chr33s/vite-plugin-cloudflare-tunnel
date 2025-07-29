/**
 * @fileoverview Cloudflare Tunnel Vite Plugin
 * 
 * A self-contained Vite plugin that automatically creates and manages
 * Cloudflare tunnels for local development, providing instant HTTPS access
 * to your local dev server from anywhere on the internet.
 * 
 * @author Cloudflare Tunnel Vite Plugin Contributors
 * @version 1.0.0
 * @license MIT
 */

import type { Plugin } from "vite";
import { bin, install } from "cloudflared";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { z } from "zod";
import { config } from "dotenv";

// Zod schemas for Cloudflare API responses
const CloudflareErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

const CloudflareApiResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(CloudflareErrorSchema).optional(),
  messages: z.array(z.string()).optional(),
  result: z.unknown(),
});

const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const TunnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  account_tag: z.string(),
  created_at: z.string(),
  connections: z.array(z.unknown()).optional(),
});

const DNSRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  content: z.string(),
  proxied: z.boolean(),
});

// Type definitions (exported for potential external use)
export type CloudflareApiResponse<T = unknown> = z.infer<typeof CloudflareApiResponseSchema> & {
  result: T;
};
export type Account = z.infer<typeof AccountSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Tunnel = z.infer<typeof TunnelSchema>;
export type DNSRecord = z.infer<typeof DNSRecordSchema>;

/**
 * Configuration options for the Cloudflare Tunnel Vite plugin
 */
export interface CloudflareTunnelOptions {
  /** 
   * Cloudflare API token with required permissions:
   * - Zone:Zone:Read
   * - Zone:DNS:Edit
   * - Account:Cloudflare Tunnel:Edit
   * Can also be set via CLOUDFLARE_API_KEY environment variable
   */
  apiToken?: string;
  
  /** 
   * Public hostname for the tunnel (e.g., "dev.example.com")
   * Must be a domain in your Cloudflare account
   */
  hostname: string;
  
  /** 
   * Local port your dev server listens on
   * If not specified, will automatically use Vite's configured port
   * @default undefined (auto-detect from Vite config)
   */
  port?: number;
  
  /** 
   * Cloudflare account ID
   * If omitted, uses the first account associated with the API token
   */
  accountId?: string;
  
  /** 
   * Cloudflare zone ID
   * If omitted, automatically resolved from the hostname
   */
  zoneId?: string;
  
  /** 
   * Name for the tunnel in your Cloudflare dashboard
   * @default "vite-tunnel"
   */
  tunnelName?: string;
  
  /** 
   * Path to write cloudflared logs to a file
   * Useful for debugging tunnel issues
   */
  logFile?: string;
  
  /** 
   * Log level for cloudflared process
   * @default undefined (uses cloudflared default)
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

/**
 * Creates a Vite plugin that automatically sets up Cloudflare tunnels for local development
 * 
 * @param options - Configuration options for the tunnel
 * @returns Vite plugin instance
 * 
 * @example
 * ```typescript
 * import { defineConfig } from 'vite';
 * import cloudflareTunnel from 'cloudflare-tunnel-vite-plugin';
 * 
 * export default defineConfig({
 *   plugins: [
 *     cloudflareTunnel({
 *       hostname: 'dev.example.com',
 *       // port is optional - will auto-detect from Vite config
 *       logLevel: 'info'
 *     })
 *   ]
 * });
 * ```
 */
function cloudflareTunnel(options: CloudflareTunnelOptions): Plugin {
  // Load environment variables from .env files
  config();
  
  // Validate and extract options with defaults
  const {
    apiToken: providedApiToken,
    hostname,
    port: userProvidedPort,
    accountId: forcedAccount,
    zoneId: forcedZone,
    tunnelName = "vite-tunnel",
    logFile,
    logLevel,
  } = options;

  // Input validation
  if (!hostname || typeof hostname !== 'string') {
    throw new Error("[cloudflare-tunnel] hostname is required and must be a valid string");
  }
  
  if (userProvidedPort && (typeof userProvidedPort !== 'number' || userProvidedPort < 1 || userProvidedPort > 65535)) {
    throw new Error("[cloudflare-tunnel] port must be a valid number between 1 and 65535");
  }
  
  if (logLevel && !['debug', 'info', 'warn', 'error', 'fatal'].includes(logLevel)) {
    throw new Error("[cloudflare-tunnel] logLevel must be one of: debug, info, warn, error, fatal");
  }

  // Use provided apiToken or fallback to environment variable
  const apiToken = providedApiToken || process.env.CLOUDFLARE_API_KEY;
  
  if (!apiToken) {
    throw new Error(
      "[cloudflare-tunnel] API token is required. " +
      "Provide it via 'apiToken' option or set CLOUDFLARE_API_KEY environment variable. " +
      "Get your token at: https://dash.cloudflare.com/profile/api-tokens"
    );
  }

  /**
   * Helper function to make authenticated Cloudflare API requests with validation
   */
  const cf = async <T>(
    method: string, 
    url: string, 
    body?: unknown, 
    resultSchema?: z.ZodSchema<T>
  ): Promise<T> => {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          "User-Agent": "cloudflare-tunnel-vite-plugin/1.0.0",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `[cloudflare-tunnel] API request failed: ${response.status} ${response.statusText}. ` +
          `Response: ${errorText}`
        );
      }

      const rawData = await response.json();
      const apiResponse = CloudflareApiResponseSchema.parse(rawData);

      if (!apiResponse.success) {
        const errorMsg = apiResponse.errors
          ?.map((e) => e.message || `Error ${e.code}`)
          .join(", ") || "Unknown API error";
        throw new Error(`[cloudflare-tunnel] Cloudflare API error: ${errorMsg}`);
      }

      if (resultSchema) {
        return resultSchema.parse(apiResponse.result);
      }

      return apiResponse.result as T;
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw our formatted errors
        if (error.message.includes('[cloudflare-tunnel]')) {
          throw error;
        }
        // Wrap other errors with context
        throw new Error(`[cloudflare-tunnel] API request failed: ${error.message}`);
      }
      throw new Error('[cloudflare-tunnel] Unknown API error occurred');
    }
  };

  let child: ReturnType<typeof spawn> | undefined;

  return {
    name: "vite-plugin-cloudflare-tunnel",

    config(config) {
      // Automatically configure Vite to allow tunnel hostname
      if (!config.server) {
        config.server = {};
      }
      
      // Allow requests from the tunnel hostname for development
      if (!config.server.allowedHosts) {
        config.server.allowedHosts = [hostname];
        console.log(`[cloudflare-tunnel] Configured Vite to allow requests from ${hostname}`);
      } else if (Array.isArray(config.server.allowedHosts)) {
        if (!config.server.allowedHosts.includes(hostname)) {
          config.server.allowedHosts.push(hostname);
          console.log(`[cloudflare-tunnel] Added ${hostname} to allowed hosts`);
        }
      }
      // If allowedHosts is true, no need to modify it
    },

    async configureServer(server) {
      try {
        // Determine the port to use: user-provided or Vite's configured port
        const port = userProvidedPort || server.config.server.port || 5173;
        console.log(`[cloudflare-tunnel] Using port ${port}${userProvidedPort ? ' (user-provided)' : ' (from Vite config)'}`);

        // 1. Ensure the cloudflared binary exists
        try {
          await fs.access(bin);
        } catch {
          console.log("[cloudflare-tunnel] Installing cloudflared binary...");
          await install(bin);
        }

        // 2. Figure out account & zone
        const accounts = await cf("GET", "/accounts", undefined, z.array(AccountSchema));
        const accountId = forcedAccount || accounts[0]?.id;
        if (!accountId) throw new Error("Unable to determine Cloudflare account ID");

        const apex = hostname.split(".").slice(-2).join(".");
        const zones = await cf("GET", `/zones?name=${apex}`, undefined, z.array(ZoneSchema));
        const zoneId = forcedZone || zones[0]?.id;
        if (!zoneId) throw new Error(`Zone ${apex} not found in account ${accountId}`);

        // 3. Get or create the tunnel
        const tunnels = await cf("GET", `/accounts/${accountId}/cfd_tunnel?name=${tunnelName}`, undefined, z.array(TunnelSchema));
        let tunnel = tunnels[0];

        if (!tunnel) {
          console.log(`[cloudflare-tunnel] Creating tunnel '${tunnelName}'...`);
          tunnel = await cf("POST", `/accounts/${accountId}/cfd_tunnel`, {
            name: tunnelName,
            config_src: "cloudflare",
          }, TunnelSchema);
        }
        const tunnelId = tunnel.id as string;

        // 4. Push ingress rules (public hostname → localhost)
        await cf("PUT", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
          config: {
            ingress: [
              { hostname, service: `http://localhost:${port}` },
              { service: "http_status:404" },
            ],
          },
        });

        // 5. Ensure CNAME exists in DNS
        const existingDnsRecords = await cf("GET", `/zones/${zoneId}/dns_records?type=CNAME&name=${hostname}`, undefined, z.array(DNSRecordSchema));
        const existing = existingDnsRecords.length > 0;

        if (!existing) {
          console.log(`[cloudflare-tunnel] Creating DNS record for ${hostname}...`);
          await cf("POST", `/zones/${zoneId}/dns_records`, {
            type: "CNAME",
            name: hostname,
            content: `${tunnelId}.cfargotunnel.com`,
            proxied: true,
          }, DNSRecordSchema);
        }

        // 6. Grab the tunnel token (single JWT string)
        const token = await cf("GET", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`, undefined, z.string());

        // 7. Fire up cloudflared
        const cloudflaredArgs = ["tunnel"];
        
        // Add logging options (these go before the 'run' subcommand)
        if (logLevel) {
          cloudflaredArgs.push("--loglevel", logLevel);
        }
        if (logFile) {
          cloudflaredArgs.push("--logfile", logFile);
        }
        
        // Add the run subcommand and token
        cloudflaredArgs.push("run", "--token", token);

        console.log(`[cloudflare-tunnel] Spawning: ${bin} ${cloudflaredArgs.join(' ')}`);
        child = spawn(
          bin,
          cloudflaredArgs,
          { stdio: ["ignore", "pipe", "pipe"] }
        );
        console.log(`[cloudflare-tunnel] Process spawned with PID: ${child.pid}`);

        // Wait for tunnel to establish connection
        let tunnelReady = false;
        child.stdout?.on("data", (data) => {
          const output = data.toString();
          console.log(`[cloudflared stdout] ${output.trim()}`);
          if (output.includes("Connection") && output.includes("registered")) {
            if (!tunnelReady) {
              tunnelReady = true;
              console.log(`🌐  Cloudflare tunnel started for https://${hostname}`);
            }
          }
        });

        child.stderr?.on("data", (data) => {
          const error = data.toString().trim();
          
          // Filter out noisy ICMP errors that don't affect functionality
          if (error.includes('Failed to parse ICMP reply') || 
              error.includes('unknow ip version 0')) {
            // Only log ICMP errors in debug mode
            if (logLevel === 'debug') {
              console.log(`[cloudflared debug] ${error}`);
            }
            return;
          }
          
          console.error(`[cloudflared stderr] ${error}`);
          
          // Highlight actual errors and failures
          if (error.toLowerCase().includes('error') || 
              error.toLowerCase().includes('failed') ||
              error.toLowerCase().includes('fatal')) {
            console.error(`[cloudflare-tunnel] ⚠️  ${error}`);
          }
        });

        child.on("error", (error) => {
          console.error(`[cloudflare-tunnel] ❌ Failed to start tunnel process: ${error.message}`);
          if (error.message.includes('ENOENT')) {
            console.error(`[cloudflare-tunnel] Hint: cloudflared binary may not be installed correctly`);
          }
        });

        child.on("exit", (code, signal) => {
          if (code !== 0 && code !== null) {
            console.error(`[cloudflare-tunnel] ❌ Tunnel process exited with code ${code}`);
            if (signal) {
              console.error(`[cloudflare-tunnel] Process terminated by signal: ${signal}`);
            }
          } else if (code === 0) {
            console.log(`[cloudflare-tunnel] ✅ Tunnel process exited cleanly`);
          }
        });

        // Fallback banner if we don't detect connection within reasonable time
        setTimeout(() => {
          if (!tunnelReady) {
            console.log(`🌐  Cloudflare tunnel starting for https://${hostname}`);
          }
        }, 3000);

        // Stop the tunnel when Vite shuts down
        server.httpServer?.once("close", () => {
          if (child && !child.killed) {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (child && !child.killed) {
                child.kill("SIGKILL");
              }
            }, 5000);
          }
        });

      } catch (error: any) {
        console.error(`[cloudflare-tunnel] ❌ Setup failed: ${error.message}`);
        
        // Provide helpful error context
        if (error.message.includes('API token')) {
          console.error(`[cloudflare-tunnel] 💡 Check your API token at: https://dash.cloudflare.com/profile/api-tokens`);
          console.error(`[cloudflare-tunnel] 💡 Required permissions: Zone:Zone:Read, Zone:DNS:Edit, Account:Cloudflare Tunnel:Edit`);
        } else if (error.message.includes('Zone') && error.message.includes('not found')) {
          console.error(`[cloudflare-tunnel] 💡 Make sure '${hostname}' domain is added to your Cloudflare account`);
        } else if (error.message.includes('cloudflared')) {
          console.error(`[cloudflare-tunnel] 💡 Try deleting node_modules and reinstalling to get a fresh cloudflared binary`);
        }
        
        throw error;
      }
    },

    closeBundle() {
      if (child && !child.killed) {
        console.log('[cloudflare-tunnel] 🛑 Shutting down tunnel...');
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child && !child.killed) {
            console.log('[cloudflare-tunnel] 🛑 Force killing tunnel process...');
            child.kill("SIGKILL");
          }
        }, 1000);
      }
    },
  };
}

// Export both as named export and default export
export { cloudflareTunnel };
export default cloudflareTunnel;

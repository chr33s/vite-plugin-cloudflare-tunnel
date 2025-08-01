/**
 * Shared type definitions for Cursor Background Agents integration.
 * Based on the official Cursor API specification.
 */

// Agent status types
export type AgentStatus = 
  | "PENDING"
  | "RUNNING" 
  | "FINISHED"
  | "ERROR"
  | "CREATING"
  | "EXPIRED";


// {"event":"statusChange","timestamp":"2025-07-31T14:35:49.664Z","id":"bc-78b14559-bab8-48f2-a9e8-fd0109880c54","status":"FINISHED","source":{"repository":"github.com/eastlondoner/vibe-tools","ref":"main"},"target":{"url":"https://cursor.com/agents?id=bc-78b14559-bab8-48f2-a9e8-fd0109880c54","branchName":"cursor/calculate-two-plus-two-6f9a"},"name":"Calculate two plus two","summary":"No code changes were made during this session. The session involved a direct query and response, where the assistant provided the correct sum of `2 + 2`.","createdAt":"2025-07-31T14:34:59.317Z"}
// Cursor webhook event from the API
export interface CursorWebhookEvent {
  event: "statusChange";
  timestamp: string;
  id: string;
  status: "FINISHED" | "ERROR";
  source: {
    repository: `https://github.com/${string}`;
    ref?: string;
  };
  target: {
    url: string;
    branchName: string;
  };
  name: string;
  summary: string;
  error?: unknown;
  createdAt: string;
}

// Input schemas for creating agents
export interface CreateAgentInput {
  prompt: { text: string, images: Array<{ data: string, dimension?: { width: number, height: number } }> };
  source: {
    repository: `https://github.com/${string}`; // Must be complete URL like https://github.com/org/repo
    ref?: string; // Branch/tag reference, null for default branch
  };
  model?: string | null;
  target?: {
    autoCreatePr?: boolean | null;
    branchName?: string | null;
  };
  webhook?: {
    url: string;
    secret?: string;
  };
}

export interface ListAgentsInput {
  pageSize?: number; // 1-100
  cursor?: string; // For pagination
}

export interface GetAgentInput {
  id: string;
}

export interface AddFollowupInput {
  id: string;
  prompt: string;
}

// Response types
export interface Agent {
  id: string;
  status: AgentStatus;
  branchName?: string;
  url: string;
  prUrl?: string;
  summary?: string;
  prompt?: {
    text: string;
  };
  source?: {
    repository: string;
    ref?: string;
  };
  target?: {
    autoCreatePr?: boolean;
    branchName?: string;
  };
  model?: string;
  createdAt?: string;
  updatedAt?: string;
  output?: any;
  error?: string;
}

export interface CreateAgentResponse {
  id: string;
  status: "CREATING";
  branchName?: string;
  url: string;
  prUrl?: string;
}

export interface ListAgentsResponse {
  agents: Agent[];
  nextCursor?: string;
}

export interface AddFollowupResponse {
  id: string;
}

export interface AgentLogsResponse {
  logs: string[];
}

export interface AgentOutputResponse {
  output: any;
}

export interface ModelsResponse {
  models: string[];
}

// Error response from Cursor API
export interface CursorApiError {
  error: {
    message: string;
    code?: string;
  };
}

// Application-specific types
export interface ServiceInfo {
  hasApiKey: boolean;
  webhookUrl: string;
  setupComplete: boolean;
  totalAgents: number;
  activeAgents: number;
}

export interface StoredAgent {
  id: string;
  timestamp: string;
  status: AgentStatus;
  prompt: string;
  repository: string;
  model?: string;
  branchName?: string;
  prUrl?: string;
  error?: string;
}

export interface AgentsResponse {
  agents: StoredAgent[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  agents_created: number;
  webhook_events_received: number;
}

export interface TunnelUrlResponse {
  tunnelUrl: string;
  source: string;
}

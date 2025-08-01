/**
 * Type definitions for the Cursor Background Agents API.
 * These match the official Cursor API specification exactly.
 * Based on examples/cursor-background-agents-example/src/types.ts
 */

// Agent status types (from Cursor API)
export type AgentStatus = 
  | "PENDING"
  | "RUNNING" 
  | "FINISHED"
  | "ERROR"
  | "CREATING"
  | "EXPIRED";

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

// Response types from Cursor API
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

// Cursor webhook event from the API
export interface CursorWebhookEvent {
  event: "statusChange";
  timestamp: string;
  id: string;
  status: "FINISHED" | "ERROR" | "RUNNING" | "CREATING";
  source: {
    repository: `https://github.com/${string}`;
    ref?: string;
  };
  target: {
    prUrl: string; // PR URL
    url: string; // Cursor URL
    branchName: string;
  };
  name: string;
  summary: string;
  error?: unknown;
  createdAt: string;
}

// Error response from Cursor API
export interface CursorApiError {
  error: {
    message: string;
    code?: string;
  };
}
/**
 * Utility functions for converting between external Cursor API types and internal storage types.
 * This decouples our application's data model from the external API's structure.
 */

import type { Agent, AgentStatus } from './cursor-api-types';
import type { StoredCursorAgent } from './types';

/**
 * Convert a Cursor API Agent to our internal StoredCursorAgent format
 */
export function mapApiAgentToStoredAgent(
  agent: Agent, 
  discordChannelId: string, 
  discordUserId: string, 
  discordThreadId?: string
): StoredCursorAgent {
  const stored: StoredCursorAgent = {
    id: agent.id,
    status: agent.status,
    prompt: agent.prompt?.text || '',
    repository: agent.source?.repository || '',
    discordChannelId,
    discordUserId,
    createdAt: agent.createdAt || new Date().toISOString(),
    updatedAt: agent.updatedAt || new Date().toISOString(),
  };

  // Handle optional properties carefully for exactOptionalPropertyTypes
  if (discordThreadId) {
    stored.discordThreadId = discordThreadId;
  }
  if (agent.model) {
    stored.model = agent.model;
  }
  if (agent.branchName) {
    stored.branchName = agent.branchName;
  }
  if (agent.prUrl) {
    stored.prUrl = agent.prUrl;
  }
  if (agent.error) {
    stored.error = agent.error;
  }

  return stored;
}

/**
 * Convert our internal StoredCursorAgent to a display format
 */
export function mapStoredAgentToDisplayAgent(stored: StoredCursorAgent) {
  return {
    id: stored.id,
    status: stored.status,
    prompt: stored.prompt,
    repository: stored.repository,
    channelId: stored.discordChannelId, // Keep backward compatibility
    threadId: stored.discordThreadId,
    userId: stored.discordUserId,
    model: stored.model,
    branchName: stored.branchName,
    prUrl: stored.prUrl,
    error: stored.error,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Update a stored agent with new status from webhook
 */
export function updateStoredAgentStatus(
  stored: StoredCursorAgent,
  newStatus: AgentStatus,
  summary?: string,
  error?: string
): StoredCursorAgent {
  const updated: StoredCursorAgent = {
    ...stored,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  // Handle optional error property carefully for exactOptionalPropertyTypes
  if (error) {
    updated.error = error;
  } else if (stored.error) {
    updated.error = stored.error;
  }

  return updated;
}

/**
 * Validate GitHub repository URL format
 */
export function validateGitHubUrl(url: string): url is `https://github.com/${string}` {
  const githubUrlPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
  return githubUrlPattern.test(url);
}

/**
 * Extract repository info from GitHub URL
 */
export function extractRepoInfo(url: `https://github.com/${string}`) {
  const match = url.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)$/);
  if (!match) return null;
  
  return {
    owner: match[1],
    repo: match[2],
    fullName: `${match[1]}/${match[2]}`,
  };
}
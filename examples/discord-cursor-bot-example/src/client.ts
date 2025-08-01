/**
 * Discord Cursor Bot - Client-side TypeScript
 * 
 * Simple interface for viewing agents and generating Discord invite links.
 */

import type { StoredCursorAgent } from "./types";

// Global state
let agents: StoredCursorAgent[] = [];

/**
 * Fetch and display Cursor agents
 */
async function refreshAgents(): Promise<void> {
  try {
    const response = await fetch('/api/agents');
    const data = await response.json() as { agents: StoredCursorAgent[] };
    agents = data.agents || [];
    renderAgents();
  } catch (error) {
    console.error('Failed to load agents:', error);
  }
}

/**
 * Render the agents list in the UI
 */
function renderAgents(): void {
  const container = document.getElementById('agentsList');
  if (!container) return;
  
  if (agents.length === 0) {
    container.innerHTML = '<div class="no-agents">No agents found. Create agents using Discord slash commands!</div>';
    return;
  }
  
  container.innerHTML = agents.map(agent => {
    const shortId = agent.id.slice(-8);
    const truncatedPrompt = agent.prompt.length > 100 ? 
      agent.prompt.substring(0, 100) + '...' : agent.prompt;
    
    return `
      <div class="agent-item">
        <div class="agent-header">
          <span class="agent-status status-${agent.status.toLowerCase()}">${agent.status}</span>
          <span class="agent-time">${new Date(agent.createdAt).toLocaleString()}</span>
        </div>
        <div class="agent-details">
          <div><strong>ID:</strong> ${shortId}</div>
          <div><strong>Repository:</strong> ${escapeHtml(agent.repository)}</div>
          <div><strong>Prompt:</strong> ${escapeHtml(truncatedPrompt)}</div>
          ${agent.discordThreadId ? `<div><strong>Discord Thread:</strong> ${agent.discordThreadId}</div>` : ''}
          ${agent.prUrl ? `<div><strong>PR:</strong> <a href="${agent.prUrl}" target="_blank">${agent.prUrl}</a></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Generate and display Discord invite link
 */
async function generateInviteLink(): Promise<void> {
  const inviteUrlEl = document.getElementById('inviteUrl');
  const inviteStatusEl = document.getElementById('inviteStatus');
  const copyInviteBtn = document.getElementById('copyInviteBtn') as HTMLButtonElement;
  
  if (!inviteUrlEl || !inviteStatusEl || !copyInviteBtn) return;
  
  // Update status to show we're working
  inviteStatusEl.textContent = '⏳ Generating...';
  inviteStatusEl.style.color = '#ffc107';
  inviteUrlEl.textContent = 'Generating invite link...';
  
  try {
    const response = await fetch('/api/invite-link');
    const result = await response.json() as { inviteLink?: string; error?: string };
    
    if (response.ok && result.inviteLink) {
      const inviteLink = result.inviteLink;
      
      // Clear existing content
      while (inviteUrlEl.firstChild) {
        // Check if the existing child matches
        if ((inviteUrlEl.firstChild as HTMLAnchorElement).href === inviteLink) {
          return;
        }
        inviteUrlEl.removeChild(inviteUrlEl.firstChild);
      }
      
      // Insert an anchor tag with the invite link
      const anchor = document.createElement('a');
      anchor.href = inviteLink;
      anchor.textContent = inviteLink;
      anchor.target = '_blank';
      inviteUrlEl.appendChild(anchor);
      
      inviteStatusEl.textContent = '✅ Generated';
      inviteStatusEl.style.color = '#28a745';
      
      // Enable the copy button
      copyInviteBtn.disabled = false;
    } else {
      throw new Error(result.error || 'Failed to generate invite link');
    }
  } catch (error) {
    console.error('Failed to generate invite link:', error);
    inviteStatusEl.textContent = '❌ Generation Failed';
    inviteStatusEl.style.color = '#dc3545';
    
    // Remove all children of inviteUrlEl
    while (inviteUrlEl.firstChild) {
      inviteUrlEl.removeChild(inviteUrlEl.firstChild);
    }
    inviteUrlEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Copy invite link to clipboard
 */
async function copyInviteLink(): Promise<void> {
  const inviteUrlEl = document.getElementById('inviteUrl');
  if (!inviteUrlEl) return;
  
  // Get the link from the anchor element if it exists
  const anchor = inviteUrlEl.querySelector('a');
  const inviteLink = anchor ? anchor.href : inviteUrlEl.textContent || '';
  
  if (!inviteLink || inviteLink.includes('Error:') || inviteLink.includes('Loading') || inviteLink.includes('Generating')) {
    alert('No valid invite link available to copy.');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(inviteLink);
    alert('✅ Invite link copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy invite link:', error);
    // Fallback: show the link in a temporary text area for manual copying
    const textArea = document.createElement('textarea');
    textArea.value = inviteLink;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('✅ Invite link copied to clipboard!');
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Discord Cursor Bot - Client Initialized');
  
  // Attach event listeners to buttons  
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshAgents);
  }
  
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', copyInviteLink);
  }
  
  const refreshInviteBtn = document.getElementById('refreshInviteBtn');
  if (refreshInviteBtn) {
    refreshInviteBtn.addEventListener('click', generateInviteLink);
  }
  
  // Load initial data
  generateInviteLink();
  refreshAgents();
  
  // Set up periodic updates
  setInterval(refreshAgents, 10000); // Refresh agents every 10 seconds
});
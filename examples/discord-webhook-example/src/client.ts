/**
 * Discord Bot Webhook Receiver - Client-side TypeScript
 * 
 * This file demonstrates proper TypeScript usage for the client-side
 * functionality of the Discord webhook example.
 */

import type { BotInfo, StoredInteraction, InteractionsResponse, HealthResponse, TunnelUrlResponse, FeedbackEntry, FeedbackListResponse } from "./types";


// Global state
let interactions: StoredInteraction[] = [];
let feedbackEntries: FeedbackEntry[] = [];

async function getTunnelUrl(): Promise<string> {
  const req = await fetch('/tunnel-url');
  const data: TunnelUrlResponse = await req.json();
  return data.tunnelUrl;
}

/**
 * Load bot configuration and tunnel information
 */
async function loadBotInfo(): Promise<void> {
  try {
    let tunnelUrl: string;
    let botInfo: BotInfo;
    
    try {
      // Method 1: Use WORKER to get tunnel URL
      tunnelUrl = await getTunnelUrl();
      console.log('🌐 Got tunnel URL from virtual module:', tunnelUrl);
    } catch (virtualModuleError) {
      console.warn('Virtual module not available, using current location:', virtualModuleError);
      
      // Method 2: Fallback to current window location (works when accessed via tunnel)
      const currentUrl = window.location.origin;
      if (currentUrl.includes('trycloudflare.com') || currentUrl.includes('cloudflare.com')) {
        tunnelUrl = currentUrl;
        console.log('🌐 Got tunnel URL from current location:', tunnelUrl);
      } else {
        console.log('🌐 Not accessed via tunnel, using localhost');
        tunnelUrl = 'http://localhost:3001';
      }
    }
    
    try {
      // Try to get real bot info from the server
      const response = await fetch('/api/bot-info');
      if (response.ok) {
        botInfo = await response.json();
        console.log('✅ Got bot info from server:', botInfo);
      } else {
        throw new Error('Server response not ok');
      }
    } catch (fetchError) {
      console.warn('Failed to fetch bot info from server, using defaults:', fetchError);
      // Fallback to default bot info
      botInfo = {
        hasPublicKey: false,
        hasBotToken: false,
        webhookUrl: `${tunnelUrl}/discord/interactions`,
        setupComplete: false,
        taskCommandRegistered: false,
        feedbackCommandRegistered: false
      };
    }
    
    // Ensure webhook URL uses the correct tunnel URL
    botInfo.webhookUrl = `${tunnelUrl}/discord/interactions`;
    
    // Update UI elements
    updateElement('webhookUrl', botInfo.webhookUrl);
    updateElement('debugWebhookUrl', botInfo.webhookUrl);
    updateElement('publicKeyStatus', botInfo.hasPublicKey ? '✅ Set' : '❌ Not Set');
    updateElement('debugPublicKeyStatus', botInfo.hasPublicKey ? '✅ Set' : '❌ Not Set');
    updateElement('botTokenStatus', botInfo.hasBotToken ? '✅ Set' : '❌ Not Set');
    updateElement('debugBotTokenStatus', botInfo.hasBotToken ? '✅ Set' : '❌ Not Set');
    updateElement('taskCommandStatus', botInfo.taskCommandRegistered ? '✅ Registered' : '❌ Not Registered');
    updateElement('feedbackCommandStatus', botInfo.feedbackCommandRegistered ? '✅ Registered' : '❌ Not Registered');
    
    const statusEl = document.getElementById('setupStatus');
    if (statusEl) {
      if (botInfo.setupComplete) {
        statusEl.textContent = 'Ready';
        statusEl.className = 'status ready';
      } else {
        statusEl.textContent = 'Setup Required';
        statusEl.className = 'status pending';
      }
    }
  } catch (error) {
    console.error('Failed to load bot info:', error);
    updateElement('webhookUrl', 'Error loading tunnel URL');
    updateElement('debugWebhookUrl', 'Error loading tunnel URL');
    updateElement('publicKeyStatus', '❌ Error');
    updateElement('debugPublicKeyStatus', '❌ Error');
  }
}

/**
 * Fetch and display recent interactions from the API
 */
async function refreshInteractions(): Promise<void> {
  try {
    const response = await fetch('/api/interactions');
    const data: InteractionsResponse = await response.json();
    interactions = data.interactions;
    
    updateElement('totalInteractions', interactions.length.toString());
    renderInteractions();
  } catch (error) {
    console.error('Failed to load interactions:', error);
  }
}

/**
 * Render the interactions list in the UI
 */
function renderInteractions(): void {
  const container = document.getElementById('interactionsList');
  if (!container) return;
  
  if (interactions.length === 0) {
    container.innerHTML = '<div class="no-interactions">No interactions received yet. Try using a slash command in Discord!</div>';
    return;
  }
  
  container.innerHTML = interactions.map(interaction => `
    <div class="interaction-item">
      <div class="interaction-header">
        <span class="interaction-type">${escapeHtml(interaction.type)}</span>
        <span class="interaction-time">${new Date(interaction.timestamp).toLocaleTimeString()}</span>
      </div>
      <div>
        <strong>Command:</strong> ${escapeHtml(interaction.data?.name || 'N/A')}<br>
        <strong>User:</strong> ${escapeHtml(interaction.user?.username || 'Unknown')}#${escapeHtml(interaction.user?.discriminator || '0000')}
      </div>
    </div>
  `).join('');
}

/**
 * Fetch and display recent feedback from the API
 */
async function refreshFeedback(): Promise<void> {
  try {
    const response = await fetch('/api/feedback');
    const data: FeedbackListResponse = await response.json();
    feedbackEntries = data.feedback;
    
    updateElement('totalFeedback', feedbackEntries.length.toString());
    renderFeedback();
  } catch (error) {
    console.error('Failed to load feedback:', error);
  }
}

/**
 * Render the feedback list in the UI
 */
function renderFeedback(): void {
  const container = document.getElementById('feedbackList');
  if (!container) return;
  
  if (feedbackEntries.length === 0) {
    container.innerHTML = '<div class="no-interactions">No feedback received yet. Try using the /feedback command in Discord!</div>';
    return;
  }
  
  container.innerHTML = feedbackEntries.map(feedback => {
    const ratingStars = feedback.rating ? '★'.repeat(feedback.rating) + '☆'.repeat(5 - feedback.rating) : 'No rating';
    const truncatedMessage = feedback.message.length > 100 ? 
      feedback.message.substring(0, 100) + '...' : feedback.message;
    
    return `
      <div class="interaction-item">
        <div class="interaction-header">
          <span class="interaction-type">${escapeHtml(feedback.category)}</span>
          <span class="interaction-time">${new Date(feedback.timestamp).toLocaleTimeString()}</span>
        </div>
        <div>
          <strong>User:</strong> ${escapeHtml(feedback.username)}<br>
          <strong>Rating:</strong> ${ratingStars}<br>
          <strong>Message:</strong> ${escapeHtml(truncatedMessage)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show/hide the command example section
 */
function showCommandExample(): void {
  const example = document.getElementById('commandExample');
  if (example) {
    example.style.display = example.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Show/hide the invite example section
 */
function showInviteExample(): void {
  const example = document.getElementById('inviteExample');
  if (example) {
    example.style.display = example.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Show/hide the codebot command example section
 */
function showCodebotCommand(): void {
  const example = document.getElementById('codebotExample');
  if (example) {
    example.style.display = example.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Show/hide the codebot handler code section
 */
function showCodebotHandler(): void {
  const example = document.getElementById('codebotHandler');
  if (example) {
    example.style.display = example.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Test the webhook endpoint health
 */
async function testWebhook(): Promise<void> {
  try {
    const response = await fetch('/health');
    const data: HealthResponse = await response.json();
    updateElement('serverStatus', data.status === 'ok' ? '✅ Online' : '❌ Offline');
    alert(`Webhook endpoint is ${data.status === 'ok' ? 'working' : 'not responding'}!`);
  } catch (error) {
    updateElement('serverStatus', '❌ Offline');
    alert('Webhook endpoint is not responding!');
  }
}

/**
 * Update element text content safely
 */
function updateElement(id: string, content: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = content;
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

/**
 * Check server status periodically
 */
async function checkServerStatus(): Promise<void> {
  try {
    const response = await fetch('/health');
    const data: HealthResponse = await response.json();
    updateElement('serverStatus', data.status === 'ok' ? '✅ Online' : '❌ Offline');
  } catch (error) {
    updateElement('serverStatus', '❌ Offline');
  }
}

/**
 * Show success modal with Discord setup results
 */
function showSuccessModal(result: any, type: 'key' | 'bot' = 'key'): void {
  const modal = document.getElementById('successModal');
  const modalTitleText = document.getElementById('modalTitleText');
  const modalSuccessMessage = document.getElementById('modalSuccessMessage');
  const commandSection = document.getElementById('commandSection');
  const copyCommand = document.getElementById('copyCommand');
  const nextStepsList = document.getElementById('nextStepsList');
  
  if (!modal || !modalTitleText || !modalSuccessMessage || !commandSection || !copyCommand || !nextStepsList) return;
  
  // Update modal content based on type
  if (type === 'bot') {
    modalTitleText.textContent = 'Discord Bot Token Set Successfully!';
    modalSuccessMessage.innerHTML = '<strong>🤖 Excellent!</strong> Your Discord bot token is now active and ready to use for this session.';
  } else {
    modalTitleText.textContent = 'Discord Public Key Set Successfully!';
    modalSuccessMessage.innerHTML = '<strong>🎉 Great!</strong> Your Discord public key is now active and ready to use for this session.';
  }
  
  // Show/hide command section based on whether we have a wrangler command
  if (result.wranglerCommand) {
    commandSection.style.display = 'block';
    copyCommand.textContent = result.wranglerCommand;
  } else {
    commandSection.style.display = 'none';
  }
  
  // Populate next steps
  nextStepsList.innerHTML = '';
  if (result.nextSteps && result.nextSteps.length > 0) {
    result.nextSteps.forEach((step: string) => {
      const li = document.createElement('li');
      li.textContent = step;
      nextStepsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'You can now proceed to Step 3 to configure the Discord endpoint';
    nextStepsList.appendChild(li);
  }
  
  // Show the modal
  modal.classList.add('show');
}

/**
 * Hide the success modal
 */
function hideSuccessModal(): void {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Copy the wrangler command to clipboard
 */
async function copyWranglerCommand(): Promise<void> {
  const copyCommand = document.getElementById('copyCommand');
  const copyBtn = document.getElementById('copyCommandBtn');
  const copyBtnText = document.getElementById('copyBtnText');
  
  if (!copyCommand || !copyBtn || !copyBtnText) return;
  
  const command = copyCommand.textContent || '';
  if (!command) return;
  
  try {
    await navigator.clipboard.writeText(command);
    
    // Show success feedback
    copyBtn.classList.add('copied');
    copyBtnText.textContent = 'Copied!';
    
    // Reset after 2 seconds
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtnText.textContent = 'Copy Command';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy command:', error);
    // Fallback: show the command in a temporary text area for manual copying
    const textArea = document.createElement('textarea');
    textArea.value = command;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    copyBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyBtnText.textContent = 'Copy Command';
    }, 2000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Discord Bot Webhook Receiver - TypeScript Client Initialized');
  
  // Attach event listeners to buttons
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshInteractions);
  }
  
  const refreshFeedbackButton = document.getElementById('refreshFeedbackButton');
  if (refreshFeedbackButton) {
    refreshFeedbackButton.addEventListener('click', refreshFeedback);
  }
  
  const testButton = document.getElementById('testButton');
  if (testButton) {
    testButton.addEventListener('click', testWebhook);
  }
  const copyBtn = document.getElementById('copyWebhookBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyWebhookUrl);
  }
  
  const setPublicKeyBtn = document.getElementById('setPublicKeyBtn');
  if (setPublicKeyBtn) {
    setPublicKeyBtn.addEventListener('click', setDiscordPublicKey);
  }
  
  const setBotTokenBtn = document.getElementById('setBotTokenBtn');
  if (setBotTokenBtn) {
    setBotTokenBtn.addEventListener('click', setDiscordBotToken);
  }
  
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', copyInviteLink);
  }
  
  const refreshInviteBtn = document.getElementById('refreshInviteBtn');
  if (refreshInviteBtn) {
    refreshInviteBtn.addEventListener('click', generateInviteLink);
  }
  
  // Modal event listeners
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', hideSuccessModal);
  }
  
  const modalContinueBtn = document.getElementById('modalContinueBtn');
  if (modalContinueBtn) {
    modalContinueBtn.addEventListener('click', hideSuccessModal);
  }
  
  const copyCommandBtn = document.getElementById('copyCommandBtn');
  if (copyCommandBtn) {
    copyCommandBtn.addEventListener('click', copyWranglerCommand);
  }
  
  // Close modal when clicking outside
  const successModal = document.getElementById('successModal');
  if (successModal) {
    successModal.addEventListener('click', (e) => {
      if (e.target === successModal) {
        hideSuccessModal();
      }
    });
  }
  
  // Close modal with Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSuccessModal();
    }
  });
  
  // Load initial data
  loadBotInfo().then(() => {
    // Auto-generate invite link if bot token is available
    generateInviteLink();
  });
  refreshInteractions();
  refreshFeedback();
  
  // Set up periodic updates
  setInterval(refreshInteractions, 5000); // Refresh interactions every 5 seconds
  setInterval(refreshFeedback, 5000); // Refresh feedback every 5 seconds
  setInterval(checkServerStatus, 10000);  // Check server status every 10 seconds
});

/**
 * Copy the webhook URL to the clipboard
 */
function copyWebhookUrl(): void {
  const el = document.getElementById('webhookUrl');
  if (!el) return;
  const text = el.textContent || '';
  if (!text) {
    alert('Webhook URL not available yet.');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    alert('Webhook URL copied to clipboard!');
  }).catch(err => {
    console.error('Copy failed:', err);
    alert('Failed to copy URL.');
  });
}

/**
 * Set the Discord public key via API call
 */
async function setDiscordPublicKey(): Promise<void> {
  const input = document.getElementById('discordPublicKey') as HTMLInputElement;
  const statusEl = document.getElementById('publicKeyStatus');
  const setBtn = document.getElementById('setPublicKeyBtn') as HTMLButtonElement;
  
  if (!input || !statusEl || !setBtn) return;
  
  const publicKey = input.value.trim();
  
  // Validate the public key format
  if (!publicKey) {
    alert('Please enter a Discord public key.');
    return;
  }
  
  if (publicKey.length !== 64) {
    alert('Discord public key must be exactly 64 characters long.');
    return;
  }
  
  if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
    alert('Discord public key must contain only hexadecimal characters (0-9, a-f, A-F).');
    return;
  }
  
  // Disable button and show loading state
  setBtn.disabled = true;
  setBtn.textContent = '⏳ Setting...';
  statusEl.textContent = 'Setting...';
  statusEl.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/set-public-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      statusEl.textContent = '✅ Set Successfully';
      statusEl.style.color = '#28a745';
      
      // Also update debug status immediately for instant feedback
      updateElement('debugPublicKeyStatus', '✅ Set');
      
      // Clear the input for security
      input.value = '';
      
      // Show success modal with detailed info
      showSuccessModal(result);
      
      // Refresh bot info to update other UI elements and ensure consistency
      loadBotInfo();
    } else {
      throw new Error(result.error || 'Failed to set public key');
    }
  } catch (error) {
    console.error('Failed to set Discord public key:', error);
    statusEl.textContent = '❌ Failed to Set';
    statusEl.style.color = '#dc3545';
    alert(`Failed to set Discord public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Re-enable button
    setBtn.disabled = false;
    setBtn.textContent = '🔑 Set Public Key';
  }
}

/**
 * Set the Discord bot token via API call
 */
async function setDiscordBotToken(): Promise<void> {
  const input = document.getElementById('discordBotToken') as HTMLInputElement;
  const statusEl = document.getElementById('botTokenStatus');
  const setBtn = document.getElementById('setBotTokenBtn') as HTMLButtonElement;
  
  if (!input || !statusEl || !setBtn) return;
  
  const botToken = input.value.trim();
  
  // Basic validation
  if (!botToken) {
    alert('Please enter a Discord bot token.');
    return;
  }
  
  // Remove 'Bot ' prefix if present for validation
  const tokenPart = botToken.startsWith('Bot ') ? botToken.slice(4) : botToken;
  
  if (tokenPart.length < 24) {
    alert('Discord bot token appears to be too short. Please check the token format.');
    return;
  }
  
  // Basic format check (Discord tokens contain alphanumeric, dots, dashes, underscores)
  if (!/^[A-Za-z0-9._-]+$/.test(tokenPart)) {
    alert('Discord bot token contains invalid characters. Please verify your token.');
    return;
  }
  
  // Disable button and show loading state
  setBtn.disabled = true;
  setBtn.textContent = '⏳ Setting...';
  statusEl.textContent = 'Setting...';
  statusEl.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/set-bot-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ botToken: tokenPart }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      statusEl.textContent = '✅ Set Successfully';
      statusEl.style.color = '#28a745';
      
      // Also update debug status immediately for instant feedback
      updateElement('debugBotTokenStatus', '✅ Set');
      
      // Clear the input for security
      input.value = '';
      
      // Show success modal with detailed info
      showSuccessModal(result, 'bot');
      
      // Refresh bot info to update other UI elements and ensure consistency
      loadBotInfo();
    } else {
      throw new Error(result.error || 'Failed to set bot token');
    }
  } catch (error) {
    console.error('Failed to set Discord bot token:', error);
    statusEl.textContent = '❌ Failed to Set';
    statusEl.style.color = '#dc3545';
    alert(`Failed to set Discord bot token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Re-enable button
    setBtn.disabled = false;
    setBtn.textContent = '🤖 Set Bot Token';
  }
}

/**
 * Get bot info from the server (separate from UI update function)
 */
async function getBotInfo(): Promise<BotInfo | null> {
  try {
    const response = await fetch('/api/bot-info');
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch bot info:', error);
    return null;
  }
}

/**
 * Generate and display Discord invite link
 */
async function generateInviteLink(): Promise<void> {
  const inviteUrlEl = document.getElementById('inviteUrl');
  const inviteStatusEl = document.getElementById('inviteStatus');
  const copyInviteBtn = document.getElementById('copyInviteBtn') as HTMLButtonElement;
  
  if (!inviteUrlEl || !inviteStatusEl || !copyInviteBtn) return;
  
  // Check if we have the required configuration
  const botInfo = await getBotInfo();
  if (!botInfo || !botInfo.hasBotToken) {
    alert('Please set your Discord bot token first (Step 2.5). The bot token is required to generate an invite link.');
    return;
  }
  
  // Update status to show we're working
  inviteStatusEl.textContent = '⏳ Generating...';
  inviteStatusEl.style.color = '#ffc107';
  inviteUrlEl.textContent = 'Generating invite link...';
  
  try {
    const response = await fetch('/api/invite-link');
    const result = await response.json();
    
    if (response.ok) {
      const inviteLink = result.inviteLink;
      while (inviteUrlEl.firstChild) {
        // check if the existing child matches
        if((inviteUrlEl.firstChild as HTMLAnchorElement).href === inviteLink) {
          return;
        }
        inviteUrlEl.removeChild(inviteUrlEl.firstChild);
      }
      // insert an anchor tag with the invite link
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
    // remove all children of inviteUrlEl
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
  
  const inviteLink = inviteUrlEl.textContent || '';
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
 * Load and display registered commands in the UI
 */
async function loadRegisteredCommands(): Promise<void> {
  const commandsStatus = document.getElementById('commandsStatus');
  const commandsList = document.getElementById('commandsList');
  const noCommands = document.getElementById('noCommands');
  const commandsError = document.getElementById('commandsError');
  const commandsContainer = document.getElementById('commandsContainer');
  
  if (!commandsStatus || !commandsList || !noCommands || !commandsError || !commandsContainer) return;
  
  // Reset UI
  commandsList.style.display = 'none';
  noCommands.style.display = 'none';
  commandsError.style.display = 'none';
  
  // Show loading state
  commandsStatus.textContent = '⏳ Loading...';
  commandsStatus.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/registered-commands');
    const result = await response.json();
    
    if (response.ok && result.commands) {
      const commands = result.commands;
      
      if (commands.length === 0) {
        commandsStatus.textContent = 'No commands found';
        commandsStatus.style.color = '#666';
        noCommands.style.display = 'block';
      } else {
        commandsStatus.textContent = `${commands.length} command${commands.length !== 1 ? 's' : ''} found`;
        commandsStatus.style.color = '#28a745';
        renderCommands(commands);
        commandsList.style.display = 'block';
      }
    } else {
      throw new Error(result.error || 'Failed to fetch commands');
    }
  } catch (error) {
    console.error('Failed to fetch registered commands:', error);
    commandsStatus.textContent = 'Failed to load';
    commandsStatus.style.color = '#dc3545';
    commandsError.style.display = 'block';
    commandsError.innerHTML = `<strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }
}

/**
 * Render commands in the UI
 */
function renderCommands(commands: any[]): void {
  const commandsContainer = document.getElementById('commandsContainer');
  if (!commandsContainer) return;
  
  commandsContainer.innerHTML = commands.map(cmd => `
    <div class="command-item" id="command-${cmd.id}">
      <div class="command-info">
        <div class="command-name">/${escapeHtml(cmd.name)}</div>
        <div class="command-description">${escapeHtml(cmd.description)}</div>
        <div class="command-meta">
          <span class="command-type-badge badge-global">Global</span>
          ID: ${escapeHtml(cmd.id)} • Version: ${escapeHtml(cmd.version)}
        </div>
      </div>
      <div class="command-actions">
        <button 
          class="command-delete-btn" 
          onclick="deleteCommand('${escapeHtml(cmd.id)}', '${escapeHtml(cmd.name)}')"
          title="Delete this command permanently"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Delete a registered command
 */
async function deleteCommand(commandId: string, commandName: string): Promise<void> {
  // Confirm deletion
  const confirmed = confirm(
    `⚠️ Delete Command: /${commandName}\n\n` +
    `This will permanently remove the command from Discord.\n` +
    `Global commands can take up to 1 hour to disappear.\n\n` +
    `Are you sure you want to continue?`
  );
  
  if (!confirmed) return;
  
  const commandItem = document.getElementById(`command-${commandId}`);
  const deleteBtn = commandItem?.querySelector('.command-delete-btn') as HTMLButtonElement;
  
  if (!commandItem || !deleteBtn) return;
  
  // Show loading state
  commandItem.classList.add('deleting');
  deleteBtn.disabled = true;
  deleteBtn.textContent = '⏳ Deleting...';
  
  try {
    const response = await fetch('/api/delete-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commandId }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Remove the command item with animation
      commandItem.style.transition = 'all 0.3s ease';
      commandItem.style.opacity = '0';
      commandItem.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        commandItem.remove();
        
        // Check if there are any commands left
        const remainingCommands = document.querySelectorAll('.command-item');
        if (remainingCommands.length === 0) {
          const commandsList = document.getElementById('commandsList');
          const noCommands = document.getElementById('noCommands');
          const commandsStatus = document.getElementById('commandsStatus');
          
          if (commandsList && noCommands && commandsStatus) {
            commandsList.style.display = 'none';
            noCommands.style.display = 'block';
            commandsStatus.textContent = 'No commands found';
            commandsStatus.style.color = '#666';
          }
        } else {
          // Update status count
          const commandsStatus = document.getElementById('commandsStatus');
          if (commandsStatus) {
            commandsStatus.textContent = `${remainingCommands.length} command${remainingCommands.length !== 1 ? 's' : ''} found`;
          }
        }
      }, 300);
      
      // Show success message
      alert(`✅ Command /${commandName} has been deleted successfully!\n\nNote: Global commands can take up to 1 hour to disappear from Discord.`);
      
      // Update bot info to refresh command status
      await loadBotInfo();
    } else {
      throw new Error(result.error || 'Failed to delete command');
    }
  } catch (error) {
    console.error('Failed to delete command:', error);
    
    // Reset UI state
    commandItem.classList.remove('deleting');
    deleteBtn.disabled = false;
    deleteBtn.textContent = '🗑️ Delete';
    
    alert(`❌ Failed to delete command /${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Register the /task command globally with Discord
 */
async function registerTaskCommand(): Promise<void> {
  const statusEl = document.getElementById('taskCommandStatus');
  if (!statusEl) return;
  
  // Check if we have the required configuration
  const botInfo = await getBotInfo();
  if (!botInfo || !botInfo.hasPublicKey) {
    alert('Please set your Discord public key first (Step 2).');
    return;
  }
  
  if (!botInfo.hasBotToken) {
    alert('Please set your Discord bot token first (Step 2.5). The bot token is required to register commands.');
    return;
  }
  
  // Check if the command is already registered
  if (botInfo.taskCommandRegistered) {
    alert('✅ The /task command is already registered with Discord!\n\n' +
          '📋 Available subcommands:\n' +
          '• /task create - Create a new task\n' +
          '• /task list - List your tasks\n' +
          '• /task complete - Mark a task as completed\n' +
          '• /task delete - Delete a task\n\n' +
          '🎯 Try using the command in Discord now!');
    return;
  }
  
  // Update status to show we're working
  statusEl.textContent = '⏳ Registering...';
  statusEl.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/register-task-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      statusEl.textContent = '✅ Registered Successfully';
      statusEl.style.color = '#28a745';
      
      // Show success message with details
      alert(`🎉 Success! The /task command has been registered globally with Discord.\n\n` +
            `📋 Available subcommands:\n` +
            `• /task create - Create a new task\n` +
            `• /task list - List your tasks\n` +
            `• /task complete - Mark a task as completed\n` +
            `• /task delete - Delete a task\n\n` +
            `⏰ Note: Global commands can take up to 1 hour to appear in Discord. ` +
            `Try using the command after a few minutes!`);
            
      // Refresh bot info to update the status
      await loadBotInfo();
    } else {
      throw new Error(result.error || 'Failed to register command');
    }
  } catch (error) {
    console.error('Failed to register /task command:', error);
    statusEl.textContent = '❌ Registration Failed';
    statusEl.style.color = '#dc3545';
    alert(`Failed to register /task command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Register the /feedback command globally with Discord
 */
async function registerFeedbackCommand(): Promise<void> {
  const statusEl = document.getElementById('feedbackCommandStatus');
  if (!statusEl) return;
  
  // Check if we have the required configuration
  const botInfo = await getBotInfo();
  if (!botInfo || !botInfo.hasPublicKey) {
    alert('Please set your Discord public key first (Step 2).');
    return;
  }
  
  if (!botInfo.hasBotToken) {
    alert('Please set your Discord bot token first (Step 2.5). The bot token is required to register commands.');
    return;
  }
  
  // Check if the command is already registered
  if (botInfo.feedbackCommandRegistered) {
    alert('✅ The /feedback command is already registered with Discord!\n\n' +
          '📝 What it does:\n' +
          '• Opens a secure modal form for feedback collection\n' +
          '• Protects sensitive input from being visible in chat\n' +
          '• Stores feedback securely in the database\n\n' +
          '🎁 Try using the command in Discord now!');
    return;
  }
  
  // Update status to show we're working
  statusEl.textContent = '⏳ Registering...';
  statusEl.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/register-feedback-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      statusEl.textContent = '✅ Registered Successfully';
      statusEl.style.color = '#28a745';
      
      // Show success message with details
      alert(`🎉 Success! The /feedback command has been registered globally with Discord.\n\n` +
            `📝 What you can do now:\n` +
            `• Use /feedback in any channel or DM\n` +
            `• A secure modal form will open for your input\n` +
            `• Your feedback is collected privately and securely\n` +
            `• No sensitive information appears in chat history\n\n` +
            `🔐 Security Benefits:\n` +
            `• Input is never logged in public channels\n` +
            `• Feedback is stored securely in the database\n` +
            `• Perfect for sensitive information collection\n\n` +
            `⏰ Note: Global commands can take up to 1 hour to appear in Discord. ` +
            `Try using the command after a few minutes!`);
            
      // Refresh bot info to update the status
      await loadBotInfo();
    } else {
      throw new Error(result.error || 'Failed to register command');
    }
  } catch (error) {
    console.error('Failed to register /feedback command:', error);
    statusEl.textContent = '❌ Registration Failed';
    statusEl.style.color = '#dc3545';
    alert(`Failed to register /feedback command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export functions for HTML onclick handlers (for backward compatibility)
(window as any).refreshInteractions = refreshInteractions;
(window as any).refreshFeedback = refreshFeedback;
(window as any).showCommandExample = showCommandExample;
(window as any).showInviteExample = showInviteExample;
(window as any).showCodebotCommand = showCodebotCommand;
(window as any).showCodebotHandler = showCodebotHandler;
(window as any).testWebhook = testWebhook;
(window as any).copyWebhookUrl = copyWebhookUrl;
(window as any).setDiscordPublicKey = setDiscordPublicKey;
(window as any).showSuccessModal = showSuccessModal;
(window as any).hideSuccessModal = hideSuccessModal;
(window as any).copyWranglerCommand = copyWranglerCommand;
(window as any).registerTaskCommand = registerTaskCommand;
(window as any).registerFeedbackCommand = registerFeedbackCommand;
(window as any).generateInviteLink = generateInviteLink;
(window as any).copyInviteLink = copyInviteLink;
(window as any).loadRegisteredCommands = loadRegisteredCommands;
(window as any).deleteCommand = deleteCommand;
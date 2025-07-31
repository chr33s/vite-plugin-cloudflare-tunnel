/**
 * Discord Bot Webhook Receiver - Client-side TypeScript
 * 
 * This file demonstrates proper TypeScript usage for the client-side
 * functionality of the Discord webhook example.
 */

/**
 * Bot configuration information from the API
 */
interface BotInfo {
  hasPublicKey: boolean;
  hasBotToken: boolean;
  webhookUrl: string;
  setupComplete: boolean;
  taskCommandRegistered: boolean;
  registeredCommands?: {
    applicationId: string;
    commands: Array<{
      id: string;
      name: string;
      description: string;
      type: number;
      version: string;
    }>;
    total: number;
  } | { error: string };
}

/**
 * Stored interaction data structure (matches server-side interface)
 */
interface StoredInteraction {
  id: number;
  timestamp: string;
  type: string;
  data?: {
    name?: string;
    [key: string]: any;
  };
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  raw: any;
}

/**
 * API response for interactions list
 */
interface InteractionsResponse {
  interactions: StoredInteraction[];
}

/**
 * Health check response from the worker
 */
interface HealthResponse {
  status: string;
  timestamp: string;
  interactions_received: number;
}

/**
 * Tunnel URL response (demonstrates virtual module usage)
 */
interface TunnelUrlResponse {
  tunnelUrl: string;
  source: string;
}

// Global state
let interactions: StoredInteraction[] = [];

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
        taskCommandRegistered: false
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
  
  // Set up periodic updates
  setInterval(refreshInteractions, 5000); // Refresh interactions every 5 seconds
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
 * View registered commands from Discord API
 */
async function viewRegisteredCommands(): Promise<void> {
  try {
    const response = await fetch('/api/registered-commands');
    const result = await response.json();
    
    if (response.ok && result.commands) {
      const commands = result.commands;
      const commandsList = commands.map((cmd: any) => 
        `• /${cmd.name} - ${cmd.description}`
      ).join('\n');
      
      alert(`📋 Registered Discord Commands (${commands.length} total):\n\n${commandsList || 'No commands registered yet.'}\n\nApplication ID: ${result.applicationId}`);
    } else {
      throw new Error(result.error || 'Failed to fetch commands');
    }
  } catch (error) {
    console.error('Failed to fetch registered commands:', error);
    alert(`❌ Failed to fetch registered commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

// Export functions for HTML onclick handlers (for backward compatibility)
(window as any).refreshInteractions = refreshInteractions;
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
(window as any).generateInviteLink = generateInviteLink;
(window as any).copyInviteLink = copyInviteLink;
(window as any).viewRegisteredCommands = viewRegisteredCommands;
/**
 * Cursor Background Agents - Client-side TypeScript
 * 
 * This file handles the frontend interaction for managing Cursor Background Agents,
 * including creating agents, monitoring their status, and viewing results.
 */

import type { 
  ServiceInfo, 
  StoredAgent, 
  AgentsResponse, 
  HealthResponse, 
  TunnelUrlResponse,
  CreateAgentInput,
  Agent
} from "./types";

// Local storage key for repo history
const REPO_HISTORY_KEY = 'cursorAgentRepoHistory';

function getRepoHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REPO_HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRepoToHistory(repo: string): void {
  if (!repo) return;
  const history = getRepoHistory();
  if (!history.includes(repo)) {
    history.unshift(repo);
    // keep only latest 10 entries
    localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  }
}

function populateRepoDatalist(): void {
  const datalist = document.getElementById('repoHistory') as HTMLDataListElement | null;
  if (!datalist) return;
  datalist.innerHTML = '';
  getRepoHistory().forEach(repo => {
    const option = document.createElement('option');
    option.value = repo;
    datalist.appendChild(option);
  });
}

// Global state
let agents: StoredAgent[] = [];

/**
 * Get tunnel URL from the worker
 */
async function getTunnelUrl(): Promise<string> {
  const req = await fetch('/tunnel-url');
  const data: TunnelUrlResponse = await req.json();
  return data.tunnelUrl;
}

/**
 * Load service configuration and tunnel information
 */
async function loadServiceInfo(): Promise<void> {
  try {
    let tunnelUrl: string;
    let serviceInfo: ServiceInfo;
    
    try {
      // Get tunnel URL from worker
      tunnelUrl = await getTunnelUrl();
      console.log('🌐 Got tunnel URL:', tunnelUrl);
    } catch (virtualModuleError) {
      console.warn('Virtual module not available, using current location:', virtualModuleError);
      
      // Fallback to current window location
      const currentUrl = window.location.origin;
      if (currentUrl.includes('trycloudflare.com') || currentUrl.includes('cloudflare.com')) {
        tunnelUrl = currentUrl;
        console.log('🌐 Got tunnel URL from current location:', tunnelUrl);
      } else {
        console.log('🌐 Not accessed via tunnel, using localhost');
        tunnelUrl = 'http://localhost:3000';
      }
    }
    
    try {
      // Get service info from the server
      const response = await fetch('/api/service-info');
      if (response.ok) {
        serviceInfo = await response.json();
        console.log('✅ Got service info from server:', serviceInfo);
      } else {
        throw new Error('Server response not ok');
      }
    } catch (fetchError) {
      console.warn('Failed to fetch service info from server, using defaults:', fetchError);
      // Fallback to default service info
      serviceInfo = {
        hasApiKey: false,
        webhookUrl: `${tunnelUrl}/api/agent-webhook`,
        setupComplete: false,
        totalAgents: 0,
        activeAgents: 0,
      };
    }
    
    // Update UI elements
    updateElement('webhookUrl', serviceInfo.webhookUrl);
    updateElement('debugWebhookUrl', serviceInfo.webhookUrl);
    updateElement('apiKeyStatus', serviceInfo.hasApiKey ? '✅ Set' : '❌ Not Set');
    updateElement('debugApiKeyStatus', serviceInfo.hasApiKey ? '✅ Set' : '❌ Not Set');
    updateElement('totalAgents', serviceInfo.totalAgents.toString());
    updateElement('activeAgents', serviceInfo.activeAgents.toString());
    
    const statusEl = document.getElementById('setupStatus');
    if (statusEl) {
      if (serviceInfo.setupComplete) {
        statusEl.textContent = 'Ready';
        statusEl.className = 'status ready';
      } else {
        statusEl.textContent = 'Setup Required';
        statusEl.className = 'status pending';
      }
    }
  } catch (error) {
    console.error('Failed to load service info:', error);
    updateElement('webhookUrl', 'Error loading tunnel URL');
    updateElement('debugWebhookUrl', 'Error loading tunnel URL');
    updateElement('apiKeyStatus', '❌ Error');
    updateElement('debugApiKeyStatus', '❌ Error');
  }
}

/**
 * Fetch and display agents from the API
 */
async function refreshAgents(): Promise<void> {
  try {
    const response = await fetch('/api/agents');
    const data: AgentsResponse = await response.json();
    agents = data.agents;
    
    updateElement('totalAgents', agents.length.toString());
    // for now treat all agents as active
    // ultimately we want to hide agents that have not changed recently but we do want to include recently errored and recently compelted agents for sure so filtering on status is not useful
    const activeCount = agents.filter(a => ['PENDING', 'RUNNING', 'CREATING'].includes(a.status)).length;
    updateElement('activeAgents', activeCount.toString());
    
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
    container.innerHTML = '<div class="no-agents">No agents created yet. Create your first agent using the form above!</div>';
    return;
  }
  
  container.innerHTML = agents.map(agent => `
    <div class="agent-item">
      <div class="agent-header">
        <span class="agent-status status-${agent.status.toLowerCase()}">${escapeHtml(agent.status)}</span>
        <span class="agent-time">${new Date(agent.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="agent-details">
        <div><strong>Repository:</strong> ${escapeHtml(agent.repository)}</div>
        <div><strong>Prompt:</strong> ${escapeHtml(agent.prompt.substring(0, 100))}${agent.prompt.length > 100 ? '...' : ''}</div>
        ${agent.model ? `<div><strong>Model:</strong> ${escapeHtml(agent.model)}</div>` : ''}
        ${agent.branchName ? `<div><strong>Branch:</strong> ${escapeHtml(agent.branchName)}</div>` : ''}
        ${agent.prUrl ? `<div><strong>PR:</strong> <a href="${escapeHtml(agent.prUrl)}" target="_blank">View Pull Request</a></div>` : ''}
        ${agent.error ? `<div class="agent-error"><strong>Error:</strong> ${escapeHtml(agent.error)}</div>` : ''}
      </div>
      <div class="agent-actions">
        <button onclick="viewAgentLogs('${agent.id}')" class="button secondary">📋 View Logs</button>
      </div>
    </div>
  `).join('');
}

/**
 * Test the service endpoint health
 */
async function testService(): Promise<void> {
  try {
    const response = await fetch('/health');
    const data: HealthResponse = await response.json();
    updateElement('serverStatus', data.status === 'ok' ? '✅ Online' : '❌ Offline');
    alert(`Service endpoint is ${data.status === 'ok' ? 'working' : 'not responding'}!`);
  } catch (error) {
    updateElement('serverStatus', '❌ Offline');
    alert('Service endpoint is not responding!');
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
 * Load available models from the server and populate the model select dropdown
 */
async function loadModels(): Promise<void> {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) throw new Error('Server response not OK');

    const data = await response.json() as { models: string[] };
    const modelSelect = document.getElementById('agentModel') as HTMLSelectElement | null;
    if (!modelSelect) return;

    // Remove existing dynamic options (keep the first "Default Model" option)
    while (modelSelect.options.length > 1) {
      modelSelect.remove(1);
    }

    data.models.forEach(model => {
      if ([...modelSelect.options].some(o => o.value === model)) return; // skip duplicates
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load models:', error);
  }
}

/**
 * Show success modal with setup results
 */
function showSuccessModal(result: any): void {
  const modal = document.getElementById('successModal');
  const modalTitleText = document.getElementById('modalTitleText');
  const modalSuccessMessage = document.getElementById('modalSuccessMessage');
  const commandSection = document.getElementById('commandSection');
  const copyCommand = document.getElementById('copyCommand');
  const nextStepsList = document.getElementById('nextStepsList');
  
  if (!modal || !modalTitleText || !modalSuccessMessage || !commandSection || !copyCommand || !nextStepsList) return;
  
  modalTitleText.textContent = 'Cursor API Key Set Successfully!';
  modalSuccessMessage.innerHTML = '<strong>🎉 Great!</strong> Your Cursor API key is now active and ready to use for this session.';
  
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
    li.textContent = 'You can now create Cursor agents using the interface';
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
 * Set the Cursor API key via API call
 */
async function setCursorApiKey(): Promise<void> {
  const input = document.getElementById('cursorApiKey') as HTMLInputElement;
  const statusEl = document.getElementById('apiKeyStatus');
  const setBtn = document.getElementById('setApiKeyBtn') as HTMLButtonElement;
  
  if (!input || !statusEl || !setBtn) return;
  
  const apiKey = input.value.trim();
  
  // Validate the API key format
  if (!apiKey) {
    alert('Please enter a Cursor API key.');
    return;
  }
  
  if (apiKey.length < 10) {
    alert('Cursor API key appears to be too short. Please check the key format.');
    return;
  }
  
  // Disable button and show loading state
  setBtn.disabled = true;
  setBtn.textContent = '⏳ Setting...';
  statusEl.textContent = 'Setting...';
  statusEl.style.color = '#ffc107';
  
  try {
    const response = await fetch('/api/set-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      statusEl.textContent = '✅ Set Successfully';
      statusEl.style.color = '#28a745';
      
      // Also update debug status immediately for instant feedback
      updateElement('debugApiKeyStatus', '✅ Set');
      
      // Clear the input for security
      input.value = '';
      
      // Show success modal with detailed info
      showSuccessModal(result);
      
      // Refresh service info to update other UI elements and ensure consistency
      loadServiceInfo();
    } else {
      throw new Error(result.error || 'Failed to set API key');
    }
  } catch (error) {
    console.error('Failed to set Cursor API key:', error);
    statusEl.textContent = '❌ Failed to Set';
    statusEl.style.color = '#dc3545';
    alert(`Failed to set Cursor API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Re-enable button
    setBtn.disabled = false;
    setBtn.textContent = '🔑 Set API Key';
  }
}

const userNameSlashRepoRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const DEFAULT_MODEL = 'claude-4-sonnet-thinking';

/**
 * Create a new Cursor agent
 */
async function createAgent(): Promise<void> {
  const promptInput = document.getElementById('agentPrompt') as HTMLTextAreaElement;
  const repoInput = document.getElementById('agentRepository') as HTMLInputElement;
  const modelSelect = document.getElementById('agentModel') as HTMLSelectElement;
  const branchInput = document.getElementById('agentBranch') as HTMLInputElement;
  const autoCreatePrCheckbox = document.getElementById('autoCreatePr') as HTMLInputElement;
  const useWebhookCheckbox = document.getElementById('useWebhook') as HTMLInputElement;
  const createBtn = document.getElementById('createAgentBtn') as HTMLButtonElement;
  
  if (!promptInput || !repoInput || !modelSelect || !createBtn) return;
  
  const prompt = promptInput.value.trim();
  const repository = repoInput.value.trim();
  const model = (modelSelect.value || null) as string | null;
  const branchName = branchInput?.value.trim() || null;
  const autoCreatePr = autoCreatePrCheckbox?.checked || false;
  const useWebhook = useWebhookCheckbox?.checked || true;
  
  // Validate inputs
  if (!prompt) {
    alert('Please enter a prompt for the agent.');
    return;
  }
  
  if (!repository) {
    alert('Please enter a repository URL.');
    return;
  }
  
  if (!repository.startsWith('https://github.com/') && !userNameSlashRepoRegex.test(repository)) {
    alert('Repository must be either username/repo or orgname/repo or a complete GitHub URL starting with https://github.com/');
    return;
  }
  
  // Disable button and show loading state
  createBtn.disabled = true;
  createBtn.textContent = '⏳ Creating Agent...';
  
  try {
    const input: Omit<CreateAgentInput, 'webhook'> = {
      prompt: { text: prompt, images: [] },
      source: {
        repository: repository.startsWith('https://github.com/') ? repository as `https://github.com/${string}` : `https://github.com/${repository}`,
        ...(branchName ? { ref: branchName } : {}),
      },
      model: model || DEFAULT_MODEL, // or is important to handle empty string case
      target: {
        autoCreatePr: !!autoCreatePr,
      },
    };
    
    const response = await fetch('/api/create-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      const agent = result as Agent;
      
      // Clear the form
      promptInput.value = '';
      repoInput.value = '';
      modelSelect.value = '';
      if (branchInput) branchInput.value = '';
      if (autoCreatePrCheckbox) autoCreatePrCheckbox.checked = false;
      
      // Show success message
      alert(`🎉 Agent created successfully!\n\nAgent ID: ${agent.id}\nStatus: ${agent.status}\n\nYou can monitor its progress in the agents list below.`);
      
      // Save repo to history and update datalist
      saveRepoToHistory(input.source.repository);
      populateRepoDatalist();

      // Refresh the agents list and service info
      await refreshAgents();
      await loadServiceInfo();
    } else {
      throw new Error(result.error || 'Failed to create agent');
    }
  } catch (error) {
    console.error('Failed to create agent:', error);
    alert(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Re-enable button
    createBtn.disabled = false;
    createBtn.textContent = '🚀 Create Agent';
  }
}

/**
 * View conversation
 */
async function viewAgentLogs(agentId: string): Promise<void> {
  try {
    const response = await fetch(`/api/agents/${agentId}/conversation`);
    const result = await response.json() as { messages?: any[]; error?: string };

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to fetch logs');
    }

    const logs = result.messages ?? [];

    // Build HTML representing the conversation
    const logsHtml = logs.length > 0
      ? logs.map(log => {
          const role = log.type === 'user_message' ? 'user' : 'assistant';
          const avatar = role === 'user' ? '🧑' : '🤖';
          return `
            <div class="chat-message ${role}">
              <div class="chat-avatar">${avatar}</div>
              <div class="chat-bubble">${escapeHtml(log.text)}</div>
            </div>
          `;
        }).join('')
      : '<div class="no-logs">No logs available yet.</div>';

    // Create and show modal
    const modal = document.createElement('div');
    modal.className = 'logs-modal';
    modal.innerHTML = `
      <div class="logs-modal-content">
        <div class="logs-modal-header">
          <h3>Agent Conversation - ${agentId}</h3>
          <button onclick="this.closest('.logs-modal').remove()" class="logs-modal-close">&times;</button>
        </div>
        <div class="logs-modal-body">
          <div class="chat-container">${logsHtml}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('Failed to fetch agent logs:', error);
    alert(`Failed to fetch agent logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Cursor Background Agents - TypeScript Client Initialized');
  
  // Attach event listeners to buttons
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshAgents);
  }
  
  const testButton = document.getElementById('testButton');
  if (testButton) {
    testButton.addEventListener('click', testService);
  }
  
  const copyBtn = document.getElementById('copyWebhookBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyWebhookUrl);
  }
  
  const setApiKeyBtn = document.getElementById('setApiKeyBtn');
  if (setApiKeyBtn) {
    setApiKeyBtn.addEventListener('click', setCursorApiKey);
  }
  
  const createAgentBtn = document.getElementById('createAgentBtn');
  if (createAgentBtn) {
    createAgentBtn.addEventListener('click', createAgent);
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
  loadServiceInfo();
  refreshAgents();
  populateRepoDatalist();
  loadModels();
  
  // Set up periodic updates
  setInterval(refreshAgents, 10000); // Refresh agents every 10 seconds
  setInterval(checkServerStatus, 15000);  // Check server status every 15 seconds
});

// Export functions for HTML onclick handlers (for backward compatibility)
(window as any).refreshAgents = refreshAgents;
(window as any).testService = testService;
(window as any).copyWebhookUrl = copyWebhookUrl;
(window as any).setCursorApiKey = setCursorApiKey;
(window as any).createAgent = createAgent;
(window as any).viewAgentLogs = viewAgentLogs;
(window as any).showSuccessModal = showSuccessModal;
(window as any).hideSuccessModal = hideSuccessModal;
(window as any).copyWranglerCommand = copyWranglerCommand;
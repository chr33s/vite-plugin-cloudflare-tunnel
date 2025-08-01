/**
 * Shared type definitions used by both the client and worker code.
 * Consolidating them here prevents the two files from drifting apart.
 */

export interface StoredInteraction {
  id: number;
  timestamp: string;
  type: string;
  /** Optional structured data included with the Discord interaction. */
  data?: any;
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  raw: any;
}

export interface BotInfo {
  hasPublicKey: boolean;
  hasBotToken: boolean;
  webhookUrl: string;
  setupComplete: boolean;
  taskCommandRegistered: boolean;
  feedbackCommandRegistered: boolean;
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

export interface InteractionsResponse {
  interactions: StoredInteraction[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  interactions_received: number;
}

export interface TunnelUrlResponse {
  tunnelUrl: string;
  source: string;
}

export interface Task {
  id: number;
  user_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

export interface FeedbackEntry {
  id: number;
  user_id: string;
  username: string;
  category: string;
  message: string;
  rating: number | null;
  timestamp: string;
}

export interface FeedbackListResponse {
  feedback: FeedbackEntry[];
  total: number;
  message: string;
}

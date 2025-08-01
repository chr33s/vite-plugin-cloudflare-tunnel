-- migrations/0001_initial_schema.sql
-- Initial database schema for Discord Cursor Bot

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  repository TEXT NOT NULL,
  discord_channel_id TEXT NOT NULL,
  discord_thread_id TEXT,
  discord_user_id TEXT NOT NULL,
  model TEXT,
  branch_name TEXT,
  pr_url TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create interactions table for tracking Discord interactions
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT, 
  user_id TEXT,
  user_username TEXT,
  raw TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_discord_channel_id ON agents(discord_channel_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
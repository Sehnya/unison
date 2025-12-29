-- Migration: 002_used_refresh_tokens
-- Description: Table for tracking used refresh tokens for rotation violation detection
-- Created: 2024-01-01

CREATE TABLE used_refresh_tokens (
  refresh_token_hash VARCHAR(255) PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_used_refresh_tokens_session_id ON used_refresh_tokens(session_id);
CREATE INDEX idx_used_refresh_tokens_user_id ON used_refresh_tokens(user_id);
CREATE INDEX idx_used_refresh_tokens_used_at ON used_refresh_tokens(used_at);

-- Cleanup old used tokens (keep for 7 days for rotation detection)
-- This can be run periodically via a cron job

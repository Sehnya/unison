-- Message Reactions Table
-- Stores emoji reactions on messages
-- Created: 2024-12-31

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id BIGINT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(64) NOT NULL,  -- Unicode emoji or :custom_emoji_name:
  emoji_url TEXT,              -- URL for custom emojis
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each user can only react once with the same emoji per message
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Index for fast lookup by message
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);

-- Index for counting reactions by emoji
CREATE INDEX idx_message_reactions_emoji ON message_reactions(message_id, emoji);

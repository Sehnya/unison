-- Migration: 014_friends_and_dm_system
-- Description: Friends system with requests, DM privacy settings, and direct messaging
-- Created: 2026-01-01

-- ============================================
-- DM Privacy Settings (on users table)
-- ============================================

-- Add dm_privacy column to users table
-- Values: 'open' (anyone can DM), 'friends' (friends only), 'closed' (no DMs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS dm_privacy VARCHAR(20) DEFAULT 'friends';

-- ============================================
-- Friends Table
-- ============================================

CREATE TABLE IF NOT EXISTS friends (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique friendship pairs (user_id, friend_id)
  CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
  -- Prevent self-friendship
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_friends_user_status ON friends(user_id, status);

-- ============================================
-- Direct Message Conversations
-- ============================================

CREATE TABLE IF NOT EXISTS dm_conversations (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants in DM conversations (always 2 users for 1:1 DMs)
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id BIGINT NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_participants_conversation ON dm_participants(conversation_id);

-- ============================================
-- Direct Messages (Partitioned by month like messages table)
-- ============================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2025 and 2026
CREATE TABLE IF NOT EXISTS direct_messages_2025_01 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_02 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_03 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_04 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_05 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_06 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_07 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_08 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_09 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_10 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_11 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS direct_messages_2025_12 PARTITION OF direct_messages
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS direct_messages_2026_01 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_02 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_03 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_04 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_05 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_06 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_07 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_08 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-08-08') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_09 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_10 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_11 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS direct_messages_2026_12 PARTITION OF direct_messages
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Indexes for direct messages
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_author ON direct_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at DESC);

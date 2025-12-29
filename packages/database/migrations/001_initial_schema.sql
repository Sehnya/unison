-- Migration: 001_initial_schema
-- Description: Initial database schema for Discord Clone Core
-- Created: 2024-01-01

-- ============================================
-- Users and Authentication
-- ============================================

CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);

-- ============================================
-- Guilds
-- ============================================

CREATE TABLE guilds (
  id BIGINT PRIMARY KEY,
  owner_id BIGINT REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_guilds_owner_id ON guilds(owner_id);
CREATE INDEX idx_guilds_deleted_at ON guilds(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE guild_members (
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(32),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX idx_guild_members_user_id ON guild_members(user_id);

CREATE TABLE guild_bans (
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  banned_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX idx_guild_bans_user_id ON guild_bans(user_id);

CREATE TABLE invites (
  code VARCHAR(16) PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  creator_id BIGINT REFERENCES users(id),
  max_uses INT,
  uses INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_guild_id ON invites(guild_id);
CREATE INDEX idx_invites_expires_at ON invites(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- Channels
-- ============================================

CREATE TABLE channels (
  id BIGINT PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  type SMALLINT NOT NULL DEFAULT 0,
  name VARCHAR(100) NOT NULL,
  topic VARCHAR(1024),
  parent_id BIGINT REFERENCES channels(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_channels_guild_id ON channels(guild_id);
CREATE INDEX idx_channels_parent_id ON channels(parent_id);
CREATE INDEX idx_channels_guild_position ON channels(guild_id, position);
CREATE INDEX idx_channels_deleted_at ON channels(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- Roles and Permissions
-- ============================================

CREATE TABLE roles (
  id BIGINT PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),
  position INT NOT NULL,
  permissions BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_guild_id ON roles(guild_id);
CREATE INDEX idx_roles_guild_position ON roles(guild_id, position);

CREATE TABLE member_roles (
  guild_id BIGINT,
  user_id BIGINT,
  role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (guild_id, user_id, role_id),
  FOREIGN KEY (guild_id, user_id) REFERENCES guild_members(guild_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_member_roles_role_id ON member_roles(role_id);

CREATE TABLE channel_overwrites (
  channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('role', 'member')),
  allow_bits BIGINT NOT NULL DEFAULT 0,
  deny_bits BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, target_id)
);

CREATE INDEX idx_channel_overwrites_target ON channel_overwrites(target_id, target_type);

-- ============================================
-- Messages (Partitioned by month)
-- ============================================

CREATE TABLE messages (
  id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  mentions BIGINT[] DEFAULT '{}',
  mention_roles BIGINT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2024 and 2025
CREATE TABLE messages_2024_01 PARTITION OF messages
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE messages_2024_02 PARTITION OF messages
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE messages_2024_03 PARTITION OF messages
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE messages_2024_04 PARTITION OF messages
  FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE messages_2024_05 PARTITION OF messages
  FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE messages_2024_06 PARTITION OF messages
  FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE messages_2024_07 PARTITION OF messages
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE messages_2024_08 PARTITION OF messages
  FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE messages_2024_09 PARTITION OF messages
  FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE messages_2024_10 PARTITION OF messages
  FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE messages_2024_11 PARTITION OF messages
  FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE messages_2024_12 PARTITION OF messages
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE messages_2025_01 PARTITION OF messages
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE messages_2025_02 PARTITION OF messages
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE messages_2025_03 PARTITION OF messages
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE messages_2025_04 PARTITION OF messages
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE messages_2025_05 PARTITION OF messages
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE messages_2025_06 PARTITION OF messages
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE messages_2025_07 PARTITION OF messages
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE messages_2025_08 PARTITION OF messages
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE messages_2025_09 PARTITION OF messages
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE messages_2025_10 PARTITION OF messages
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE messages_2025_11 PARTITION OF messages
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE messages_2025_12 PARTITION OF messages
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Create indexes on the parent table (will be inherited by partitions)
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_author ON messages(author_id);
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- Event Tracking (for idempotency)
-- ============================================

CREATE TABLE processed_events (
  event_id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleanup old processed events (keep for 24 hours)
CREATE INDEX idx_processed_events_processed_at ON processed_events(processed_at);

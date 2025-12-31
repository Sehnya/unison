-- Guild Emojis Table
-- Stores custom emojis for each guild
-- Created: 2024-12-31

CREATE TABLE IF NOT EXISTS guild_emojis (
  id BIGINT PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  name VARCHAR(32) NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  animated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique emoji names per guild
  CONSTRAINT unique_emoji_name_per_guild UNIQUE (guild_id, name)
);

-- Index for fast lookup by guild
CREATE INDEX idx_guild_emojis_guild_id ON guild_emojis(guild_id);

-- Index for searching emojis by name
CREATE INDEX idx_guild_emojis_name ON guild_emojis(name);

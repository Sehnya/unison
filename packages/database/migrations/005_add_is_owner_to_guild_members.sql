-- Migration: 005_add_is_owner_to_guild_members
-- Description: Add is_owner boolean field to guild_members table to track guild ownership
-- Created: 2024-01-02

ALTER TABLE guild_members
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster owner lookups
CREATE INDEX IF NOT EXISTS idx_guild_members_is_owner ON guild_members(guild_id, is_owner) WHERE is_owner = TRUE;


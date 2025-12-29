-- Migration: 003_add_guild_description_banner
-- Description: Add description and banner columns to guilds table
-- Created: 2024-01-02

ALTER TABLE guilds
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS banner VARCHAR(255);

